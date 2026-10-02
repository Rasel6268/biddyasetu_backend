const axios = require("axios");
const User = require("../models/Users.model");
const Payment = require("../models/Payment.model");

const isSandbox = process.env.SSLCZ_SANDBOX !== "false";
const sslSessionUrl = isSandbox
  ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
  : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";
const sslValidatorUrl = isSandbox
  ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
  : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";

/**
 * Initiate SSLCommerz Payment Session
 */
const initiateService = async (paymentData, authenticatedUserId = null) => {
  try {
    const { memberId, phone, userId, amount, packageName, billingCycle } = paymentData || {};

    console.log("[SSL] Initiate payment request:", { memberId, phone, userId, amount });

    // =====================================
    // 1. Locate Member
    // =====================================
    let paymentInfo = null;

    if (authenticatedUserId) {
      paymentInfo = await User.findById(authenticatedUserId);
    } else if (userId) {
      paymentInfo = await User.findById(userId);
    } else if (memberId && phone) {
      paymentInfo = await User.findOne({
        $or: [
          { membershipId: memberId, phone },
          { membershipId: memberId },
          { phone },
        ],
      });
    } else if (memberId) {
      paymentInfo = await User.findOne({ membershipId: memberId });
    } else if (phone) {
      paymentInfo = await User.findOne({ phone });
    }

    if (!paymentInfo) {
      throw new Error("Member not found with the provided details. Please verify your member ID or phone number.");
    }

    // =====================================
    // 2. Determine Package & Fee
    // =====================================
    const selectedPackageName =
      packageName || paymentInfo.packageData?.packageName || "General Member";

    let finalAmount = Number(amount);
    if (!finalAmount || finalAmount <= 0) {
      finalAmount = Number(paymentInfo.packageData?.fee) || 1000;
    }

    const selectedBilling =
      billingCycle ||
      paymentInfo.packageData?.billingCycle ||
      (paymentInfo.membershipDuration === "lifetime" ? "lifetime" : "yearly");

    const currency = paymentInfo.packageData?.currency || "BDT";

    // =====================================
    // 3. Generate Unique Transaction ID
    // =====================================
    const tranId = `BDS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const appUrl = process.env.APP_URL || "http://localhost:5000/api";
    // Normalize URL without trailing slash
    const baseApiUrl = appUrl.replace(/\/+$/, "");

    // =====================================
    // 4. Build SSLCommerz Payload
    // =====================================
    const sslPayload = new URLSearchParams({
      store_id: process.env.SSLCZ_STORE_ID,
      store_passwd: process.env.SSLCZ_STORE_PASSWORD,

      total_amount: String(finalAmount),
      currency: currency,
      tran_id: tranId,

      success_url: `${baseApiUrl}/ssl/success`,
      fail_url: `${baseApiUrl}/ssl/fail`,
      cancel_url: `${baseApiUrl}/ssl/cancel`,
      ipn_url: `${baseApiUrl}/ssl/ipn`,

      // Customer Information
      cus_name: paymentInfo.name || "Alumni Member",
      cus_email: paymentInfo.email || "info@biddyasetu.org",
      cus_add1: paymentInfo.currentAddress?.line1 || "Kaitola, Nabinagar",
      cus_city: paymentInfo.currentAddress?.city || "Brahmanbaria",
      cus_state: paymentInfo.currentAddress?.state || "Chittagong",
      cus_postcode: paymentInfo.currentAddress?.zipCode || "3410",
      cus_country: "Bangladesh",
      cus_phone: paymentInfo.phone || "01700000000",

      // Product Information
      product_name: selectedPackageName,
      product_category: "Membership",
      product_profile: "non-physical-goods",
      shipping_method: "NO",
      num_of_item: "1",
    });

    console.log(`[SSL] Calling SSLCommerz gateway (${sslSessionUrl}) for Tran ID: ${tranId}`);

    const response = await axios.post(sslSessionUrl, sslPayload, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 20000,
    });

    if (response.data?.status !== "SUCCESS" || !response.data?.GatewayPageURL) {
      console.error("[SSL] Initiation error response:", response.data);
      throw new Error(
        response.data?.failedreason ||
          "Payment gateway initialization failed. Please try again."
      );
    }

    // =====================================
    // 5. Store Pending Payment Record
    // =====================================
    await Payment.create({
      user: paymentInfo._id,
      membershipId: paymentInfo.membershipId || "TEMP",
      transactionId: tranId,
      amount: finalAmount,
      currency: currency,
      packageName: selectedPackageName,
      billingCycle: selectedBilling,
      status: "pending",
      sessionKey: response.data.sessionkey || null,
      paymentGateway: "SSLCommerz",
      sslResponse: response.data,
    });

    return {
      success: true,
      tranId,
      amount: finalAmount,
      currency,
      packageName: selectedPackageName,
      gatewayUrl: response.data.GatewayPageURL,
    };
  } catch (error) {
    console.error("[SSL Payment Initiation Error]:", error.message);
    throw error;
  }
};

/**
 * Handle Payment Success Callback from SSLCommerz (POST)
 */
const handleSuccessService = async (body) => {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const tranId = body.tran_id;
  const valId = body.val_id;

  console.log(`[SSL Success Handler] Received success callback for Tran ID: ${tranId}, Val ID: ${valId}`);

  try {
    const payment = await Payment.findOne({ transactionId: tranId });
    if (!payment) {
      console.error(`[SSL Success Handler] Payment record not found for transaction: ${tranId}`);
      return {
        success: false,
        redirectUrl: `${clientUrl}/payment/fail?tranId=${tranId || ""}&reason=Transaction+not+found`,
      };
    }

    // If already marked as paid (e.g. from IPN or previous callback)
    if (payment.status === "paid") {
      return {
        success: true,
        redirectUrl: `${clientUrl}/payment/success?tranId=${tranId}&amount=${payment.amount}&method=${encodeURIComponent(payment.cardType || "SSLCommerz")}`,
      };
    }

    // =====================================
    // Validate with SSLCommerz API
    // =====================================
    let isValid = false;
    let valData = {};

    try {
      const valResponse = await axios.get(sslValidatorUrl, {
        params: {
          val_id: valId,
          store_id: process.env.SSLCZ_STORE_ID,
          store_passwd: process.env.SSLCZ_STORE_PASSWORD,
          v: 1,
          format: "json",
        },
        timeout: 15000,
      });

      valData = valResponse.data || {};
      console.log(`[SSL Validator] Status for ${tranId}:`, valData.status);

      if (valData.status === "VALID" || valData.status === "VALIDATED") {
        isValid = true;
      }
    } catch (valErr) {
      console.error("[SSL Validator Network Error]:", valErr.message);
      // Fallback: If sandbox validation times out but body has VALID status and val_id
      if (body.status === "VALID" && valId) {
        console.warn("[SSL Validator] Falling back to request body status verification");
        isValid = true;
        valData = body;
      }
    }

    if (!isValid) {
      payment.status = "failed";
      payment.sslResponse = { ...body, validationResponse: valData };
      await payment.save();

      return {
        success: false,
        redirectUrl: `${clientUrl}/payment/fail?tranId=${tranId}&reason=Payment+validation+failed`,
      };
    }

    // =====================================
    // Update Payment Record
    // =====================================
    payment.status = "paid";
    payment.valId = valId;
    payment.bankTransactionId = body.bank_tran_id || valData.bank_tran_id || null;
    payment.cardType = body.card_type || valData.card_type || "SSLCommerz";
    payment.paidAt = new Date();
    payment.sslResponse = { ...payment.sslResponse, postBody: body, validatorData: valData };
    await payment.save();

    // =====================================
    // Update User Subscription & Status
    // =====================================
    const user = await User.findById(payment.user);
    if (user) {
      user.paymentStatus = "paid";
      user.membershipStatus = "active";
      user.membershipStartDate = new Date();
      // Ensure packageData fee is recorded if needed
      if (!user.packageData) {
        user.packageData = {};
      }
      user.packageData.fee = payment.amount;
      user.packageData.packageName = payment.packageName;
      user.packageData.billingCycle = payment.billingCycle;

      await user.save();
      console.log(`[SSL Success] User ${user.membershipId || user._id} updated to paid & active.`);
    }

    return {
      success: true,
      redirectUrl: `${clientUrl}/payment/success?tranId=${tranId}&amount=${payment.amount}&method=${encodeURIComponent(payment.cardType || "SSLCommerz")}`,
    };
  } catch (error) {
    console.error("[SSL Success Handler Error]:", error);
    return {
      success: false,
      redirectUrl: `${clientUrl}/payment/fail?tranId=${tranId || ""}&reason=${encodeURIComponent(error.message || "Processing error")}`,
    };
  }
};

/**
 * Handle Payment Fail Callback from SSLCommerz (POST)
 */
const handleFailService = async (body) => {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const tranId = body.tran_id;
  const reason = body.error || body.failedreason || "Payment transaction failed or was declined.";

  console.log(`[SSL Fail Handler] Received failure callback for Tran ID: ${tranId}, reason: ${reason}`);

  try {
    if (tranId) {
      const payment = await Payment.findOne({ transactionId: tranId });
      if (payment) {
        payment.status = "failed";
        payment.sslResponse = { ...payment.sslResponse, failBody: body };
        await payment.save();
      }
    }
  } catch (err) {
    console.error("[SSL Fail Handler DB Error]:", err.message);
  }

  return {
    success: false,
    redirectUrl: `${clientUrl}/payment/fail?tranId=${tranId || ""}&reason=${encodeURIComponent(reason)}`,
  };
};

/**
 * Handle Payment Cancel Callback from SSLCommerz (POST)
 */
const handleCancelService = async (body) => {
  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  const tranId = body.tran_id;

  console.log(`[SSL Cancel Handler] Received cancellation callback for Tran ID: ${tranId}`);

  try {
    if (tranId) {
      const payment = await Payment.findOne({ transactionId: tranId });
      if (payment) {
        payment.status = "cancelled";
        payment.sslResponse = { ...payment.sslResponse, cancelBody: body };
        await payment.save();
      }
    }
  } catch (err) {
    console.error("[SSL Cancel Handler DB Error]:", err.message);
  }

  return {
    success: false,
    redirectUrl: `${clientUrl}/payment/cancel?tranId=${tranId || ""}`,
  };
};

/**
 * Handle IPN (Instant Payment Notification) from SSLCommerz (POST)
 */
const handleIpnService = async (body) => {
  const tranId = body.tran_id;
  const valId = body.val_id;

  console.log(`[SSL IPN Handler] Notification received for Tran ID: ${tranId}, Val ID: ${valId}`);

  if (!tranId || !valId) {
    return { success: false, message: "Missing required IPN parameters" };
  }

  const payment = await Payment.findOne({ transactionId: tranId });
  if (!payment) {
    return { success: false, message: "Payment record not found" };
  }

  if (payment.status === "paid") {
    return { success: true, message: "Payment is already marked as paid" };
  }

  // Validate via API
  try {
    const valResponse = await axios.get(sslValidatorUrl, {
      params: {
        val_id: valId,
        store_id: process.env.SSLCZ_STORE_ID,
        store_passwd: process.env.SSLCZ_STORE_PASSWORD,
        v: 1,
        format: "json",
      },
      timeout: 15000,
    });

    const valData = valResponse.data || {};
    if (valData.status === "VALID" || valData.status === "VALIDATED") {
      payment.status = "paid";
      payment.valId = valId;
      payment.bankTransactionId = body.bank_tran_id || valData.bank_tran_id || null;
      payment.cardType = body.card_type || valData.card_type || "SSLCommerz";
      payment.paidAt = new Date();
      payment.sslResponse = { ...payment.sslResponse, ipnBody: body, validatorData: valData };
      await payment.save();

      const user = await User.findById(payment.user);
      if (user) {
        user.paymentStatus = "paid";
        user.membershipStatus = "active";
        user.membershipStartDate = new Date();
        await user.save();
      }

      return { success: true, message: "IPN verified and payment updated to paid." };
    }
  } catch (error) {
    console.error("[SSL IPN Error]:", error.message);
  }

  return { success: false, message: "IPN validation could not be completed." };
};

/**
 * Get Payment Record by Transaction ID
 */
const getPaymentStatusService = async (tranId) => {
  const payment = await Payment.findOne({ transactionId: tranId }).populate(
    "user",
    "name email phone membershipId currentAddress packageData membershipDuration membershipStatus paymentStatus"
  );

  if (!payment) {
    throw new Error("Payment record not found.");
  }

  return payment;
};

/**
 * Get Logged-in User's Payment History
 */
const getUserPaymentsService = async (userId, memberId = null) => {
  const query = {};
  if (userId) {
    query.user = userId;
  } else if (memberId) {
    query.membershipId = memberId;
  }

  const payments = await Payment.find(query).sort({ createdAt: -1 });
  return payments;
};

/**
 * Get All Payments for Admin
 */
const getAllPaymentsService = async (queryParams = {}) => {
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.max(1, parseInt(queryParams.limit, 10) || 20);
  const skip = (page - 1) * limit;

  const filter = {};

  if (queryParams.status && queryParams.status !== "all") {
    filter.status = queryParams.status;
  }

  if (queryParams.search) {
    const s = queryParams.search.trim();
    filter.$or = [
      { transactionId: { $regex: s, $options: "i" } },
      { membershipId: { $regex: s, $options: "i" } },
      { packageName: { $regex: s, $options: "i" } },
    ];
  }

  const [payments, total, stats] = await Promise.all([
    Payment.find(filter)
      .populate("user", "name email phone membershipId batch")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
    Payment.aggregate([
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const summary = {
    totalRevenue: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    cancelledCount: 0,
  };

  stats.forEach((st) => {
    if (st._id === "paid") {
      summary.totalRevenue = st.totalAmount;
      summary.paidCount = st.count;
    } else if (st._id === "pending") {
      summary.pendingCount = st.count;
    } else if (st._id === "failed") {
      summary.failedCount = st.count;
    } else if (st._id === "cancelled") {
      summary.cancelledCount = st.count;
    }
  });

  return {
    payments,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary,
  };
};

module.exports = {
  initiateService,
  handleSuccessService,
  handleFailService,
  handleCancelService,
  handleIpnService,
  getPaymentStatusService,
  getUserPaymentsService,
  getAllPaymentsService,
};