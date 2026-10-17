const express = require("express");
const router = express.Router();
const {
  getGalleryItems,
  createGalleryItem,
  toggleLike,
  deleteGalleryItem,
} = require("../controllers/gallery.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");
const { verifyToken, COOKIE_NAME } = require("../utility/jwt.util");
const User = require("../models/Users.model");

/**
 * Optional auth middleware for public feed to detect if current viewer liked items
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.userId) {
        req.user = await User.findById(decoded.userId);
      }
    }
  } catch (err) {
    // Silently continue for optional auth
  }
  next();
};

// Public gallery feed (optional auth to attach isLiked flag)
router.get("/", optionalAuth, getGalleryItems);

// Admin-only: Upload new gallery activity
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  createGalleryItem
);

// Member: Toggle like on an activity (all logged-in members can like)
router.post("/:id/like", authMiddleware, toggleLike);

// Admin-only: Delete activity
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  deleteGalleryItem
);

module.exports = router;
