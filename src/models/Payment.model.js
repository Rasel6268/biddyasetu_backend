const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    // User reference
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    membershipId: {
      type: String,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "BDT",
    },

    packageName: {
      type: String,
      required: true,
    },

    billingCycle: {
      type: String,
      enum: ["yearly", "lifetime"],
      required: true,
    },

    // Payment status
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "pending",
    },

    // SSLCommerz information
    sessionKey: {
      type: String,
      default: null,
    },

    valId: {
      type: String,
      default: null,
    },

    bankTransactionId: {
      type: String,
      default: null,
    },

    cardType: {
      type: String,
      default: null,
    },

    paymentGateway: {
      type: String,
      default: "SSLCommerz",
    },

    // Store SSLCommerz response if needed
    sslResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;