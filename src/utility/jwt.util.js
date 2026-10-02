const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "biddyasetu-jwt-secret-key-production-2026";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const COOKIE_NAME = process.env.COOKIE_NAME || "biddyasetu_token";

/**
 * Generate a JWT token for a user
 * @param {Object} user - User document or payload
 * @returns {string} Signed JWT token
 */
const generateToken = (user) => {
  const payload = {
    userId: user._id || user.id,
    role: user.role || "member",
    phone: user.phone,
    email: user.email,
    membershipId: user.membershipId,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token string
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Send token in HTTP-only secure cookie and return cookie options
 * @param {Object} res - Express response object
 * @param {string} token - Signed JWT token
 */
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  
  // 7 days in milliseconds (matching JWT_EXPIRES_IN)
  const maxAge = 7 * 24 * 60 * 60 * 1000;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: maxAge,
    path: "/",
  });
};

/**
 * Clear the auth cookie on logout
 * @param {Object} res - Express response object
 */
const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
  });
};

module.exports = {
  generateToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
};
