const financialReportService = require("../services/financialReport.service");

/**
 * Generate Dynamic Date-to-Date Financial Statement
 * GET /api/financial-reports
 */
const getFinancialReport = async (req, res, next) => {
  try {
    const report = await financialReportService.generateReport(req.query);
    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create Manual Income / Donation or Expense Record
 * POST /api/financial-reports/records
 */
const createRecord = async (req, res, next) => {
  try {
    const record = await financialReportService.createRecord(req.body, req.user);
    return res.status(201).json({
      success: true,
      message: `${req.body.type === "income" ? "Income / Donation" : "Expense"} voucher recorded successfully!`,
      data: record,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to record transaction.",
    });
  }
};

/**
 * Update Manual Record
 * PUT /api/financial-reports/records/:id
 */
const updateRecord = async (req, res, next) => {
  try {
    const record = await financialReportService.updateRecord(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      message: "Record updated successfully.",
      data: record,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update record.",
    });
  }
};

/**
 * Delete Manual Record
 * DELETE /api/financial-reports/records/:id
 */
const deleteRecord = async (req, res, next) => {
  try {
    await financialReportService.deleteRecord(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Record deleted successfully.",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to delete record.",
    });
  }
};

module.exports = {
  getFinancialReport,
  createRecord,
  updateRecord,
  deleteRecord,
};
