const membershipPackageService = require("../services/membershipPackage.service");

/**
 * Public: Get active membership packages
 */
const getPublicPackages = async (req, res, next) => {
  try {
    const packages = await membershipPackageService.getActivePackages();
    res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all membership packages
 */
const getAdminPackages = async (req, res, next) => {
  try {
    const packages = await membershipPackageService.getAllPackages();
    res.status(200).json({
      success: true,
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get package by ID
 */
const getPackageById = async (req, res, next) => {
  try {
    const pkg = await membershipPackageService.getPackageById(req.params.id);
    res.status(200).json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create new package
 */
const createPackage = async (req, res, next) => {
  try {
    const newPkg = await membershipPackageService.createPackage(req.body);
    res.status(201).json({
      success: true,
      message: `Membership package "${newPkg.name}" created successfully.`,
      data: newPkg,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Update package
 */
const updatePackage = async (req, res, next) => {
  try {
    const updatedPkg = await membershipPackageService.updatePackage(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: `Membership package "${updatedPkg.name}" updated successfully.`,
      data: updatedPkg,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Toggle active status
 */
const togglePackageStatus = async (req, res, next) => {
  try {
    const updatedPkg = await membershipPackageService.togglePackageStatus(req.params.id);
    res.status(200).json({
      success: true,
      message: `Package "${updatedPkg.name}" status changed to ${updatedPkg.isActive ? "Active" : "Inactive"}.`,
      data: updatedPkg,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete package
 */
const deletePackage = async (req, res, next) => {
  try {
    const result = await membershipPackageService.deletePackage(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicPackages,
  getAdminPackages,
  getPackageById,
  createPackage,
  updatePackage,
  togglePackageStatus,
  deletePackage,
};
