const mongoose = require("mongoose");

const FinancialRecordSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["income", "expense"],
      required: [true, "Record type (income or expense) is required"],
      index: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount must be a positive number"],
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sourceOrPayee: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "bKash", "Nagad", "Rocket", "Cheque", "SSLCommerz", "Other"],
      default: "Cash",
    },
    referenceId: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    recordedByName: {
      type: String,
      default: "Admin",
    },
    status: {
      type: String,
      enum: ["approved", "pending", "void"],
      default: "approved",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for date-range queries by type & status
FinancialRecordSchema.index({ date: 1, type: 1, status: 1 });

module.exports = mongoose.model("FinancialRecord", FinancialRecordSchema);
