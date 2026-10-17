const express = require("express");
const router = express.Router();
const {
  getFinancialReport,
  createRecord,
  updateRecord,
  deleteRecord,
} = require("../controllers/financialReport.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { authorizeRoles } = require("../middlewares/role.middleware");

// Protect all financial report management routes for Admin and Superadmin
router.use(authMiddleware, authorizeRoles("admin", "superadmin"));

// Generate Report (Date-to-Date query)
router.get("/", getFinancialReport);

// Manual records management (Donations, manual incomes, expenses)
router.post("/records", createRecord);
router.put("/records/:id", updateRecord);
router.delete("/records/:id", deleteRecord);

module.exports = router;
