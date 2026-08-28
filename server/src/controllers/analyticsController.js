const User = require('../models/User');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const Payroll = require('../models/Payroll');
const Application = require('../models/Application');
const Invoice = require('../models/Invoice');
const Leave = require('../models/Leave');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const Subscription = require('../models/Subscription');
const FinanceEntry = require('../models/FinanceEntry');
const Advance = require('../models/Advance');
const Loan = require('../models/Loan');
const BankAccount = require('../models/BankAccount');
const PettyCash = require('../models/PettyCash');
const Request = require('../models/Request');
const WorkLog = require('../models/WorkLog');
const { createNotification } = require('../services/notificationService');
const { isTopManagerOrAdmin } = require('../utils/userPermissions');
const axios = require('axios');

const dateRange = (start, end) => ({
  $gte: start ? new Date(start) : new Date(new Date().getFullYear(), 0, 1),
  $lte: end ? new Date(end + 'T23:59:59.999Z') : new Date(),
});
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers to generate match conditions with optional branch ──────────────
const getEmpMatch = (branchId) => branchId ? { branch: branchId } : {};
const getProjMatch = (branchId) => branchId ? { branch: branchId } : {};
const getInvMatch = (branchId) => branchId ? { branch: branchId } : {};
const getFinMatch = (branchId) => branchId ? { branch: branchId } : {};
const getSubMatch = (branchId) => branchId ? { branch: branchId } : {};

async function getEmpIds(branchId) {
  if (!branchId) return null;
  const emps = await Employee.find({ branch: branchId }).select('_id');
  return emps.map(e => e._id);
}

// @desc    Admin dashboard analytics
// @route   GET /api/analytics/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const { branch } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, now.getMonth(), 1);
    const monthEnd = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);

    const isTopMgr = isTopManagerOrAdmin(req.user);

    let empMatch = getEmpMatch(branch);
    let projMatch = getProjMatch(branch);
    const invMatch = getInvMatch(branch);
    const finMatch = getFinMatch(branch);
    const subMatch = getSubMatch(branch);
    let relatedEmpMatch = {};

    if (!isTopMgr) {
      empMatch = { ...empMatch, manager: req.user._id };
      const assignedEmps = await Employee.find(empMatch).select('_id');
      const assignedEmpIds = assignedEmps.map(e => e._id);
      relatedEmpMatch = { employee: { $in: assignedEmpIds } };
      projMatch = {
        ...projMatch,
        $or: [
          { projectManager: req.user._id },
          { teamMembers: req.user._id },
          { leader: req.user._id }
        ]
      };
    } else {
      const branchEmpIds = await getEmpIds(branch);
      relatedEmpMatch = branchEmpIds ? { employee: { $in: branchEmpIds } } : {};
    }

    const [
      totalEmployees, activeEmployees, internCount,
      totalProjects, activeProjects, completedProjects, pendingProjects,
      totalUsers, clientCount,
      totalApplications, newApplications,
      pendingLeaves, insufficientLeaves,
      totalSubscriptions, activeSubscriptions, overdueSubscriptions,
      pendingInvoices, draftPayrolls, adminCount,
      pendingRequests, pendingWorkLogs,
    ] = await Promise.all([
      Employee.countDocuments(empMatch),
      Employee.countDocuments({ ...empMatch, status: { $in: ['active', 'internship', 'contract', 'on_leave'] } }),
      Employee.countDocuments({ ...empMatch, employmentType: 'intern', status: 'internship' }),
      Project.countDocuments(projMatch),
      Project.countDocuments({ ...projMatch, status: 'active' }),
      Project.countDocuments({ ...projMatch, status: 'completed' }),
      Project.countDocuments({ ...projMatch, status: 'planning' }),
      User.countDocuments(),
      User.countDocuments({ role: 'client' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'new' }),
      Leave.countDocuments({ ...relatedEmpMatch, status: 'pending' }),
      Leave.countDocuments({ ...relatedEmpMatch, status: 'pending', insufficientBalance: true }),
      Subscription.countDocuments(subMatch),
      Subscription.countDocuments({ ...subMatch, status: 'active' }),
      Subscription.countDocuments({ ...subMatch, status: 'overdue' }),
      Invoice.countDocuments({ ...invMatch, status: 'unpaid' }),
      Payroll.countDocuments({ ...relatedEmpMatch, status: 'draft' }),
      User.countDocuments({ role: 'admin' }),
      Request.countDocuments({ status: 'pending' }),
      WorkLog.countDocuments({ approvalStatus: 'pending' }),
    ]);

    // Outstanding advance & loan balances
    const [advResult, loanResult] = await Promise.all([
      Advance.aggregate([{ $match: { ...relatedEmpMatch, status: 'active' } }, { $group: { _id: null, total: { $sum: '$outstandingBalance' } } }]),
      Loan.aggregate([{ $match: { ...relatedEmpMatch, status: 'active' } }, { $group: { _id: null, total: { $sum: '$outstandingBalance' } } }]),
    ]);
    const outstandingAdvances = advResult[0]?.total || 0;
    const outstandingLoans = loanResult[0]?.total || 0;

    // Expiring interns (internship.endDate within next 7 days)
    const next7 = new Date(now.getTime() + 7 * 86400000);
    const expiredInterns = await Employee.countDocuments({
      ...empMatch,
      employmentType: 'intern', status: 'internship',
      'internship.endDate': { $lte: next7 },
    });

    // Revenue this year (from paid invoices)
    const [revenueData, expenseData] = await Promise.all([
      Invoice.aggregate([
        { $match: { ...invMatch, status: 'paid', createdAt: { $gte: new Date(`${currentYear}-01-01`) } } },
        { $group: { _id: { $month: '$createdAt' }, total: { $sum: '$total' } } },
        { $sort: { '_id': 1 } }
      ]),
      FinanceEntry.aggregate([
        { $match: { ...finMatch, type: 'expense', date: { $gte: new Date(`${currentYear}-01-01`) } } },
        { $group: { _id: { $month: '$date' }, total: { $sum: '$amount' } } },
        { $sort: { '_id': 1 } }
      ]),
    ]);

    const totalRevenue = revenueData.reduce((s, d) => s + d.total, 0);
    const totalExpenses = expenseData.reduce((s, d) => s + d.total, 0);

    const subscriptionRevenue = await Subscription.aggregate([
      { $match: { ...subMatch, status: { $in: ['active', 'paid'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const payrollCost = await Payroll.aggregate([
      { $match: { ...relatedEmpMatch, year: currentYear, status: { $in: ['approved', 'paid'] } } },
      { $group: { _id: '$month', total: { $sum: '$netSalary' } } },
      { $sort: { '_id': 1 } }
    ]);

    const [attendanceByStatus, attendanceToday] = await Promise.all([
      Attendance.aggregate([
        { $match: { ...relatedEmpMatch, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Attendance.aggregate([
        { $match: { ...relatedEmpMatch, date: { $gte: new Date(now.toDateString()), $lte: new Date(now.toDateString() + ' 23:59:59') } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
    ]);

    const salaryDistribution = await Employee.aggregate([
      { $match: { ...empMatch, status: 'active' } },
      {
        $bucket: {
          groupBy: '$basicSalary',
          boundaries: [0, 50000, 100000, 150000, 200000, 300000, 999999999],
          default: '300000+',
          output: { count: { $sum: 1 }, avg: { $avg: '$basicSalary' } }
        }
      }
    ]);

    const projectProgress = await Project.aggregate([
      { $match: projMatch },
      {
        $bucket: {
          groupBy: '$progress',
          boundaries: [0, 25, 50, 75, 100, 101],
          default: 'unknown',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    const invoiceStats = await Invoice.aggregate([
      { $match: invMatch },
      { $group: { _id: null, totalUnpaid: { $sum: { $cond: [{ $eq: ['$status', 'unpaid'] }, '$remainingBalance', 0] } } } }
    ]);
    const outstandingInvoiceTotal = invoiceStats[0]?.totalUnpaid || 0;

    const [
      totalInvoices,
      paidInvoicesCount,
      pendingPaymentsAgg,
      bankAccountsBalanceAgg,
      financeIncomeTotalAgg,
      financeExpenseTotalAgg,
    ] = await Promise.all([
      Invoice.countDocuments(invMatch),
      Invoice.countDocuments({ ...invMatch, status: 'paid' }),
      Invoice.aggregate([
        { $match: { ...invMatch, status: { $in: ['unpaid', 'partial', 'overdue'] } } },
        { $group: { _id: null, total: { $sum: '$remainingBalance' } } },
      ]),
      BankAccount.aggregate([
        ...(branch ? [{ $match: { branch, isActive: true } }] : [{ $match: { isActive: true } }]),
        { $group: { _id: null, total: { $sum: '$currentBalance' } } },
      ]),
      FinanceEntry.aggregate([
        { $match: { ...finMatch, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      FinanceEntry.aggregate([
        { $match: { ...finMatch, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const pendingPaymentsTotal = pendingPaymentsAgg[0]?.total || 0;
    const bankAccountsTotalBalance = bankAccountsBalanceAgg[0]?.total || 0;
    const financeIncomeTotal = financeIncomeTotalAgg[0]?.total || 0;
    const financeExpenseTotal = financeExpenseTotalAgg[0]?.total || 0;

    // Calculate all-time revenue (Invoices + Subscriptions + FinanceIncome)
    const allInvoicesAgg = await Invoice.aggregate([{ $match: { ...invMatch, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
    const allPayrollAgg = await Payroll.aggregate([{ $match: { ...relatedEmpMatch, status: { $in: ['approved', 'paid'] } } }, { $group: { _id: null, total: { $sum: '$netSalary' } } }]);
    
    const allInvoiceTotal = allInvoicesAgg[0]?.total || 0;
    const allPayrollTotal = allPayrollAgg[0]?.total || 0;
    
    const allTimeRevenue = allInvoiceTotal + financeIncomeTotal + (subscriptionRevenue[0]?.total || 0);
    const allTimeExpense = financeExpenseTotal + allPayrollTotal;

    // Daily & Monthly Revenue/Expenses exact values
    const todayStart = new Date(now.toDateString());
    const [revToday, expToday, revMonth, expMonth] = await Promise.all([
      Invoice.aggregate([{ $match: { ...invMatch, status: 'paid', createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      FinanceEntry.aggregate([{ $match: { ...finMatch, type: 'expense', date: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Invoice.aggregate([{ $match: { ...invMatch, status: 'paid', createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      FinanceEntry.aggregate([{ $match: { ...finMatch, type: 'expense', date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);

    const revenueToday = revToday[0]?.total || 0;
    const expenseToday = expToday[0]?.total || 0;
    const revenueMonth = revMonth[0]?.total || 0;
    const expenseMonth = (expMonth[0]?.total || 0) + payrollCost.find(p => p._id === now.getMonth() + 1)?.total || 0;

    // Balances
    const [finances] = await Promise.all([
      FinanceEntry.aggregate([
        { $match: finMatch },
        { $group: { 
          _id: { method: '$paymentMethod', type: '$type' }, 
          total: { $sum: '$amount' } 
        }}
      ])
    ]);

    let bankIn = 0, bankOut = 0, cashIn = 0, cashOut = 0;
    finances.forEach(f => {
      const method = f._id.method?.toLowerCase() || 'cash';
      if (method.includes('bank') || method.includes('transfer')) {
        if (f._id.type === 'income') bankIn += f.total; else bankOut += f.total;
      } else {
        if (f._id.type === 'income') cashIn += f.total; else cashOut += f.total;
      }
    });

    // Use actual bank account balances for bankBalance
    const bankBalance = bankAccountsTotalBalance;
    const cashBalance = cashIn - cashOut;

    const pettyCashQuery = branch ? { branch } : {};
    const pettyCashRows = await PettyCash.find(pettyCashQuery).lean();
    const pettyCashCashRows = pettyCashRows.filter(
      (t) => !t.paymentType || String(t.paymentType).toLowerCase() === 'cash',
    );
    const pettyCashIn = pettyCashCashRows.filter((t) => t.type === 'in').reduce((s, t) => s + Number(t.amount || 0), 0);
    const pettyCashOut = pettyCashCashRows.filter((t) => t.type === 'out').reduce((s, t) => s + Number(t.amount || 0), 0);
    const pettyCashBalance = pettyCashIn - pettyCashOut;

    const [projectStatus, deptDist, recentProjects, recentApplications, followUps] = await Promise.all([
      Project.aggregate([{ $match: projMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Employee.aggregate([{ $match: empMatch }, { $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Project.find(projMatch).sort({ createdAt: -1 }).limit(5).populate('client', 'name'),
      Application.find().sort({ createdAt: -1 }).limit(5).populate('job', 'title'),
      require('../models/ClientProfile').aggregate([
        { $unwind: '$notes' },
        { $match: { 'notes.followUpDate': { $lte: new Date(now.toDateString() + ' 23:59:59') } } },
        { $sort: { 'notes.followUpDate': -1 } },
        { $limit: 10 }
      ]),
    ]);

    res.json({
      success: true,
      kpis: {
        totalEmployees, activeEmployees, internCount, adminCount,
        totalProjects, activeProjects, completedProjects, pendingProjects,
        totalUsers, clientCount,
        totalApplications, newApplications,
        pendingLeaves, insufficientLeaves,
        totalSubscriptions, activeSubscriptions, overdueSubscriptions,
        pendingInvoices, draftPayrolls,
        pendingRequests, pendingWorkLogs,
        outstandingAdvances, outstandingLoans, expiredInterns,
        totalRevenue, totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        subscriptionRevenue: subscriptionRevenue[0]?.total || 0,
        
        // Advanced Financials
        revenueToday,
        expenseToday,
        revenueMonth,
        expenseMonth,
        revenueQuarter: revenueData.reduce((s, d) => s + d.total, 0), // YTD for now
        expenseQuarter: expenseData.reduce((s, d) => s + d.total, 0), // YTD for now
        outstandingInvoiceTotal,
        bankBalance,
        cashBalance,
        pettyCashBalance,
        totalInvoices,
        paidInvoicesCount,
        pendingPaymentsTotal,
        bankAccountsTotalBalance,
        financeIncomeTotal,
        financeExpenseTotal,
        allTimeRevenue,
        allTimeExpense,
      },
      charts: {
        revenueData, expenseData, payrollCost,
        attendanceByStatus, attendanceToday,
        salaryDistribution, projectProgress, projectStatus, deptDist,
      },
      recent: { recentProjects, recentApplications, followUps }
    });
  } catch (err) { next(err); }
};

// @desc    Advanced analytics with date range
// @route   GET /api/analytics/advanced
exports.getAdvancedAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, branch } = req.query;
    const range = dateRange(startDate, endDate);

    const empMatch = getEmpMatch(branch);
    const projMatch = getProjMatch(branch);
    const invMatch = getInvMatch(branch);
    
    const branchEmpIds = await getEmpIds(branch);
    const relatedEmpMatch = branchEmpIds ? { employee: { $in: branchEmpIds } } : {};

    const [
      projectsByType, revenueByClient, topEmployees,
      leaveByType, attendanceTrend, payrollTrend,
      invoiceStatus, clientActivity,
    ] = await Promise.all([
      Project.aggregate([
        { $match: { ...projMatch, $or: [{ createdAt: range }, { startDate: range }] } },
        { $group: { _id: '$serviceType', count: { $sum: 1 }, totalBudget: { $sum: '$budget' } } },
        { $sort: { count: -1 } }
      ]),
      Invoice.aggregate([
        { $match: { ...invMatch, status: 'paid', createdAt: range } },
        { $group: { _id: '$client', total: { $sum: '$total' } } },
        { $sort: { total: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'clientInfo' } },
        { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$clientInfo.name', total: 1 } }
      ]),
      Employee.aggregate([
        { $match: empMatch },
        { $lookup: { from: 'payrolls', localField: '_id', foreignField: 'employee', as: 'payrolls' } },
        { $addFields: { totalEarned: { $sum: '$payrolls.netSalary' } } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { name: '$user.name', department: 1, designation: 1, totalEarned: 1 } },
        { $sort: { totalEarned: -1 } }, { $limit: 10 }
      ]),
      Leave.aggregate([
        { $match: { ...relatedEmpMatch, startDate: range } },
        { $group: { _id: '$leaveType', count: { $sum: 1 }, totalDays: { $sum: '$days' } } },
        { $sort: { totalDays: -1 } }
      ]),
      Attendance.aggregate([
        { $match: { ...relatedEmpMatch, date: range } },
        { $group: { _id: { $month: '$date' }, present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }, leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } } } },
        { $sort: { '_id': 1 } }
      ]),
      Payroll.aggregate([
        { $match: { ...relatedEmpMatch, createdAt: range } },
        { $group: { _id: { month: '$month', year: '$year' }, totalNet: { $sum: '$netSalary' }, totalGross: { $sum: '$grossSalary' }, count: { $sum: 1 } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Invoice.aggregate([
        { $match: { ...invMatch, createdAt: range } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ]),
      Project.aggregate([
        { $match: { ...projMatch, createdAt: range } },
        { $lookup: { from: 'users', localField: 'client', foreignField: '_id', as: 'clientInfo' } },
        { $unwind: { path: '$clientInfo', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$client', name: { $first: '$clientInfo.name' }, projects: { $sum: 1 }, totalBudget: { $sum: '$budget' } } },
        { $sort: { projects: -1 } }, { $limit: 10 }
      ]),
    ]);

    res.json({
      success: true,
      projectsByType,
      revenueByClient,
      topEmployees,
      leaveByType,
      attendanceTrend: attendanceTrend.map(d => ({ month: months[d._id - 1], ...d })),
      payrollTrend: payrollTrend.map(d => ({ label: `${months[d._id.month - 1]} ${d._id.year}`, ...d })),
      invoiceStatus,
      clientActivity,
    });
  } catch (err) { next(err); }
};

// @desc    AI predictions endpoint
// @route   GET /api/analytics/ai-predict
exports.getAIPredictions = async (req, res, next) => {
  try {
    const { months: monthsBack = 6, branch } = req.query;
    const lookback = parseInt(monthsBack);
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - lookback, 1);

    const invMatch = getInvMatch(branch);
    const projMatch = getProjMatch(branch);
    const branchEmpIds = await getEmpIds(branch);
    const relatedEmpMatch = branchEmpIds ? { employee: { $in: branchEmpIds } } : {};

    // Historical revenue
    const historicalRevenue = await Invoice.aggregate([
      { $match: { ...invMatch, status: 'paid', createdAt: { $gte: fromDate } } },
      { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, total: { $sum: '$total' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Historical payroll
    const historicalPayroll = await Payroll.aggregate([
      { $match: { ...relatedEmpMatch, status: { $in: ['approved', 'paid'] }, createdAt: { $gte: fromDate } } },
      { $group: { _id: { month: '$month', year: '$year' }, total: { $sum: '$netSalary' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Historical projects
    const historicalProjects = await Project.aggregate([
      { $match: { ...projMatch, createdAt: { $gte: fromDate } } },
      { $group: { _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const predict = (dataPoints) => {
      if (dataPoints.length < 2) return { trend: 0, nextValue: 0, growthRate: 0 };
      const n = dataPoints.length;
      const values = dataPoints.map(d => d.value);
      const avg = values.reduce((a, b) => a + b, 0) / n;
      const last = values[n - 1];
      const prev = values[n - 2];
      const trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      const recentAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, n);
      const nextValue = Math.round(recentAvg * (1 + trend / 200));
      return { trend: Math.round(trend * 10) / 10, nextValue, avg: Math.round(avg), growthRate: trend };
    };

    const revPoints = historicalRevenue.map(d => ({ label: `${months[d._id.month - 1]} ${d._id.year}`, value: d.total }));
    const payrollPoints = historicalPayroll.map(d => ({ label: `${months[d._id.month - 1]} ${d._id.year}`, value: d.total }));
    const projectPoints = historicalProjects.map(d => ({ label: `${months[d._id.month - 1]} ${d._id.year}`, value: d.count }));

    const revPrediction = predict(revPoints);
    const payrollPrediction = predict(payrollPoints);
    const projectPrediction = predict(projectPoints);

    const nextMonthName = months[now.getMonth() === 11 ? 0 : now.getMonth() + 1];

    const suggestions = [];
    if (revPrediction.trend > 10) suggestions.push({ type: 'positive', icon: '📈', message: `Revenue is trending upward by ${revPrediction.trend}%. Predicted next month revenue: LKR ${revPrediction.nextValue.toLocaleString()}.` });
    else if (revPrediction.trend < -5) suggestions.push({ type: 'warning', icon: '📉', message: `Revenue decline detected (${revPrediction.trend}%). Consider reviewing project pipeline and client outreach.` });
    else suggestions.push({ type: 'neutral', icon: '📊', message: `Revenue is stable. Predicted ${nextMonthName} revenue: LKR ${revPrediction.nextValue.toLocaleString()}.` });

    if (payrollPrediction.trend > 15) suggestions.push({ type: 'warning', icon: '💰', message: `Payroll costs are rising fast (+${payrollPrediction.trend}%). Review staffing levels and OT allocation.` });
    if (projectPrediction.trend > 20) suggestions.push({ type: 'positive', icon: '🚀', message: `Project intake is growing by ${projectPrediction.trend}%. Plan capacity accordingly.` });
    if (projectPrediction.trend < -10) suggestions.push({ type: 'warning', icon: '⚠️', message: `New project intake is declining. Focus on sales and business development.` });

    const netProfitTrend = revPrediction.trend - payrollPrediction.trend;
    if (netProfitTrend > 5) suggestions.push({ type: 'positive', icon: '✅', message: `Net profit margin is improving. Revenue growth outpacing payroll costs.` });

    res.json({
      success: true,
      historical: { revenue: revPoints, payroll: payrollPoints, projects: projectPoints },
      predictions: {
        revenue: { ...revPrediction, label: `${nextMonthName} Revenue` },
        payroll: { ...payrollPrediction, label: `${nextMonthName} Payroll` },
        projects: { ...projectPrediction, label: `${nextMonthName} Projects` },
      },
      suggestions,
      period: { from: fromDate.toISOString(), to: now.toISOString(), months: lookback },
    });
  } catch (err) {
    console.error('[ai-predict] Business analytics failed:', err.message);
    next(err);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true, readAt: new Date() });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.markSingleRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true, readAt: new Date() }, { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, notification });
  } catch (err) { next(err); }
};

exports.getNotificationById = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
    if (!notification) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, notification });
  } catch (err) { next(err); }
};

exports.broadcastAnnouncement = async (req, res, next) => {
  try {
    const { title, message, roles = [] } = req.body;
    const query = roles.length ? { role: { $in: roles }, isActive: true } : { isActive: true };
    const users = await User.find(query).select('_id');
    await Promise.all(users.map(u => createNotification({ recipient: u._id, title: title || 'Announcement', message: message || 'New announcement.', type: 'system' })));
    res.json({ success: true, notified: users.length });
  } catch (err) { next(err); }
};

exports.sendBirthdayNotifications = async (req, res, next) => {
  try {
    const now = new Date();
    const employees = await Employee.find().populate('userId', 'name _id');
    const birthdayUsers = employees.filter(e => e.dob && new Date(e.dob).getMonth() === now.getMonth() && new Date(e.dob).getDate() === now.getDate());
    const allUsers = await User.find({ isActive: true }).select('_id');
    for (const p of birthdayUsers) {
      await Promise.all(allUsers.map(u => createNotification({ recipient: u._id, title: 'Team Birthday', message: `Today is ${p.userId?.name}'s birthday! 🎂`, type: 'birthday' })));
    }
    res.json({ success: true, birthdays: birthdayUsers.length });
  } catch (err) { next(err); }
};

// Dynamic Real-Time Website Auditor & Scraper Endpoint
exports.auditWebsite = async (req, res, next) => {
  try {
    let { url } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, message: 'Website URL is required' });
    }

    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL format' });
    }

    const startTime = Date.now();
    let response;
    let fetchError = null;

    try {
      response = await axios.get(parsedUrl.href, {
        timeout: 9000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RaxwoSEOAudit/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        validateStatus: () => true
      });
    } catch (err) {
      fetchError = err;
    }

    const responseTimeMs = Date.now() - startTime;
    const isHttps = parsedUrl.protocol === 'https:';
    const statusCode = response ? response.status : 0;
    const html = (response && typeof response.data === 'string') ? response.data : '';
    const headers = response?.headers || {};

    // HTML Metadata Extraction
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const titleLength = title.length;

    const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
                          html.match(/<meta\s+[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
    const description = metaDescMatch ? metaDescMatch[1].trim() : '';
    const descriptionLength = description.length;

    const hasViewport = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
    const hasCanonical = /<link\s+[^>]*rel=["']canonical["']/i.test(html);
    const hasFavicon = /<link\s+[^>]*rel=["'](icon|shortcut icon|apple-touch-icon)["']/i.test(html);
    const hasOgImage = /<meta\s+[^>]*property=["']og:image["']/i.test(html) || /<meta\s+[^>]*content=["'][^"']*og:image["']/i.test(html);

    // Headings Count
    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    const h1Count = h1Matches.length;

    const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
    const h2Count = h2Matches.length;

    const h3Matches = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/gi) || [];
    const h3Count = h3Matches.length;

    // Image Alt Tags Analysis
    const imgMatches = html.match(/<img\s+[^>]*>/gi) || [];
    const totalImages = imgMatches.length;
    let imagesWithoutAlt = 0;
    imgMatches.forEach(imgTag => {
      const altMatch = imgTag.match(/alt=["']([\s\S]*?)["']/i);
      if (!altMatch || !altMatch[1].trim()) {
        imagesWithoutAlt++;
      }
    });

    // Security Headers
    const hasHsts = Boolean(headers['strict-transport-security']);
    const hasCsp = Boolean(headers['content-security-policy']);
    const hasXFrame = Boolean(headers['x-frame-options']);

    // Dynamic Score Calculation
    let seoDeductions = 0;
    if (!title) seoDeductions += 18;
    else if (titleLength < 25 || titleLength > 65) seoDeductions += 8;

    if (!description) seoDeductions += 18;
    else if (descriptionLength < 70 || descriptionLength > 160) seoDeductions += 8;

    if (h1Count === 0) seoDeductions += 12;
    else if (h1Count > 2) seoDeductions += 6;

    if (!hasCanonical) seoDeductions += 10;
    if (!hasOgImage) seoDeductions += 8;
    if (totalImages > 0 && (imagesWithoutAlt / totalImages) > 0.3) seoDeductions += 10;
    if (!hasFavicon) seoDeductions += 6;

    const seoScore = Math.max(38, Math.min(99, 100 - seoDeductions));

    // Speed Score
    let speedScore = 95;
    if (responseTimeMs > 2500) speedScore = 48;
    else if (responseTimeMs > 1500) speedScore = 62;
    else if (responseTimeMs > 800) speedScore = 76;
    else if (responseTimeMs > 400) speedScore = 86;
    else speedScore = 96;

    if (statusCode !== 200 && statusCode !== 0) speedScore -= 18;
    speedScore = Math.max(30, Math.min(99, speedScore));

    // Mobile Score
    let mobileScore = 95;
    if (!hasViewport) mobileScore -= 35;
    mobileScore = Math.max(35, Math.min(99, mobileScore));

    // Security Score
    let securityScore = 98;
    if (!isHttps) securityScore -= 45;
    if (!hasHsts) securityScore -= 12;
    if (!hasXFrame && !hasCsp) securityScore -= 10;
    securityScore = Math.max(30, Math.min(99, securityScore));

    // Accessibility Score
    let accessibilityScore = 92;
    if (totalImages > 0) {
      const altRatio = (totalImages - imagesWithoutAlt) / totalImages;
      accessibilityScore = Math.round(50 + altRatio * 45);
    }
    accessibilityScore = Math.max(40, Math.min(99, accessibilityScore));

    // UI/UX & Content Scores
    const uiuxScore = Math.min(98, Math.max(50, Math.round((mobileScore + speedScore) / 2)));
    const contentScore = Math.min(98, Math.max(45, Math.round((seoScore * 0.6) + (h2Count > 2 ? 20 : 10) + (description ? 15 : 0))));

    // Build Dynamic Issues Array
    const issues = [];
    if (!isHttps) {
      issues.push(`🔒 Security Risk: Website uses unencrypted HTTP protocol (HTTPS required)`);
    }
    if (!title) {
      issues.push(`❌ Missing <title> tag on ${parsedUrl.hostname}`);
    } else if (titleLength < 25) {
      issues.push(`⚠️ Suboptimal Title Length: Title is ${titleLength} chars (recommended: 30–60 chars)`);
    } else if (titleLength > 65) {
      issues.push(`⚠️ Title Length Exceeded: Title is ${titleLength} chars (recommended: 30–60 chars)`);
    }

    if (!description) {
      issues.push(`❌ Meta Description Missing: <meta name="description"> is missing on ${parsedUrl.hostname}`);
    } else if (descriptionLength < 70) {
      issues.push(`⚠️ Short Meta Description: Description is ${descriptionLength} chars (recommended: 70–160 chars)`);
    } else if (descriptionLength > 160) {
      issues.push(`⚠️ Long Meta Description: Description is ${descriptionLength} chars (recommended: 70–160 chars)`);
    }

    if (h1Count === 0) {
      issues.push(`❌ Missing <h1> Main Heading: No <h1> tag found on the audited URL`);
    } else if (h1Count > 2) {
      issues.push(`⚠️ Multiple <h1> Tags: Found ${h1Count} <h1> headings (recommended: exactly 1 <h1>)`);
    }

    if (totalImages > 0 && imagesWithoutAlt > 0) {
      issues.push(`🖼️ Image Accessibility: ${imagesWithoutAlt} out of ${totalImages} images lack alt text attributes`);
    }

    if (!hasViewport) {
      issues.push(`📱 Mobile Responsiveness: Missing <meta name="viewport"> viewport scaling tag`);
    }

    if (!hasCanonical) {
      issues.push(`🔗 Duplicate Content Risk: Missing <link rel="canonical"> tag`);
    }

    if (!hasOgImage) {
      issues.push(`📢 Social Preview Issue: Missing og:image meta tag for social media sharing cards`);
    }

    if (responseTimeMs > 800) {
      issues.push(`⏱️ Latency Alert: Server response time is ${responseTimeMs}ms (recommended: <500ms)`);
    }

    if (statusCode !== 200 && statusCode !== 0) {
      issues.push(`⚠️ HTTP Server Status: Returned status code ${statusCode}`);
    }

    if (fetchError) {
      issues.push(`⚠️ Network Fetch Warning: ${fetchError.message}`);
    }

    if (issues.length === 0) {
      issues.push(`✅ Excellent! No critical SEO, accessibility, or security issues found on ${parsedUrl.hostname}`);
    }

    // Build Dynamic Suggestions Array
    const suggestions = [];
    if (!description) {
      suggestions.push(`Add a targeted <meta name="description"> between 70–160 characters describing ${parsedUrl.hostname}.`);
    }
    if (imagesWithoutAlt > 0) {
      suggestions.push(`Add descriptive alt attributes to all ${imagesWithoutAlt} un-annotated image tags to improve accessibility and image search indexation.`);
    }
    if (responseTimeMs > 500) {
      suggestions.push(`Optimize TTFB and server response time (currently ${responseTimeMs}ms) using browser caching, CDN delivery, and HTTP compression.`);
    }
    if (!hasOgImage) {
      suggestions.push(`Add an og:image meta tag with a 1200x630px high-resolution banner image for attractive social media shares.`);
    }
    if (h1Count !== 1) {
      suggestions.push(`Ensure exactly one <h1> tag is present on the page containing your primary target focus keyword.`);
    }
    if (!isHttps) {
      suggestions.push(`Install an SSL/TLS certificate and force automatic HTTP to HTTPS redirection.`);
    }
    if (!hasCanonical) {
      suggestions.push(`Add <link rel="canonical" href="${parsedUrl.origin}/" /> to avoid search engine duplicate indexing.`);
    }
    suggestions.push(`Implement Schema.org JSON-LD structured data (Organization / WebSite) for rich Google Search snippet snippets.`);
    suggestions.push(`Convert standard PNG/JPEG images to modern WebP or AVIF formats for smaller payload size.`);

    res.json({
      success: true,
      url: parsedUrl.href,
      domain: parsedUrl.hostname,
      audit: {
        domain: parsedUrl.hostname,
        protocol: parsedUrl.protocol,
        statusCode,
        responseTimeMs,
        seoScore,
        speedScore,
        mobileScore,
        securityScore,
        accessibilityScore,
        uiuxScore,
        contentScore,
        meta: {
          title,
          titleLength,
          description,
          descriptionLength,
          h1Count,
          h2Count,
          h3Count,
          totalImages,
          imagesWithoutAlt,
          hasViewport,
          hasCanonical,
          hasFavicon,
          hasOgImage,
          isHttps
        },
        issues,
        suggestions
      }
    });
  } catch (err) {
    console.error('[auditWebsite Error]:', err.message);
    next(err);
  }
};
