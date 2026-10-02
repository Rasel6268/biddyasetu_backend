const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  registerController,
  loginController,
  authMe,
  payMembershipController,
  logoutController,
  updateProfileController,
  changePasswordController,
} = require("../controllers/auth.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// Rate limiting for auth sensitive operations (Login / Register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts from this IP. Please try again in 15 minutes.",
  },
});

// Public Auth Routes
router.post("/register", authLimiter, registerController);
router.post("/login", authLimiter, loginController);
router.post("/logout", logoutController);

// Protected Auth Routes
router.get("/auth_me", authMiddleware, authMe);
router.get("/me", authMiddleware, authMe);
router.post("/pay-membership", authMiddleware, payMembershipController);
router.put("/update-profile", authMiddleware, updateProfileController);
router.put("/change-password", authMiddleware, changePasswordController);

module.exports = router;