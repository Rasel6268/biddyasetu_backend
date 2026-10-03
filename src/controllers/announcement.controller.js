const {
  getAnnouncementsService,
  getAnnouncementByIdService,
  createAnnouncementService,
  updateAnnouncementService,
  deleteAnnouncementService,
} = require("../services/announcement.service");

/**
 * Get all announcements
 */
const getAnnouncements = async (req, res, next) => {
  try {
    const data = await getAnnouncementsService(req.query);
    return res.status(200).json({
      success: true,
      message: "Announcements retrieved successfully.",
      data: data.announcements,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single announcement
 */
const getAnnouncementById = async (req, res, next) => {
  try {
    const announcement = await getAnnouncementByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Announcement retrieved successfully.",
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create announcement (Admin only)
 */
const createAnnouncement = async (req, res, next) => {
  try {
    const creatorId = req.user ? req.user._id : null;
    const announcement = await createAnnouncementService(req.body, creatorId);
    return res.status(201).json({
      success: true,
      message: "Announcement created and published successfully.",
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update announcement (Admin only)
 */
const updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await updateAnnouncementService(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully.",
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete announcement (Admin only)
 */
const deleteAnnouncement = async (req, res, next) => {
  try {
    const result = await deleteAnnouncementService(req.params.id);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: { id: result.id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
