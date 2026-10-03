const Announcement = require("../models/Announcement.model");
const AppError = require("../utility/appError");

/**
 * Get all announcements with flexible search, filter, and pagination
 */
const getAnnouncementsService = async (query = {}) => {
  const {
    priority,
    category,
    status = "published",
    search,
    page = 1,
    limit = 20,
    sortBy = "date",
    sortOrder = "desc",
  } = query;

  const filter = {};

  if (status && status !== "all") {
    filter.status = status;
  }

  if (priority && priority !== "all") {
    filter.priority = priority;
  }

  if (category && category !== "all") {
    filter.category = category;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { title: { $regex: s, $options: "i" } },
      { content: { $regex: s, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  // Sort pinned first, then by date / createdAt
  const sort = { isPinned: -1, [sortBy]: sortOrder === "desc" ? -1 : 1 };

  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate("createdBy", "name email role")
      .lean({ virtuals: true }),
    Announcement.countDocuments(filter),
  ]);

  return {
    announcements,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get single announcement by ID
 */
const getAnnouncementByIdService = async (id) => {
  const announcement = await Announcement.findById(id).populate("createdBy", "name email role");
  if (!announcement) {
    throw new AppError("Announcement not found.", 404);
  }
  return announcement;
};

/**
 * Create new announcement
 */
const createAnnouncementService = async (payload, creatorId) => {
  const { title, content, priority, category, date, isPinned, status, link } = payload;

  if (!title || !title.trim()) {
    throw new AppError("Announcement title is required.", 400);
  }

  if (!content || !content.trim()) {
    throw new AppError("Announcement content is required.", 400);
  }

  const newAnnouncement = new Announcement({
    title: title.trim(),
    content: content.trim(),
    priority: priority || "Medium",
    category: category || "General",
    date: date ? new Date(date) : new Date(),
    isPinned: Boolean(isPinned),
    status: status || "published",
    link: link || "",
    createdBy: creatorId || null,
  });

  await newAnnouncement.save();
  return newAnnouncement;
};

/**
 * Update announcement
 */
const updateAnnouncementService = async (id, payload) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) {
    throw new AppError("Announcement not found.", 404);
  }

  Object.assign(announcement, payload);
  await announcement.save();
  return announcement;
};

/**
 * Delete announcement
 */
const deleteAnnouncementService = async (id) => {
  const announcement = await Announcement.findByIdAndDelete(id);
  if (!announcement) {
    throw new AppError("Announcement not found.", 404);
  }
  return { id, message: "Announcement deleted successfully." };
};

module.exports = {
  getAnnouncementsService,
  getAnnouncementByIdService,
  createAnnouncementService,
  updateAnnouncementService,
  deleteAnnouncementService,
};
