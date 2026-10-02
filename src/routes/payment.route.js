const express = require("express");
const router = express.Router();
const {
  initiateSSLPayment,
  sslSuccess,
  sslFail,
  sslCancel,
  sslIpn,
  getPaymentStatus,
  getMyPayments,
  getAllPayments,
} = require("../controllers/payment.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// =====================================
// Public / Semi-public Gateway Endpoints
// =====================================

// Initiate SSLCommerz Payment Session
router.post("/init", initiateSSLPayment);

// SSLCommerz Gateway Return URL Handlers (SSLCommerz POSTs form data here)
router.post("/success", sslSuccess);
router.post("/fail", sslFail);
router.post("/cancel", sslCancel);
router.post("/ipn", sslIpn);

// Query Single Payment Status by Transaction ID (Used by Success Receipt / Confirmation Page)
router.get("/status/:tranId", getPaymentStatus);

// =====================================
// Protected Member Endpoints
// =====================================

// Get member's payment history (Supports both authenticated token and query memberId)
router.get("/my-payments", (req, res, next) => {
  // If authorization header or cookie is present, apply authMiddleware
  if (req.headers.authorization || (req.cookies && req.cookies.biddyasetu_token)) {
    return authMiddleware(req, res, next);
  }
  next();
}, getMyPayments);

// =====================================
// Admin Endpoints
// =====================================

// Get all payment records with filters & summary statistics
router.get("/all", authMiddleware, authorizeRoles("admin"), getAllPayments);

module.exports = router;