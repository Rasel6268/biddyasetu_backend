const {
  getEventsService,
  getEventByIdService,
  createEventService,
  updateEventService,
  deleteEventService,
  registerAttendeeService,
  getMyEventsService,
} = require("../services/event.service");

/**
 * Get all events with filtering
 */
const getEvents = async (req, res, next) => {
  try {
    const data = await getEventsService(req.query);
    return res.status(200).json({
      success: true,
      message: "Events retrieved successfully.",
      data: data.events,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single event
 */
const getEventById = async (req, res, next) => {
  try {
    const event = await getEventByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Event details retrieved successfully.",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new event (Admin only)
 */
const createEvent = async (req, res, next) => {
  try {
    const creatorId = req.user ? req.user._id : null;
    const event = await createEventService(req.body, creatorId);
    return res.status(201).json({
      success: true,
      message: "Event created and published successfully.",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update event (Admin only)
 */
const updateEvent = async (req, res, next) => {
  try {
    const event = await updateEventService(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Event updated successfully.",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete event (Admin only)
 */
const deleteEvent = async (req, res, next) => {
  try {
    const result = await deleteEventService(req.params.id);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: { id: result.id },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register attendee / RSVP for an event
 */
const registerAttendee = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : (req.body?.userId || null);
    const result = await registerAttendeeService(req.params.id, req.body, userId);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        attendee: result.attendee,
        attendeeCount: result.event.attendees.filter((a) => a.status === "confirmed").length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's registered events and attendance tickets
 */
const getMyEvents = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : (req.query?.userId || null);
    const userPhone = req.user ? req.user.phone : (req.query?.phone || null);
    const userEmail = req.user ? req.user.email : (req.query?.email || null);

    const data = await getMyEventsService(userId, userPhone, userEmail);
    return res.status(200).json({
      success: true,
      message: "My events retrieved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerAttendee,
  getMyEvents,
};
