const MembershipPackage = require("../models/MembershipPackage.model");
const User = require("../models/Users.model");
const AppError = require("../utility/appError");

const defaultPackagesSeed = [
  {
    name: "General Member",
    namebn: "সাধারণ সদস্য",
    fee: 1000,
    cycle: "Annual",
    description:
      "Standard annual membership for all verified alumni of Adarsha High School, Kaitola. Includes access to alumni directory, event participation, and voting rights in AGM.",
    benefits: [
      "Alumni Directory Access",
      "Event Participation",
      "AGM Voting Rights",
      "Community Forum Access",
      "Digital Membership Card",
    ],
    color: "sky",
    icon: "users",
    isActive: true,
    order: 1,
  },
  {
    name: "Life Member",
    namebn: "আজীবন সদস্য",
    fee: 20000,
    cycle: "One-time",
    description:
      "Pay ৳20,000 (equivalent to 20 years of annual fees) once and become a permanent life member. Receive an official Life Membership Certificate and badge.",
    benefits: [
      "All General Member Benefits",
      "Life Membership Certificate",
      "Permanent Member Status",
      "Priority Event Seating",
      "Executive Meeting Access",
      "Special Recognition on Website",
    ],
    color: "amber",
    icon: "crown",
    isActive: true,
    order: 2,
  },
  {
    name: "Patron / Donor Member",
    namebn: "পৃষ্ঠপোষক সদস্য",
    fee: 50000,
    cycle: "One-time",
    description:
      "For distinguished alumni who wish to contribute significantly to Biddyasetu's welfare fund. Includes all Life Member privileges plus exclusive Patron honors.",
    benefits: [
      "All Life Member Benefits",
      "Patron Honor Roll Recognition",
      "School Naming Opportunity (Labs, Library)",
      "Annual Report Acknowledgment",
      "Exclusive Patron Events & Dinners",
      "Advisory Board Eligibility",
    ],
    color: "purple",
    icon: "heart",
    isActive: true,
    order: 3,
  },
];

class MembershipPackageService {
  /**
   * Seed default packages if database collection is empty
   */
  async ensureSeedDefaults() {
    const count = await MembershipPackage.countDocuments();
    if (count === 0) {
      await MembershipPackage.insertMany(defaultPackagesSeed);
    }
  }

  /**
   * Public: Get all active membership packages
   */
  async getActivePackages() {
    await this.ensureSeedDefaults();
    return MembershipPackage.find({ isActive: true }).sort({ order: 1, fee: 1, createdAt: 1 });
  }

  /**
   * Admin: Get all membership packages including inactive ones
   */
  async getAllPackages() {
    await this.ensureSeedDefaults();
    return MembershipPackage.find().sort({ order: 1, fee: 1, createdAt: 1 });
  }

  /**
   * Get single package by ID
   */
  async getPackageById(id) {
    const pkg = await MembershipPackage.findById(id);
    if (!pkg) {
      throw new AppError("Membership package not found.", 404);
    }
    return pkg;
  }

  /**
   * Create new membership package
   */
  async createPackage(data) {
    const { name, namebn, fee, cycle, description, benefits, color, icon, isActive, order } = data;

    if (!name || !name.trim()) {
      throw new AppError("Package name is required.", 400);
    }

    if (fee === undefined || fee === null || Number(fee) < 0) {
      throw new AppError("A valid membership fee amount is required.", 400);
    }

    // Format benefits array if passed as comma-separated string
    let resolvedBenefits = [];
    if (Array.isArray(benefits)) {
      resolvedBenefits = benefits.map((b) => String(b).trim()).filter(Boolean);
    } else if (typeof benefits === "string") {
      resolvedBenefits = benefits
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
    }

    const newPackage = new MembershipPackage({
      name: name.trim(),
      namebn: namebn ? namebn.trim() : "",
      fee: Number(fee),
      currency: "BDT",
      cycle: cycle || "Annual",
      description: description ? description.trim() : "",
      benefits: resolvedBenefits,
      color: color || "sky",
      icon: icon || "users",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      order: order ? Number(order) : 0,
    });

    await newPackage.save();
    return newPackage;
  }

  /**
   * Update existing membership package
   */
  async updatePackage(id, data) {
    const pkg = await MembershipPackage.findById(id);
    if (!pkg) {
      throw new AppError("Membership package not found.", 404);
    }

    const { name, namebn, fee, cycle, description, benefits, color, icon, isActive, order } = data;

    if (name !== undefined) {
      if (!name.trim()) throw new AppError("Package name cannot be empty.", 400);
      pkg.name = name.trim();
    }

    if (namebn !== undefined) {
      pkg.namebn = namebn.trim();
    }

    if (fee !== undefined) {
      if (Number(fee) < 0) throw new AppError("Fee cannot be negative.", 400);
      pkg.fee = Number(fee);
    }

    if (cycle !== undefined) {
      pkg.cycle = cycle;
    }

    if (description !== undefined) {
      pkg.description = description.trim();
    }

    if (benefits !== undefined) {
      if (Array.isArray(benefits)) {
        pkg.benefits = benefits.map((b) => String(b).trim()).filter(Boolean);
      } else if (typeof benefits === "string") {
        pkg.benefits = benefits
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);
      }
    }

    if (color !== undefined) {
      pkg.color = color;
    }

    if (icon !== undefined) {
      pkg.icon = icon;
    }

    if (isActive !== undefined) {
      pkg.isActive = Boolean(isActive);
    }

    if (order !== undefined) {
      pkg.order = Number(order);
    }

    await pkg.save();

    // Automatically synchronize members assigned to this package with the updated dynamic fee
    if (fee !== undefined && pkg.name) {
      try {
        const pkgName = pkg.name.trim();
        const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const isYearlyOrGeneral =
          (pkg.cycle || "").toLowerCase() === "annual" ||
          (pkg.cycle || "").toLowerCase() === "yearly" ||
          /general/i.test(pkgName);

        let targetCondition;

        if (isYearlyOrGeneral) {
          // Updates all general members / yearly membership members (including previous yearly payers for upcoming dues/renewal)
          // Lifetime, Donor, and Patron members are explicitly excluded ("other will same")
          targetCondition = {
            $and: [
              {
                $or: [
                  { "packageData.packageName": pkgName },
                  { "packageData.packageName": { $regex: new RegExp(`^${escaped}$`, "i") } },
                  { "packageData.packageName": { $regex: /general/i } },
                  { membership: "general_member" },
                  { membership: { $regex: /general/i } },
                  { membershipDuration: "yearly" },
                ],
              },
              {
                // Exclude lifetime / donor / patron members so their status and packages remain untouched
                membershipDuration: { $ne: "lifetime" },
                membership: { $not: { $regex: /life|patron|donor|doner/i } },
                "packageData.packageName": { $not: { $regex: /life|patron|donor|doner/i } },
              },
            ],
          };
        } else {
          // For Life Member, Patron / Donor, or other specific packages:
          // Only update users who are explicitly enrolled in this specific package
          targetCondition = {
            $or: [
              { "packageData.packageName": pkgName },
              { "packageData.packageName": { $regex: new RegExp(`^${escaped}$`, "i") } },
            ],
          };
        }

        const updateResult = await User.updateMany(
          targetCondition,
          {
            $set: {
              "packageData.fee": Number(pkg.fee),
              "packageData.packageName": pkg.name,
              "packageData.currency": pkg.currency || "BDT",
              "packageData.billingCycle": pkg.cycle ? pkg.cycle.toLowerCase() : (isYearlyOrGeneral ? "yearly" : "lifetime"),
            },
          }
        );
        console.log(`[MembershipPackageService] Updated dynamic fee to ৳${pkg.fee} for ${updateResult.modifiedCount} members (${pkgName}).`);
      } catch (syncErr) {
        console.warn("[MembershipPackageService] Failed to sync members fee:", syncErr.message);
      }
    }

    return pkg;
  }

  /**
   * Toggle package active / inactive status
   */
  async togglePackageStatus(id) {
    const pkg = await MembershipPackage.findById(id);
    if (!pkg) {
      throw new AppError("Membership package not found.", 404);
    }

    pkg.isActive = !pkg.isActive;
    await pkg.save();
    return pkg;
  }

  /**
   * Delete membership package
   */
  async deletePackage(id) {
    const pkg = await MembershipPackage.findById(id);
    if (!pkg) {
      throw new AppError("Membership package not found.", 404);
    }

    await MembershipPackage.findByIdAndDelete(id);
    return { success: true, message: `Package "${pkg.name}" deleted successfully.` };
  }
}

module.exports = new MembershipPackageService();
