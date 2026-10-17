const galleryService = require("../services/gallery.service");

/**
 * Public: Get all gallery activities with filters and like status
 * GET /api/gallery
 */
const getGalleryItems = async (req, res, next) => {
  try {
    const currentUserId = req.user?._id || null;
    const result = await galleryService.getGalleryItems(req.query, currentUserId);
    res.status(200).json({
      success: true,
      data: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member / Admin: Upload new gallery activity
 * POST /api/gallery
 */
const createGalleryItem = async (req, res, next) => {
  try {
    const newActivity = await galleryService.createGalleryItem(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Activity photo uploaded successfully to alumni gallery!",
      data: newActivity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member: Toggle like on an activity
 * POST /api/gallery/:id/like
 */
const toggleLike = async (req, res, next) => {
  try {
    const result = await galleryService.toggleLike(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: result.isLiked ? "Activity liked!" : "Activity unliked",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member (author) or Admin: Delete activity
 * DELETE /api/gallery/:id
 */
const deleteGalleryItem = async (req, res, next) => {
  try {
    const result = await galleryService.deleteGalleryItem(req.params.id, req.user._id, req.user.role);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGalleryItems,
  createGalleryItem,
  toggleLike,
  deleteGalleryItem,
};
