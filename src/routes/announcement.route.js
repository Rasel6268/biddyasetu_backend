const express = require("express");
const router = express.Router();
const {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcement.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// Public Routes
router.get("/", getAnnouncements);
router.get("/:id", getAnnouncementById);

// Protected Admin Routes
router.post("/", authMiddleware, authorizeRoles("admin", "superadmin"), createAnnouncement);
router.put("/:id", authMiddleware, authorizeRoles("admin", "superadmin"), updateAnnouncement);
router.delete("/:id", authMiddleware, authorizeRoles("admin", "superadmin"), deleteAnnouncement);

module.exports = router;
