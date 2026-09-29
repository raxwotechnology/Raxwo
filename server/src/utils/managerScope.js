const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const { isTopManagerOrAdmin } = require('./userPermissions');

/**
 * Resolves the subordinate scope for a Project Manager / Leader.
 * For Admin or Top Executives ("Rashin" / manager@raxwo.com), returns { isAll: true }.
 * For Project Managers:
 *  - Projects where projectManager === user._id (or where assigned)
 *  - Direct employee reports (Employee.manager === user._id)
 *  - Nested reports under Team Leads (Employee.manager in teamLeadUserIds)
 *  - Employees assigned to PM's projects
 *  - The PM's own employee record
 */
async function getManagerScope(user) {
  if (!user) {
    return {
      isAll: false,
      employeeIds: [],
      userIds: [],
      projectIds: [],
      ownEmployeeId: null,
      teamLeadUserIds: [],
    };
  }

  if (isTopManagerOrAdmin(user)) {
    return {
      isAll: true,
      employeeIds: [],
      userIds: [],
      projectIds: [],
      ownEmployeeId: null,
      teamLeadUserIds: [],
    };
  }

  const userId = user._id;

  // 1. Projects managed by this user or assigned to this user
  const projects = await Project.find({
    $or: [
      { projectManager: userId },
      { assignedEmployees: userId },
    ],
  }).select('_id assignedEmployees');

  const projectIds = projects.map((p) => p._id);
  const projectAssignedUserIds = [];
  projects.forEach((p) => {
    (p.assignedEmployees || []).forEach((uid) => {
      if (uid) projectAssignedUserIds.push(uid);
    });
  });

  // 2. Direct reports where manager is this user
  const directReports = await Employee.find({
    manager: userId,
    status: { $in: ['active', 'internship', 'contract', 'on_leave'] },
  }).select('_id userId');

  const directReportEmpIds = directReports.map((e) => e._id);
  const directReportUserIds = directReports.map((e) => e.userId).filter(Boolean);

  // 3. Secondary reports under Team Leads (e.g. employees reporting to a Team Lead who reports to this PM)
  let subReports = [];
  if (directReportUserIds.length > 0) {
    subReports = await Employee.find({
      manager: { $in: directReportUserIds },
      status: { $in: ['active', 'internship', 'contract', 'on_leave'] },
    }).select('_id userId');
  }
  const subReportEmpIds = subReports.map((e) => e._id);
  const subReportUserIds = subReports.map((e) => e.userId).filter(Boolean);

  // 4. Employees assigned to PM's projects
  let projectEmps = [];
  if (projectAssignedUserIds.length > 0) {
    projectEmps = await Employee.find({
      userId: { $in: projectAssignedUserIds },
      status: { $in: ['active', 'internship', 'contract', 'on_leave'] },
    }).select('_id userId');
  }
  const projectEmpIds = projectEmps.map((e) => e._id);

  // 5. Manager's own employee record
  const ownEmp = await Employee.findOne({ userId }).select('_id');
  const ownEmployeeId = ownEmp ? ownEmp._id : null;

  // Combine unique employee IDs
  const allEmpIdSet = new Set([
    ...directReportEmpIds.map(String),
    ...subReportEmpIds.map(String),
    ...projectEmpIds.map(String),
    ...(ownEmployeeId ? [String(ownEmployeeId)] : []),
  ]);

  // Combine unique user IDs
  const allUserIdSet = new Set([
    String(userId),
    ...directReportUserIds.map(String),
    ...subReportUserIds.map(String),
    ...projectAssignedUserIds.map(String),
  ]);

  const employeeIds = Array.from(allEmpIdSet).map((id) => new mongoose.Types.ObjectId(id));
  const userIds = Array.from(allUserIdSet).map((id) => new mongoose.Types.ObjectId(id));

  return {
    isAll: false,
    employeeIds,
    userIds,
    projectIds,
    ownEmployeeId,
    teamLeadUserIds: directReportUserIds,
  };
}

module.exports = {
  getManagerScope,
};
