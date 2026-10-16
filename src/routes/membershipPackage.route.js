const express = require("express");
const router = express.Router();
const {
  getPublicPackages,
  getAdminPackages,
  getPackageById,
  createPackage,
  updatePackage,
  togglePackageStatus,
  deletePackage,
} = require("../controllers/membershipPackage.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// Public route to get active packages
router.get("/", getPublicPackages);

// Admin route to get all packages
router.get(
  "/admin",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  getAdminPackages
);

// Single package by ID
router.get("/:id", getPackageById);

// Admin: Create package
router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  createPackage
);

// Admin: Update package
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  updatePackage
);

// Admin: Toggle active status
router.patch(
  "/:id/toggle",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  togglePackageStatus
);

// Admin: Delete package
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("admin", "superadmin"),
  deletePackage
);

module.exports = router;
