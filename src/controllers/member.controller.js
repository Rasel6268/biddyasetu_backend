const memberService = require("../services/member.service");

/**
 * Public Members Directory
 */
const getPublicMembers = async (req, res, next) => {
  try {
    const result = await memberService.getPublicMembers(req.query);
    res.status(200).json({
      success: true,
      data: result.members,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Members Directory with full details
 */
const getAdminMembers = async (req, res, next) => {
  try {
    const result = await memberService.getAdminMembers(req.query);
    res.status(200).json({
      success: true,
      data: result.members,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Single Member by ID
 */
const getMemberById = async (req, res, next) => {
  try {
    const member = await memberService.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Member Statistics (Counts)
 */
const getMemberStats = async (req, res, next) => {
  try {
    const stats = await memberService.getMemberStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member status (Approve, Suspend, Cancel, Change Tier)
 */
const updateMemberStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { membershipStatus, paymentStatus, role, membership } = req.body;

    const updated = await memberService.updateMemberStatus(id, {
      membershipStatus,
      paymentStatus,
      role,
      membership,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member status updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update member profile by Admin
 */
const updateMember = async (req, res, next) => {
  try {
    const updated = await memberService.updateMember(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Member details updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete member
 */
const deleteMember = async (req, res, next) => {
  try {
    const deleted = await memberService.deleteMember(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export member directory CSV
 */
const exportMembersCSV = async (req, res, next) => {
  try {
    const result = await memberService.getAdminMembers({ limit: 5000 });
    const members = result.members || [];

    const headers = [
      "Membership ID",
      "Name (English)",
      "Name (Bengali)",
      "Phone",
      "Email",
      "Batch",
      "Profession",
      "Organization",
      "Blood Group",
      "Country",
      "Membership Tier",
      "Membership Status",
      "Payment Status",
      "Joined Date",
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const rows = members.map((m) => [
      escapeCsv(m.membershipId || `BDS-${m._id}`),
      escapeCsv(m.name || ""),
      escapeCsv(m.nameBn || ""),
      escapeCsv(m.phone || ""),
      escapeCsv(m.email || ""),
      escapeCsv(m.batch || ""),
      escapeCsv(m.profession || ""),
      escapeCsv(m.organization || ""),
      escapeCsv(m.bloodGroup || ""),
      escapeCsv(m.currentAddress?.country || "Bangladesh"),
      escapeCsv(m.packageData?.packageName || m.membership || "General Member"),
      escapeCsv(m.membershipStatus || "pending"),
      escapeCsv(m.paymentStatus || "unpaid"),
      escapeCsv(m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=biddyasetu_alumni_directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    res.status(200).send("\uFEFF" + csvContent); // Include BOM for Excel UTF-8 support
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicMembers,
  getAdminMembers,
  getMemberById,
  getMemberStats,
  updateMemberStatus,
  updateMember,
  deleteMember,
  exportMembersCSV,
};
