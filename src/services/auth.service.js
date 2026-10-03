const User = require("../models/Users.model");
const { generateToken } = require("../utility/jwt.util");
const AppError = require("../utility/appError");

/**
 * Known country dial codes to strip from the beginning of phone numbers.
 * Ordered longest-first so "880" matches before "88" or "8".
 */
const DIAL_CODES = [
  "880", // Bangladesh
  "971", // UAE
  "966", // Saudi Arabia
  "974", // Qatar
  "977", // Nepal
  "92",  // Pakistan
  "94",  // Sri Lanka
  "91",  // India
  "44",  // UK
  "49",  // Germany
  "61",  // Australia
  "86",  // China
  "81",  // Japan
  "82",  // South Korea
  "65",  // Singapore
  "60",  // Malaysia
  "1",   // USA / Canada
];

/**
 * Clean phone number:
 *  - Remove spaces, dashes, parentheses
 *  - Remove leading '+'
 *  - Strip known country dial code prefix (e.g. 880, 88, 91, 1)
 *  - Return only the local digits
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return "";

  // 1. Remove non-digits except a leading '+'
  let cleaned = String(phone).replace(/[\s\-()]/g, "").replace(/^\+/, "").trim();

  // 2. Remove any remaining non-digit characters
  cleaned = cleaned.replace(/\D/g, "");

  // 3. Strip known dial codes (longest first)
  for (const code of DIAL_CODES) {
    if (cleaned.startsWith(code) && cleaned.length > code.length + 5) {
      cleaned = cleaned.slice(code.length);
      break;
    }
  }

  // 4. Bangladesh special case: some users write "88" instead of "880"
  if (cleaned.startsWith("88") && cleaned.length > 7) {
    cleaned = cleaned.slice(2);
  }

  return cleaned;
};

/**
 * Register Service (Passwordless)
 * Creates a new member account using only phone number
 * Phone is stored WITHOUT country code
 */
const registerService = async (data) => {
  const payload = data.formData ? data.formData : data;

  const {
    name,
    fullName,
    email,
    phone,
    profileImage,
    gender,
    dateOfBirth,
    bloodGroup,
    batch,
    profession,
    organization,
    currentAddress,
    permanentAddress,
    membership,
    membershipTier,
    selectedTier,
    membershipDuration,
  } = payload;

  const resolvedName = (name || fullName || "").trim();
  if (!resolvedName) {
    throw new AppError("Full name is required.", 400);
  }

  const cleanPhone = cleanPhoneNumber(phone);

  if (!cleanPhone || cleanPhone.length < 6) {
    throw new AppError("A valid phone number is required.", 400);
  }

  // Check if phone number is already registered
  const existingPhoneUser = await User.findOne({ phone: cleanPhone });
  if (existingPhoneUser) {
    throw new AppError(
      "This phone number is already registered. Please login instead.",
      400
    );
  }

  // Clean email
  const cleanEmail =
    email && typeof email === "string" && email.trim().length > 0
      ? email.trim().toLowerCase()
      : null;

  if (cleanEmail) {
    const existingEmailUser = await User.findOne({ email: cleanEmail });
    if (existingEmailUser) {
      throw new AppError("This email address is already registered.", 400);
    }
  }

  // Determine initial role (admin if configured in environment)
  const adminEmail = process.env.ADMIN_EMAIL
    ? process.env.ADMIN_EMAIL.toLowerCase()
    : null;
  const initialRole =
    cleanEmail && adminEmail && cleanEmail === adminEmail ? "admin" : "member";

  // Normalize chosen membership tier
  const rawTier = (membershipTier || selectedTier || membership || "general_member").toLowerCase();
  let normalizedMembership = "general_member";
  let resolvedDuration = membershipDuration || "yearly";
  let resolvedPackageData = {
    packageName: "General Member",
    fee: 1000,
    currency: "BDT",
    billingCycle: "yearly",
  };

  if (rawTier.includes("life")) {
    normalizedMembership = "life_member";
    resolvedDuration = "lifetime";
    resolvedPackageData = {
      packageName: "Life Member",
      fee: 20000,
      currency: "BDT",
      billingCycle: "lifetime",
    };
  } else if (rawTier.includes("patron") || rawTier.includes("donor")) {
    normalizedMembership = "patron_member";
    resolvedDuration = "lifetime";
    resolvedPackageData = {
      packageName: "Patron Member",
      fee: 20000,
      currency: "BDT",
      billingCycle: "lifetime",
    };
  }

  // Build user object (No password, phone stored WITHOUT country code)
  const newUser = new User({
    name: resolvedName,
    email: cleanEmail,
    phone: cleanPhone, // ← local number only
    profileImage: profileImage || null,
    role: initialRole,
    gender: gender ? gender.toLowerCase() : "male",
    dateOfBirth: dateOfBirth || "",
    bloodGroup: bloodGroup || null,
    batch: batch || "",
    profession: profession || "",
    organization: organization || null,
    currentAddress: currentAddress || {},
    permanentAddress: permanentAddress || {},
    membership: normalizedMembership,
    membershipDuration: resolvedDuration,
    packageData: resolvedPackageData,
    membershipStatus: "pending",
    paymentStatus: "unpaid",
    membershipStartDate: new Date(),
  });

  await newUser.save();

  const token = generateToken(newUser);

  return {
    user: newUser.toJSON(),
    token,
  };
};

/**
 * Login Service (Passwordless)
 * Authenticates user with phone number only
 */
const loginService = async ({ identifier, phone, email }) => {
  const rawIdentifier = (identifier || phone || email || "").trim();

  if (!rawIdentifier) {
    throw new AppError(
      "Please enter your registered phone number or email.",
      400
    );
  }

  const cleanPhone = cleanPhoneNumber(rawIdentifier);

  // Find user by phone (cleaned) or by email
  const user = await User.findOne({
    $or: [{ phone: cleanPhone }, { email: rawIdentifier.toLowerCase() }],
  });

  if (!user) {
    throw new AppError(
      "No account found with this phone number or email.",
      401
    );
  }

  if (user.membershipStatus === "cancelled") {
    throw new AppError(
      "Your account has been deactivated. Please contact support.",
      403
    );
  }

  if (user.checkSubscriptionExpiry()) {
    await user.save();
  }

  const token = generateToken(user);

  return {
    user: user.toJSON(),
    token,
  };
};

/**
 * Auth Me Service
 */
const authMeService = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);
  if (user.checkSubscriptionExpiry()) await user.save();
  return user.toJSON();
};

/**
 * Pay Membership / Activate Subscription Service
 */
const payMembershipService = async (
  userId,
  { paymentMethod, transactionId, amount, membershipTier }
) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);

  if (membershipTier) {
    user.membership = membershipTier.toLowerCase().replace(/ /g, "_");
  }

  user.paymentStatus = "paid";
  user.membershipStatus = "active";
  user.membershipStartDate = new Date();

  await user.save();
  return user.toJSON();
};

/**
 * Update Profile Service
 */
const updateProfileService = async (userId, updateData) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError("User not found.", 404);

  const allowedFields = [
    "name",
    "nameBn",
    "gender",
    "dateOfBirth",
    "bloodGroup",
    "batch",
    "profession",
    "organization",
    "currentAddress",
    "permanentAddress",
    "bio",
    "profileImage",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      user[field] = updateData[field];
    }
  });

  if (updateData.email !== undefined) {
    const cleanEmail = updateData.email
      ? updateData.email.trim().toLowerCase()
      : null;
    if (cleanEmail && cleanEmail !== user.email) {
      const existing = await User.findOne({
        email: cleanEmail,
        _id: { $ne: userId },
      });
      if (existing) {
        throw new AppError(
          "This email is already in use by another account.",
          400
        );
      }
      user.email = cleanEmail;
    } else if (!cleanEmail) {
      user.email = null;
    }
  }

  await user.save();
  return user.toJSON();
};

module.exports = {
  registerService,
  loginService,
  authMeService,
  payMembershipService,
  updateProfileService,
};