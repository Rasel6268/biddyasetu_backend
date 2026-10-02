const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define enums as constants
const UserRole = ["admin", "member"];
const GenderType = ["male", "female", "other"];
const MemberType = ["general_member", "donor_member", "life_member"];
const MembershipTime = ["yearly", "lifetime"];
const MembershipStatus = ["pending", "active", "expired", "cancelled"];
const PaymentStatus = ["unpaid", "paid", "pending", "failed"];

const userSchema = new mongoose.Schema(
  {
    // Personal Information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: UserRole,
      default: "member",
    },
    profileImage: {
      type: String,
      default: null,
    },
    gender: {
      type: String,
      enum: GenderType,
      default: "male",
    },
    dateOfBirth: {
      type: String,
      default: "",
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "A−", "B−", "AB−", "O−", null, ""],
      default: null,
    },
    batch: {
      type: String,
      default: "",
    },

    // Current Address (US/International or Local)
    currentAddress: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: null },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      zipCode: { type: String, trim: true, default: "" },
      country: { type: String, default: "Bangladesh", trim: true },
    },

    // Permanent Address (Bangladesh)
    permanentAddress: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: null },
      upozilla: { type: String, trim: true, default: "" },
      zilla: { type: String, trim: true, default: "" },
      division: {
        type: String,
        enum: [
          "Dhaka Division",
          "Chittagong Division",
          "Rajshahi Division",
          "Khulna Division",
          "Barishal Division",
          "Sylhet Division",
          "Rangpur Division",
          "Mymensingh Division",
          "",
          null,
        ],
        default: null,
      },
      postCode: { type: String, trim: true, default: "" },
      country: { type: String, default: "Bangladesh", trim: true },
    },

    // Professional Information
    profession: {
      type: String,
      trim: true,
      default: "",
    },
    organization: {
      type: String,
      trim: true,
      default: null,
    },

    // Membership & Subscription Information
    membership: {
      type: String,
      default: "general_member",
    },
    membershipId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    membershipDuration: {
      type: String,
      enum: MembershipTime,
      default: "yearly",
    },
    membershipStartDate: {
      type: Date,
      default: Date.now,
    },
    membershipEndDate: {
      type: Date,
      default: null,
    },
    membershipStatus: {
      type: String,
      enum: MembershipStatus,
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: PaymentStatus,
      default: "unpaid",
    },
    packageData: {
      packageName: { type: String, default: "General Member" },
      fee: { type: Number, default: 1000 },
      currency: { type: String, default: "BDT" },
      billingCycle: { type: String, default: "yearly" },
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    nameBn: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);


// Pre-save middleware to generate membershipId if not present
userSchema.pre("save", async function () {
  if (!this.membershipId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model("User").countDocuments();
    this.membershipId = `BDS-${year}-${String(count + 1).padStart(4, "0")}`;
  }
});

// Pre-save middleware to set membership duration and end date
// Membership period is fixed: January 1 – December 31 of the payment year.
userSchema.pre("save", function () {
  const normMembership = (this.membership || "").toLowerCase();

  // Normalize duration based on tier
  if (normMembership.includes("life")) {
    this.membershipDuration = "lifetime";
    this.packageData = {
      packageName: "Life Member",
      fee: 20000,
      currency: "BDT",
      billingCycle: "lifetime",
    };
  } else if (normMembership.includes("donor") || normMembership.includes("doner") || normMembership.includes("patron")) {
    this.membershipDuration = "lifetime";
    this.packageData = {
      packageName: "Patron / Donor Member",
      fee: 20000,
      currency: "BDT",
      billingCycle: "lifetime",
    };
  } else {
    this.membershipDuration = "yearly";
    this.packageData = {
      packageName: "General Member",
      fee: 1000,
      currency: "BDT",
      billingCycle: "yearly",
    };
  }

  // Ensure a start date exists
  if (!this.membershipStartDate) {
    this.membershipStartDate = new Date();
  }

  // Calculate membership end date if not set or if start/duration changed
  if (!this.membershipEndDate || this.isModified("membershipStartDate") || this.isModified("membershipDuration")) {
    const startDate = new Date(this.membershipStartDate);

    if (this.membershipDuration === "lifetime") {
      const d = new Date(startDate);
      d.setFullYear(d.getFullYear() + 100);
      this.membershipEndDate = d;
    } else {
      // Yearly membership: fixed period January 1 – December 31 of the payment year.
      // Valid from the date of payment until December 31 of the same year.
      const paymentYear = startDate.getFullYear();
      this.membershipDuration = "yearly";
      // End date = December 31, 23:59:59.999 of the payment year
      this.membershipEndDate = new Date(paymentYear, 11, 31, 23, 59, 59, 999);
    }
  }
});

// Instance method to check and update subscription expiry for yearly members
// After December 31 of the payment year, paymentStatus becomes unpaid
// and membershipStatus becomes expired.
userSchema.methods.checkSubscriptionExpiry = function () {
  if (this.membershipDuration === "yearly" && this.membershipEndDate) {
    const now = new Date();
    if (now > new Date(this.membershipEndDate)) {
      if (this.paymentStatus !== "unpaid" || this.membershipStatus !== "expired") {
        this.paymentStatus = "unpaid";
        this.membershipStatus = "expired";
        return true;
      }
    }
  }
  return false;
};

// Instance method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get full current address
userSchema.methods.getFullCurrentAddress = function () {
  if (!this.currentAddress) return "";
  const { line1, line2, city, state, zipCode, country } = this.currentAddress;
  return `${line1 || ""}${line2 ? ", " + line2 : ""}${city ? ", " + city : ""}${state ? ", " + state : ""} ${zipCode || ""}, ${country || ""}`.trim();
};

// Instance method to get full permanent address
userSchema.methods.getFullPermanentAddress = function () {
  if (!this.permanentAddress) return "";
  const { line1, line2, upozilla, zilla, division, postCode, country } = this.permanentAddress;
  return `${line1 || ""}${line2 ? ", " + line2 : ""}${upozilla ? ", " + upozilla : ""}${zilla ? ", " + zilla : ""}${division ? ", " + division : ""} - ${postCode || ""}, ${country || ""}`.trim();
};

// Static method to find by phone
userSchema.statics.findByPhone = function (phone) {
  return this.findOne({ phone });
};

// Static method to find by email (if provided)
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// Safely transform JSON outputs so password is never leaked
userSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

userSchema.set("toObject", {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;