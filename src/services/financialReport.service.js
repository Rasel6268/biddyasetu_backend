const mongoose = require("mongoose");
require("../models/Users.model");
const FinancialRecord = require("../models/FinancialRecord.model");
const Payment = require("../models/Payment.model");

class FinancialReportService {
  constructor() {
    // Purge any previously seeded demo/mock records so the database is 100% clean
    this.purgeDemoData();
  }

  /**
   * Delete any mock/demo entries so only real SSL payments and admin manual inputs exist
   */
  async purgeDemoData() {
    try {
      await FinancialRecord.deleteMany({
        referenceId: {
          $in: [
            "EBL-DON-98214",
            "BK91884210",
            "CHQ-8840192",
            "REC-SPORTS-06",
            "EXP-SCH-2026-03",
            "EXP-MED-048",
            "VOUCHER-STG-102",
            "INV-HOST-882",
          ],
        },
      });
    } catch (err) {
      console.warn("[FinancialReportService purgeDemoData]:", err.message);
    }
  }

  /**
   * Generate comprehensive date-to-date dynamic financial report
   * @param {Object} filters { startDate, endDate, category, type }
   */
  async generateReport(filters = {}) {
    const { startDate, endDate, category, type } = filters;

    // Date range setup
    let start = null;
    let end = null;

    if (startDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    // 1. Query Dynamic Membership Fees from Payment Collection (SSL Payment)
    const paymentFilter = { status: { $in: ["paid", "Verified", "completed"] } };
    if (start && end) {
      paymentFilter.$or = [
        { paidAt: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ];
    } else if (start) {
      paymentFilter.$or = [
        { paidAt: { $gte: start } },
        { createdAt: { $gte: start } },
      ];
    } else if (end) {
      paymentFilter.$or = [
        { paidAt: { $lte: end } },
        { createdAt: { $lte: end } },
      ];
    }

    // 2. Query Manual Income & Expense Records from FinancialRecord
    const recordFilter = { status: "approved" };
    if (start && end) {
      recordFilter.date = { $gte: start, $lte: end };
    } else if (start) {
      recordFilter.date = { $gte: start };
    } else if (end) {
      recordFilter.date = { $lte: end };
    }

    if (category && category !== "all") {
      recordFilter.category = category;
    }
    if (type && type !== "all") {
      recordFilter.type = type;
    }

    // Include SSL payments if not explicitly filtering for expenses only or a non-membership category
    const includePayments =
      type !== "expense" &&
      (!category || category === "all" || category === "membership_fee");

    const [payments, manualRecords] = await Promise.all([
      includePayments
        ? Payment.find(paymentFilter)
            .populate("user", "name email phone batch membershipId")
            .sort({ paidAt: -1, createdAt: -1 })
            .lean()
        : [],
      FinancialRecord.find(recordFilter).sort({ date: -1 }).lean(),
    ]);

    // ─── Format Membership Payments into Ledger Items (from SSL Payment) ───
    const formattedPayments = payments
      .filter((p) => {
        const txDate = new Date(p.paidAt || p.createdAt);
        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      })
      .map((p) => {
        const transactionDate = p.paidAt || p.createdAt;
        return {
          _id: p._id,
          type: "income",
          category: "membership_fee",
          categoryLabel: "Membership Fee (SSL Payment)",
          title: `${p.packageName || "Membership"} Fee - ${p.user?.name || "Alumni"}`,
          amount: Number(p.amount) || 0,
          date: transactionDate,
          sourceOrPayee: p.user?.name
            ? `${p.user.name} (${p.user.batch ? `SSC ${p.user.batch}` : (p.membershipId || "Member")})`
            : (p.membershipId || "Alumni Member"),
          paymentMethod: p.cardType || p.paymentGateway || "SSLCommerz",
          referenceId: p.bankTransactionId || p.valId || p.transactionId,
          notes: `Online SSLCommerz payment for ${p.billingCycle || "annual"} membership`,
          isAutomated: true,
          recordedByName: "SSL Payment Gateway",
        };
      });

    // ─── Format Manual Records ───
    const formattedManual = manualRecords.map((r) => {
      let categoryLabel = r.category.replace(/_/g, " ").toUpperCase();
      if (r.category === "donation") categoryLabel = "Donation & Contribution";
      if (r.category === "sponsorship") categoryLabel = "Event Sponsorship";
      if (r.category === "scholarship_aid") categoryLabel = "Student Scholarship Aid";
      if (r.category === "welfare_relief") categoryLabel = "Alumni Welfare & Health Aid";
      if (r.category === "reunion_event") categoryLabel = "Reunion & Campus Logistics";
      if (r.category === "office_admin") categoryLabel = "Administration & Web Portal";

      return {
        _id: r._id,
        type: r.type,
        category: r.category,
        categoryLabel,
        title: r.title,
        amount: Number(r.amount) || 0,
        date: r.date,
        sourceOrPayee: r.sourceOrPayee || "—",
        paymentMethod: r.paymentMethod || "Cash",
        referenceId: r.referenceId || "—",
        notes: r.notes || "",
        isAutomated: false,
        recordedByName: r.recordedByName || "Admin",
      };
    });

    // ─── Combine & Sort Unified Ledger ───
    const allLedgerItems = [...formattedPayments, ...formattedManual].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    // ─── Calculate Summary Totals ───
    let totalMembershipIncome = 0;
    let totalManualIncome = 0;
    let totalExpenses = 0;

    const incomeCategories = {};
    const expenseCategories = {};

    allLedgerItems.forEach((item) => {
      if (item.type === "income") {
        if (item.isAutomated) {
          totalMembershipIncome += item.amount;
        } else {
          totalManualIncome += item.amount;
        }
        incomeCategories[item.categoryLabel] =
          (incomeCategories[item.categoryLabel] || 0) + item.amount;
      } else if (item.type === "expense") {
        totalExpenses += item.amount;
        expenseCategories[item.categoryLabel] =
          (expenseCategories[item.categoryLabel] || 0) + item.amount;
      }
    });

    const totalIncome = totalMembershipIncome + totalManualIncome;
    const netBalance = totalIncome - totalExpenses;

    return {
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      summary: {
        totalIncome,
        totalMembershipIncome,
        totalManualIncome,
        totalExpenses,
        netBalance,
        totalTransactions: allLedgerItems.length,
        incomeTransactionCount: allLedgerItems.filter((i) => i.type === "income").length,
        expenseTransactionCount: allLedgerItems.filter((i) => i.type === "expense").length,
      },
      breakdown: {
        incomeByCategory: Object.entries(incomeCategories).map(([name, amount]) => ({
          name,
          amount,
          percentage: totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(1) : 0,
        })),
        expenseByCategory: Object.entries(expenseCategories).map(([name, amount]) => ({
          name,
          amount,
          percentage: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0,
        })),
      },
      ledger: allLedgerItems,
    };
  }

  /**
   * Create Manual Financial Record (Donation/Other Income OR Expense)
   */
  async createRecord(data, adminUser = null) {
    const { type, category, title, amount, date, sourceOrPayee, paymentMethod, referenceId, notes } = data;

    if (!type || !["income", "expense"].includes(type)) {
      throw new Error("Invalid type. Must be either 'income' or 'expense'.");
    }
    if (!title || !title.trim()) {
      throw new Error("Title is required.");
    }
    if (!amount || Number(amount) <= 0) {
      throw new Error("Amount must be a positive number.");
    }
    if (!category) {
      throw new Error("Category is required.");
    }

    const record = new FinancialRecord({
      type,
      category,
      title: title.trim(),
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      sourceOrPayee: sourceOrPayee?.trim() || "",
      paymentMethod: paymentMethod || "Cash",
      referenceId: referenceId?.trim() || "",
      notes: notes?.trim() || "",
      recordedBy: adminUser?._id || null,
      recordedByName: adminUser?.name || "Admin",
      status: "approved",
    });

    return await record.save();
  }

  /**
   * Update manual financial record
   */
  async updateRecord(id, updateData) {
    const record = await FinancialRecord.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!record) {
      throw new Error("Financial record not found.");
    }
    return record;
  }

  /**
   * Delete manual financial record
   */
  async deleteRecord(id) {
    const record = await FinancialRecord.findByIdAndDelete(id);
    if (!record) {
      throw new Error("Financial record not found.");
    }
    return record;
  }
}

module.exports = new FinancialReportService();
