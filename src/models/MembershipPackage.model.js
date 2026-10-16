const mongoose = require("mongoose");

const membershipPackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      trim: true,
    },
    namebn: {
      type: String,
      trim: true,
      default: "",
    },
    fee: {
      type: Number,
      required: [true, "Membership fee amount is required"],
      min: [0, "Fee cannot be negative"],
    },
    currency: {
      type: String,
      default: "BDT",
      trim: true,
    },
    cycle: {
      type: String,
      enum: ["Annual", "One-time", "Monthly", "Quarterly", "Lifetime"],
      default: "Annual",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    benefits: {
      type: [String],
      default: [],
    },
    color: {
      type: String,
      enum: ["sky", "amber", "purple", "emerald", "rose"],
      default: "sky",
    },
    icon: {
      type: String,
      enum: ["users", "crown", "heart", "award", "star"],
      default: "users",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual id for frontend convenience
membershipPackageSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

membershipPackageSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    return ret;
  },
});

module.exports = mongoose.model("MembershipPackage", membershipPackageSchema);
