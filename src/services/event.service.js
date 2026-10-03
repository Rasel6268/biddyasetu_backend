const Event = require("../models/Event.model");
const AppError = require("../utility/appError");

/**
 * Get all events with flexible search, filter, and pagination
 */
const getEventsService = async (query = {}) => {
  const {
    type,
    status,
    search,
    featured,
    page = 1,
    limit = 20,
    sortBy = "date",
    sortOrder = "asc",
  } = query;

  const filter = {};

  if (type && type !== "all" && type !== "All") {
    filter.eventType = new RegExp(`^${type}$`, "i");
  }

  if (status && status !== "all") {
    filter.status = status;
  }

  if (featured !== undefined) {
    filter.featured = featured === "true" || featured === true;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { title: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
      { venue: { $regex: s, $options: "i" } },
      { organizer: { $regex: s, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get single event by ID or slug
 */
const getEventByIdService = async (idOrSlug) => {
  let event = null;
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    event = await Event.findById(idOrSlug).populate("attendees.user", "name email phone batch");
  } else {
    event = await Event.findOne({ slug: idOrSlug }).populate("attendees.user", "name email phone batch");
  }

  if (!event) {
    throw new AppError("Event not found.", 404);
  }

  return event;
};

/**
 * Create a new event
 */
const createEventService = async (payload, creatorId) => {
  const {
    title,
    description,
    eventType,
    date,
    time,
    venue,
    locationMapUrl,
    bannerImage,
    fee,
    feeAmount,
    capacity,
    status,
    featured,
    organizer,
  } = payload;

  if (!title || !description || !date || !venue) {
    throw new AppError("Title, description, date, and venue are required.", 400);
  }

  const newEvent = new Event({
    title,
    description,
    eventType: eventType || "Reunion",
    date,
    time: time || "09:00 AM - 05:00 PM",
    venue,
    locationMapUrl: locationMapUrl || "",
    bannerImage: bannerImage || "",
    fee: fee || "Free",
    feeAmount: feeAmount || 0,
    capacity: capacity ? Number(capacity) : 500,
    status: status || "upcoming",
    featured: Boolean(featured),
    organizer: organizer || "Biddyasetu Executive Committee",
    createdBy: creatorId || null,
  });

  await newEvent.save();
  return newEvent;
};

/**
 * Update event
 */
const updateEventService = async (id, payload) => {
  const event = await Event.findById(id);
  if (!event) {
    throw new AppError("Event not found.", 404);
  }

  Object.assign(event, payload);
  await event.save();
  return event;
};

/**
 * Delete event
 */
const deleteEventService = async (id) => {
  const event = await Event.findByIdAndDelete(id);
  if (!event) {
    throw new AppError("Event not found.", 404);
  }
  return { id, message: "Event deleted successfully." };
};

/**
 * Register attendee / RSVP for an event
 */
const registerAttendeeService = async (eventId, attendeeData, userId) => {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError("Event not found.", 404);
  }

  if (event.status === "completed" || event.status === "cancelled") {
    throw new AppError(`Registration is closed because this event is ${event.status}.`, 400);
  }

  const { name, phone, email, batch, guestCount } = attendeeData;

  if (!name || !phone) {
    throw new AppError("Full name and mobile phone number are required.", 400);
  }

  // Check if already registered by phone or userId
  const cleanPhone = phone.replace(/\D/g, "");
  const existing = event.attendees.find((a) => {
    const aPhone = (a.phone || "").replace(/\D/g, "");
    if (aPhone && aPhone === cleanPhone) return true;
    if (userId && a.user && a.user.toString() === userId.toString()) return true;
    return false;
  });

  if (existing) {
    throw new AppError("You have already registered / RSVP'd for this event.", 400);
  }

  // Check capacity
  const confirmedCount = event.attendees.filter((a) => a.status === "confirmed").length;
  const isWaitlist = event.capacity && confirmedCount >= event.capacity;

  const newAttendee = {
    user: userId || null,
    name: name.trim(),
    phone: phone.trim(),
    email: (email || "").trim(),
    batch: (batch || "").trim(),
    guestCount: guestCount ? Math.max(1, Number(guestCount)) : 1,
    status: isWaitlist ? "waitlist" : "confirmed",
    registeredAt: new Date(),
  };

  event.attendees.push(newAttendee);
  await event.save();

  return {
    event,
    attendee: newAttendee,
    message: isWaitlist
      ? "Event is at maximum capacity. You have been placed on the waitlist."
      : "You have successfully registered for the event!",
  };
};

const mongoose = require("mongoose");

/**
 * Get registered events and attendance passes for a logged-in user
 */
const getMyEventsService = async (userId, userPhone, userEmail) => {
  const queryOr = [];

  if (userId) {
    queryOr.push({ "attendees.user": userId });
    try {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        queryOr.push({ "attendees.user": new mongoose.Types.ObjectId(userId) });
      }
    } catch (e) {}
  }

  if (userPhone) {
    const rawDigits = String(userPhone).replace(/\D/g, "");
    if (rawDigits.length >= 6) {
      const suffix = rawDigits.slice(-6);
      queryOr.push({ "attendees.phone": { $regex: suffix, $options: "i" } });
    }
    queryOr.push({ "attendees.phone": String(userPhone) });
  }

  if (userEmail && typeof userEmail === "string" && userEmail.trim()) {
    queryOr.push({ "attendees.email": { $regex: `^${userEmail.trim()}$`, $options: "i" } });
  }

  if (queryOr.length === 0) return [];

  const events = await Event.find({ $or: queryOr }).sort({ date: 1 }).lean();

  return events.map((evt) => {
    const cleanPhoneDigits = (userPhone || "").replace(/\D/g, "");
    const cleanEmail = (userEmail || "").trim().toLowerCase();

    const attendee = (evt.attendees || []).find((a) => {
      // 1. Match by User ID
      if (userId && a.user && a.user.toString() === userId.toString()) return true;

      // 2. Match by Phone Number (Primary)
      if (cleanPhoneDigits) {
        const aDigits = (a.phone || "").replace(/\D/g, "");
        if (
          aDigits === cleanPhoneDigits ||
          (cleanPhoneDigits.length >= 6 && aDigits.endsWith(cleanPhoneDigits.slice(-6))) ||
          (aDigits.length >= 6 && cleanPhoneDigits.endsWith(aDigits.slice(-6)))
        ) {
          return true;
        }
      }

      // 3. Match by Email (Optional)
      if (cleanEmail && a.email && a.email.trim().toLowerCase() === cleanEmail) return true;

      return false;
    });

    const ticketId = attendee?._id
      ? `BDS-TKT-${attendee._id.toString().slice(-6).toUpperCase()}`
      : `BDS-TKT-${evt._id.toString().slice(-6).toUpperCase()}`;

    return {
      id: evt._id,
      slug: evt.slug,
      title: evt.title,
      description: evt.description,
      eventType: evt.eventType,
      category: evt.eventType || "Reunion",
      date: evt.date ? new Date(evt.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "TBA",
      rawDate: evt.date,
      time: evt.time || "09:00 AM - 05:00 PM",
      venue: evt.venue,
      locationMapUrl: evt.locationMapUrl,
      bannerImage: evt.bannerImage,
      fee: evt.fee,
      feeAmount: evt.feeAmount,
      organizer: evt.organizer,
      eventStatus: evt.status,
      ticketNo: ticketId,
      attendee: {
        id: attendee?._id,
        name: attendee?.name || "Member",
        phone: attendee?.phone,
        email: attendee?.email || "",
        batch: attendee?.batch,
        guestCount: attendee?.guestCount || 1,
        status: attendee?.status || "confirmed",
        paymentStatus: attendee?.paymentStatus || "paid",
        registeredAt: attendee?.registeredAt || evt.createdAt,
      },
      status: attendee?.status === "confirmed" ? "Confirmed Pass" : (attendee?.status || "Confirmed"),
    };
  });
};

module.exports = {
  getEventsService,
  getEventByIdService,
  createEventService,
  updateEventService,
  deleteEventService,
  registerAttendeeService,
  getMyEventsService,
};
