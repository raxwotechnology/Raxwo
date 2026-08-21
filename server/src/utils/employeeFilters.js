/** Statuses that may appear in payroll, project allocations, and other “pick an employee” UIs */
const ASSIGNED_STATUSES = ['active', 'internship', 'contract', 'on_leave'];

/** Excluded from assignable lists; still visible in history/reports with includeFormer or direct id */
const INACTIVE_STATUSES = ['inactive', 'suspended', 'resigned', 'terminated', 'former', 'intern_ended'];

const STATUS_LABELS = {
  active: 'Active',
  internship: 'Internship',
  contract: 'Contract',
  on_leave: 'On leave',
  resigned: 'Resigned',
  terminated: 'Terminated',
  former: 'Former',
  intern_ended: 'Intern ended',
};

function isAssignableStatus(status) {
  return ASSIGNED_STATUSES.includes(status);
}

module.exports = {
  ASSIGNED_STATUSES,
  INACTIVE_STATUSES,
  STATUS_LABELS,
  isAssignableStatus,
};
