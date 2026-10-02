const {
  initiateService,
  handleSuccessService,
  handleFailService,
  handleCancelService,
  handleIpnService,
  getPaymentStatusService,
  getUserPaymentsService,
  getAllPaymentsService,
} = require("../services/payment.service");

/**
 * Initiate SSL Payment
 * POST /api/ssl/init
 */
const initiateSSLPayment = async (req, res) => {
  try {
    const authenticatedUserId = req.user?._id || null;
    const result = await initiateService(req.body, authenticatedUserId);

    return res.status(200).json({
      success: true,
      message: "Payment session created successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[initiateSSLPayment]", error.message);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to initiate payment session.",
    });
  }
};

/**
 * SSL Success Callback (POST from SSLCommerz)
 * POST /api/ssl/success
 */
const sslSuccess = async (req, res) => {
  try {
    console.log("[sslSuccess] Body received:", req.body?.tran_id);
    const result = await handleSuccessService(req.body);
    return res.redirect(result.redirectUrl);
  } catch (error) {
    console.error("[sslSuccess Controller Error]:", error);
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
    return res.redirect(`${clientUrl}/payment/fail?reason=${encodeURIComponent(error.message || "Internal error")}`);
  }
};

/**
 * SSL Fail Callback (POST from SSLCommerz)
 * POST /api/ssl/fail
 */
const sslFail = async (req, res) => {
  try {
    console.log("[sslFail] Body received:", req.body?.tran_id);
    const result = await handleFailService(req.body);
    return res.redirect(result.redirectUrl);
  } catch (error) {
    console.error("[sslFail Controller Error]:", error);
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
    return res.redirect(`${clientUrl}/payment/fail?reason=Payment+Failed`);
  }
};

/**
 * SSL Cancel Callback (POST from SSLCommerz)
 * POST /api/ssl/cancel
 */
const sslCancel = async (req, res) => {
  try {
    console.log("[sslCancel] Body received:", req.body?.tran_id);
    const result = await handleCancelService(req.body);
    return res.redirect(result.redirectUrl);
  } catch (error) {
    console.error("[sslCancel Controller Error]:", error);
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
    return res.redirect(`${clientUrl}/payment/cancel`);
  }
};

/**
 * SSL IPN Webhook (POST from SSLCommerz Server)
 * POST /api/ssl/ipn
 */
const sslIpn = async (req, res) => {
  try {
    console.log("[sslIpn] Received IPN webhook:", req.body?.tran_id);
    const result = await handleIpnService(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[sslIpn Controller Error]:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Query Payment Status by Transaction ID
 * GET /api/ssl/status/:tranId
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { tranId } = req.params;
    const payment = await getPaymentStatusService(tranId);

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message || "Payment not found.",
    });
  }
};

/**
 * Get Logged-in User's Payment History
 * GET /api/ssl/my-payments
 */
const getMyPayments = async (req, res) => {
  try {
    const userId = req.user?._id;
    const memberId = req.query.memberId || req.user?.membershipId;

    const payments = await getUserPaymentsService(userId, memberId);

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve payment records.",
    });
  }
};

/**
 * Get All Payments (Admin)
 * GET /api/ssl/all
 */
const getAllPayments = async (req, res) => {
  try {
    const result = await getAllPaymentsService(req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve payments.",
    });
  }
};

module.exports = {
  initiateSSLPayment,
  sslSuccess,
  sslFail,
  sslCancel,
  sslIpn,
  getPaymentStatus,
  getMyPayments,
  getAllPayments,
};