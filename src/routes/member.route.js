const express = require("express");
const router = express.Router();
const {
  getPublicMembers,
  getAdminMembers,
  getMemberById,
  getMemberStats,
  updateMemberStatus,
  updateMember,
  deleteMember,
  exportMembersCSV,
} = require("../controllers/member.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// ─── Public Routes ───
router.get("/", getPublicMembers);
router.get("/stats", getMemberStats);
router.get("/:id", getMemberById);

// ─── Admin Routes ───
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
