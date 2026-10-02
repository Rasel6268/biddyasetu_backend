const { verifyToken, COOKIE_NAME } = require("../utility/jwt.util");
const User = require("../models/Users.model");

/**
 * Authentication Middleware
 * Extracts token from cookie or Authorization header, verifies it, and attaches req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1. Try to read from HTTP-only cookie
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    }

    // 2. Fallback to Authorization Header (Bearer token)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in to continue.",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session. Please log in again.",
      });
    }

    // Find user in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

module.exports = { authMiddleware };
