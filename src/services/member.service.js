const mongoose = require("mongoose");
const User = require("../models/Users.model");

class MemberService {
  /**
   * Get public active/verified members directory
   */
  async getPublicMembers(query = {}) {
    const {
      search,
      batch,
      profession,
      country,
      membership,
      bloodGroup,
      sortBy = "batch-desc",
      page = 1,
      limit = 100,
    } = query;

    const filter = {
      // Show active or registered members in directory
      membershipStatus: { $in: ["active", "pending"] },
    };

    if (batch) filter.batch = batch;
    if (profession) filter.profession = { $regex: profession, $options: "i" };
    if (country) filter["currentAddress.country"] = { $regex: country, $options: "i" };
    if (membership) filter.membership = { $regex: membership.replace(/\s+/g, "_"), $options: "i" };
    if (bloodGroup) filter.bloodGroup = bloodGroup;

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { nameBn: searchRegex },
        { profession: searchRegex },
        { organization: searchRegex },
        { batch: searchRegex },
        { membershipId: searchRegex },
        { "currentAddress.city": searchRegex },
        { "currentAddress.country": searchRegex },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sortBy === "batch-desc") sortOptions = { batch: -1, createdAt: -1 };
    if (sortBy === "batch-asc") sortOptions = { batch: 1, createdAt: -1 };
    if (sortBy === "name-asc") sortOptions = { name: 1 };
    if (sortBy === "name-desc") sortOptions = { name: -1 };

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [members, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort(sortOptions)
        .skip(skip)
        .limit(take)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      members,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        pages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Get all members for Admin Dashboard
   */
  async getAdminMembers(query = {}) {
    const {
      search,
      batch,
      status,
      membership,
      page = 1,
      limit = 200,
      sortBy = "createdAt-desc",
    } = query;

    const filter = {};

    if (batch && batch !== "ALL") filter.batch = batch;
    if (status && status !== "ALL") {
      if (status === "Verified" || status === "active") {
        filter.membershipStatus = "active";
      } else if (status === "Pending Approval" || status === "pending") {
        filter.membershipStatus = "pending";
      } else if (status === "Suspended" || status === "cancelled") {
        filter.membershipStatus = { $in: ["cancelled", "suspended"] };
      } else if (status === "Expired" || status === "expired") {
        filter.membershipStatus = "expired";
      } else {
        filter.membershipStatus = status;
      }
    }

    if (membership && membership !== "ALL") {
      filter.membership = { $regex: membership.replace(/\s+/g, "_"), $options: "i" };
    }

    if (search) {
      const s = { $regex: search, $options: "i" };
      filter.$or = [
        { name: s },
        { nameBn: s },
        { phone: s },
        { email: s },
        { membershipId: s },
        { profession: s },
        { organization: s },
        { batch: s },
      ];
    }

    let sort = { createdAt: -1 };
    if (sortBy === "name-asc") sort = { name: 1 };
    if (sortBy === "batch-desc") sort = { batch: -1, createdAt: -1 };

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [members, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(take)
        .lean(),
      User.countDocuments(filter),
    ]);

    return {
      members,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: take,
        pages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Get single member profile
   */
  async getMemberById(id) {
    return await User.findById(id).select("-password").lean();
  }

  /**
   * Get overall member statistics
   */
  async getMemberStats() {
    const [
      totalMembers,
      activeMembers,
      pendingMembers,
      suspendedMembers,
      lifeMembers,
      generalMembers,
      donorMembers,
      bloodDonors,
      distinctBatches,
      distinctCountries,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ membershipStatus: "active" }),
      User.countDocuments({ membershipStatus: "pending" }),
      User.countDocuments({ membershipStatus: { $in: ["cancelled", "suspended"] } }),
      User.countDocuments({ membership: { $regex: "life", $options: "i" } }),
      User.countDocuments({ membership: { $regex: "general", $options: "i" } }),
      User.countDocuments({ membership: { $regex: "donor|patron", $options: "i" } }),
      User.countDocuments({ bloodGroup: { $ne: null, $nin: ["", null] } }),
      User.distinct("batch"),
      User.distinct("currentAddress.country"),
    ]);

    return {
      totalMembers,
      activeMembers,
      pendingMembers,
      suspendedMembers,
      lifeMembers,
      generalMembers,
      donorMembers,
      bloodDonors,
      batchesCount: distinctBatches.filter(Boolean).length,
      countriesCount: distinctCountries.filter(Boolean).length,
    };
  }

  /**
   * Update member status (e.g., approve / suspend / activate)
   */
  async updateMemberStatus(id, { membershipStatus, paymentStatus, role, membership }) {
    const update = {};
    if (membershipStatus) update.membershipStatus = membershipStatus;
    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (role) update.role = role;
    if (membership) update.membership = membership;

    return await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select("-password")
      .lean();
  }

  /**
   * Update full member profile
   */
  async updateMember(id, updateData) {
    // Prevent updating password through this method
    delete updateData.password;

    return await User.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
      .select("-password")
      .lean();
  }

  /**
   * Delete member by ID
   */
  async deleteMember(id) {
    return await User.findByIdAndDelete(id);
  }
}

module.exports = new MemberService();
