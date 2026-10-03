const express = require("express");
const router = express.Router();
const {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  registerAttendee,
  getMyEvents,
} = require("../controllers/event.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// Optional auth helper: if token is present, populate req.user, else continue
const optionalAuth = async (req, res, next) => {
  try {
    const { verifyToken, COOKIE_NAME } = require("../utility/jwt.util");
    const User = require("../models/Users.model");

    let token = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        req.user = await User.findById(decoded.userId);
      }
    }
  } catch (e) {
    // Ignore invalid token for optional auth
  }
  next();
};

// ─── Protected User Routes ───
router.get("/my-events", optionalAuth, getMyEvents);

// ─── Public Routes ───
router.get("/", getEvents);
router.get("/:id", getEventById);
router.post("/:id/register", optionalAuth, registerAttendee);

// ─── Protected Admin Routes ───
router.post("/", authMiddleware, authorizeRoles("admin", "superadmin"), createEvent);
router.put("/:id", authMiddleware, authorizeRoles("admin", "superadmin"), updateEvent);
router.delete("/:id", authMiddleware, authorizeRoles("admin", "superadmin"), deleteEvent);

module.exports = router;
