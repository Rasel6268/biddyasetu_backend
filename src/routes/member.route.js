const express = require("express");
const router = express.Router();
const {
  getPublicMembers,
  getAdminMembers,
  getMemberById,
  getMemberStats,
  getDashboardOverview,
  createMemberByAdmin,
  updateMemberStatus,
  updateMember,
  deleteMember,
  exportMembersCSV,
} = require("../controllers/member.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// ─── Specific Routes (Must be before /:id) ───
router.get("/", getPublicMembers);
router.get("/stats", getMemberStats);

// ─── Admin Routes ───
router.get(
  "/admin/dashboard-stats",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  getDashboardOverview
);

router.post(
  "/admin/create",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  createMemberByAdmin
);

router.get(
  "/admin/all",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  getAdminMembers
);

router.get(
  "/admin/export",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  exportMembersCSV
);

// ─── Parameterized Routes ───
router.get("/:id", getMemberById);

router.put(
  "/:id/status",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  updateMemberStatus
);

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  updateMember
);

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  deleteMember
);

module.exports = router;
