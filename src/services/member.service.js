const mongoose = require("mongoose");
const User = require("../models/Users.model");
const Payment = require("../models/Payment.model");
const Event = require("../models/Event.model");
const Announcement = require("../models/Announcement.model");
const Gallery = require("../models/Gallery.model");

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
        { fatherName: searchRegex },
        { nidNumber: searchRegex },
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
        { fatherName: s },
        { nidNumber: s },
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

  /**
   * Dynamic Admin Dashboard Statistics, Pending Queue & Recent Transactions
   */
  async getDashboardOverview() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalAlumni,
      registrationsThisMonth,
      pendingApprovalsCount,
      activeMembersCount,
      totalEventsCount,
      totalActivitiesCount,
      totalAnnouncementsCount,
      totalRevenueAgg,
      monthRevenueAgg,
      urgentPendingMembers,
      recentPayments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ membershipStatus: "pending" }),
      User.countDocuments({ membershipStatus: "active" }),
      Event.countDocuments(),
      Gallery.countDocuments(),
      Announcement.countDocuments(),
      Payment.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            status: "paid",
            $or: [
              { paidAt: { $gte: startOfMonth } },
              { createdAt: { $gte: startOfMonth } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      User.find({ membershipStatus: "pending" })
        .select("name batch phone email profession membership createdAt membershipId")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      Payment.find()
        .populate("user", "name email phone batch membershipId")
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const revenueThisMonth = monthRevenueAgg[0]?.total || 0;

    return {
      kpi: {
        totalAlumni,
        registrationsThisMonth,
        pendingApprovals: pendingApprovalsCount,
        activeMembers: activeMembersCount,
        totalRevenue,
        revenueThisMonth,
        totalEvents: totalEventsCount,
        totalActivities: totalActivitiesCount,
        totalAnnouncements: totalAnnouncementsCount,
      },
      urgentPendingMembers: urgentPendingMembers.map((m) => ({
        id: m._id,
        membershipId: m.membershipId || "Pending",
        name: m.name,
        batch: m.batch || "Alumni",
        phone: m.phone,
        email: m.email,
        profession: m.profession || "General Member",
        joinedDate: m.createdAt,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.transactionId,
        _id: p._id,
        member: p.user?.name || "Member",
        memberId: p.membershipId || p.user?.membershipId || "N/A",
        batch: p.user?.batch || "Alumni",
        type: `${p.packageName || "Membership"} Fee`,
        amount: p.amount,
        gateway: p.cardType || p.paymentGateway || "SSLCommerz",
        trxId: p.bankTransactionId || p.valId || p.transactionId,
        date: p.paidAt || p.createdAt,
        status:
          p.status === "paid"
            ? "Verified"
            : p.status === "pending"
            ? "Pending Verification"
            : "Failed",
        rawStatus: p.status,
      })),
    };
  }

  /**
   * Onboard new member directly by Admin
   */
  async createMemberByAdmin(data) {
    const { name, batch, phone, email, profession, tier = "General Member" } = data;
    if (!name || !phone) {
      throw new Error("Name and phone number are required.");
    }

    const cleanPhone = String(phone).trim();
    const existing = await User.findOne({ phone: cleanPhone });
    if (existing) {
      throw new Error(`A member with phone ${cleanPhone} is already registered.`);
    }

    const membershipType = tier.toLowerCase().includes("life")
      ? "life_member"
      : tier.toLowerCase().includes("donor") || tier.toLowerCase().includes("patron")
      ? "donor_member"
      : "general_member";

    const count = await User.countDocuments();
    const prefix = membershipType === "life_member" ? "BDS-LM" : "BDS-GM";
    const membershipId = `${prefix}-${String(count + 1).padStart(4, "0")}`;

    const newUser = new User({
      name: name.trim(),
      phone: cleanPhone,
      email: email?.trim() || undefined,
      batch: batch?.trim() || "",
      profession: profession?.trim() || "",
      membership: membershipType,
      membershipStatus: "active",
      paymentStatus: "paid",
      membershipId,
      packageData: {
        packageName: tier,
        fee: membershipType === "life_member" ? 20000 : 1000,
        billingCycle: membershipType === "life_member" ? "lifetime" : "yearly",
      },
    });

    return await newUser.save();
  }
}

module.exports = new MemberService();
