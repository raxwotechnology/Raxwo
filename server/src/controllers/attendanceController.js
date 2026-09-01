const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { resolveEmployeeForUser } = require('../utils/employeeResolver');
const { computeAttendanceHours } = require('../utils/attendanceHours');
const { triggerPayrollSync, monthYearFromDate } = require('../utils/payrollSyncHook');
const { isTopManagerOrAdmin } = require('../utils/userPermissions');

// Helper: get start of today as a Date
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: resolve employee from authenticated user (auto-provisions staff profiles)
const resolveEmployee = async (user) => resolveEmployeeForUser(user);

// Helper: get employee IDs by branch
const getEmpIds = async (branchId) => {
  if (!branchId) return null;
  const emps = await Employee.find({ branch: branchId }).select('_id');
  return emps.map(e => e._id);
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / MANAGER — full mark / overwrite attendance for any employee
// POST /api/attendance
// ─────────────────────────────────────────────────────────────────────────────
exports.markAttendance = async (req, res, next) => {
  try {
    if (!isTopManagerOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Project Managers and Team Leaders cannot mark attendance. Attendance can only be marked by Admin or Top Manager (Rashin Sheran).'
      });
    }

    const {
      employeeId, date, status = 'present', checkIn, checkOut, breakTimes = [],
      isHalfDay = false, isFullDay = true, otHours = 0, otAmount = 0, notes = '',
      lateDeductionAmount = 0, hourlyDeductionAmount = 0,
    } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const parsedBreaks = Array.isArray(breakTimes)
      ? breakTimes.map((b) => ({
        breakIn: b?.breakIn ? new Date(b.breakIn) : undefined,
        breakOut: b?.breakOut ? new Date(b.breakOut) : undefined,
        notes: b?.notes || '',
      }))
      : undefined;

    const ci = checkIn !== undefined ? (checkIn ? new Date(checkIn) : null) : undefined;
    const co = checkOut !== undefined ? (checkOut ? new Date(checkOut) : null) : undefined;

    const hours = computeAttendanceHours({
      checkIn: ci,
      checkOut: co,
      breakTimes: parsedBreaks || [],
      status,
      isHalfDay: Boolean(isHalfDay),
    });

    const update = {
      employee: employeeId,
      date: targetDate,
      status,
      isHalfDay: Boolean(isHalfDay),
      isFullDay: Boolean(isFullDay),
      otHours: hours.overtimeHours || Number(otHours),
      otAmount: Number(otAmount),
      lateDeductionAmount: Number(lateDeductionAmount) || 0,
      hourlyDeductionAmount: Number(hourlyDeductionAmount) || 0,
      notes,
      markedBy: req.user._id,
      totalWorkedHours: hours.totalWorkedHours,
      breakHours: hours.breakHours,
      leaveHours: hours.leaveHours,
      nonWorkedHours: hours.nonWorkedHours,
      missingHours: hours.missingHours,
      ...(ci !== undefined && { checkIn: ci }),
      ...(co !== undefined && { checkOut: co }),
      ...(parsedBreaks && { breakTimes: parsedBreaks }),
    };

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: targetDate },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const period = monthYearFromDate(targetDate);
    await triggerPayrollSync({
      employeeId,
      month: period.month,
      year: period.year,
      source: 'attendance',
      module: 'attendance',
      entityId: attendance._id,
      reason: 'Attendance marked/updated',
      user: req.user,
    });

    res.status(200).json({ success: true, attendance });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SELF-SERVICE — Clock In (today only)
// POST /api/attendance/clock-in
// ─────────────────────────────────────────────────────────────────────────────
exports.clockIn = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const today = todayStart();
    const now = new Date();

    const isReset = req.body?.reset || req.body?.forceReset || req.query?.reset === 'true';

    // Check if already clocked in today
    const existing = await Attendance.findOne({ employee: employee._id, date: today });
    if (existing?.checkIn && !isReset) {
      return res.status(400).json({
        success: false,
        message: 'You have already clocked in today',
        alreadyClockedIn: true,
        record: existing,
      });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employee._id, date: today },
      {
        $set: {
          employee: employee._id,
          date: today,
          checkIn: now,
          status: 'present',
          markedBy: req.user._id,
        },
        $unset: { checkOut: 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ success: true, attendance, message: 'Clocked in successfully' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SELF-SERVICE — Clock Out (today only)
// POST /api/attendance/clock-out
// ─────────────────────────────────────────────────────────────────────────────
exports.clockOut = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const today = todayStart();
    const now = new Date();

    let existing = await Attendance.findOne({ employee: employee._id, date: today });
    if (!existing) {
      // If no record exists yet, create one starting from start of work shift or now
      existing = await Attendance.create({
        employee: employee._id,
        date: today,
        checkIn: new Date(now.getTime() - (8 * 3600 * 1000)), // default 8h back
        status: 'present',
        markedBy: req.user._id,
      });
    }

    const effectiveCheckIn = existing.checkIn || existing.createdAt || today;

    const hours = computeAttendanceHours({
      checkIn: effectiveCheckIn,
      checkOut: now,
      breakTimes: existing.breakTimes || [],
      status: existing.status || 'present',
      isHalfDay: existing.isHalfDay,
    });

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employee._id, date: today },
      {
        $set: {
          checkIn: effectiveCheckIn,
          checkOut: now,
          totalWorkedHours: hours.totalWorkedHours,
          breakHours: hours.breakHours,
          leaveHours: hours.leaveHours,
          nonWorkedHours: hours.nonWorkedHours,
          missingHours: hours.missingHours,
          otHours: hours.overtimeHours,
          markedBy: req.user._id,
        },
      },
      { new: true }
    );
    res.status(200).json({ success: true, attendance, message: 'Clocked out successfully' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SELF-SERVICE — Start Break
// POST /api/attendance/break/start
// ─────────────────────────────────────────────────────────────────────────────
exports.startBreak = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const today = todayStart();
    const existing = await Attendance.findOne({ employee: employee._id, date: today });
    if (!existing?.checkIn) {
      return res.status(400).json({ success: false, message: 'You must clock in before starting a break' });
    }
    // Check if there's an open break already
    const openBreak = (existing.breakTimes || []).find((b) => b.breakIn && !b.breakOut);
    if (openBreak) {
      return res.status(400).json({ success: false, message: 'A break is already in progress' });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employee._id, date: today },
      { $push: { breakTimes: { breakIn: new Date(), notes: req.body.notes || '' } } },
      { new: true }
    );
    res.status(200).json({ success: true, attendance, message: 'Break started' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE SELF-SERVICE — End Break
// POST /api/attendance/break/end
// ─────────────────────────────────────────────────────────────────────────────
exports.endBreak = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const today = todayStart();
    const existing = await Attendance.findOne({ employee: employee._id, date: today });
    if (!existing) return res.status(404).json({ success: false, message: 'No attendance record for today' });

    const openIdx = (existing.breakTimes || []).findIndex((b) => b.breakIn && !b.breakOut);
    if (openIdx === -1) {
      return res.status(400).json({ success: false, message: 'No active break to end' });
    }

    const fieldPath = `breakTimes.${openIdx}.breakOut`;
    const attendance = await Attendance.findOneAndUpdate(
      { employee: employee._id, date: today },
      { $set: { [fieldPath]: new Date() } },
      { new: true }
    );
    res.status(200).json({ success: true, attendance, message: 'Break ended' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE — Get today's attendance record
// GET /api/attendance/today
// ─────────────────────────────────────────────────────────────────────────────
exports.getToday = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

    const today = todayStart();
    const record = await Attendance.findOne({ employee: employee._id, date: today });
    res.json({ success: true, record: record || null });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE — Get own attendance history
// GET /api/attendance/my
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyAttendance = async (req, res, next) => {
  try {
    const employee = await resolveEmployee(req.user);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });
    const { month, year } = req.query;
    const query = { employee: employee._id };
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const records = await Attendance.find(query).sort({ date: -1 }).limit(180);
    res.json({ success: true, records });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / MANAGER — Get all attendance records
// GET /api/attendance
// ─────────────────────────────────────────────────────────────────────────────
exports.getAttendance = async (req, res, next) => {
  try {
    const { month, year, employeeId, status, startDate, endDate, branch, manager, includeFormer } = req.query;
    
    // Find active employees based on filters
    const empStatusQuery = (includeFormer === 'true' || includeFormer === '1')
      ? {}
      : { status: { $in: ['active', 'internship', 'contract', 'on_leave'] } };

    const STAFF_ROLES = ['admin', 'owner', 'manager', 'developer', 'marketing', 'designer', 'hr', 'director', 'superadmin'];
    const userRole = String(req.user?.role || '').toLowerCase();
    const isTopMgr = isTopManagerOrAdmin(req.user) || STAFF_ROLES.includes(userRole) || userRole !== 'client';

    const empFilter = {
      ...empStatusQuery,
      ...(manager ? { manager } : {}),
      ...(branch ? { branch } : {})
    };

    if (!isTopMgr) {
      delete empFilter.manager;
      const ownEmp = await Employee.findOne({ userId: req.user._id });
      const ownEmpId = ownEmp ? ownEmp._id : null;
      empFilter.$or = [
        { manager: req.user._id },
        ...(ownEmpId ? [{ _id: ownEmpId }] : [{ userId: req.user._id }])
      ];
    }

    const activeEmps = await Employee.find(empFilter)
      .select('_id userId employeeNo branch status manager firstName lastName')
      .populate('userId', 'name email avatar isActive')
      .lean();

    // Strictly filter only employees with active user accounts
    const validActiveEmps = (includeFormer === 'true' || includeFormer === '1')
      ? activeEmps.filter(e => e.userId)
      : activeEmps.filter(e => e.userId && e.userId.isActive !== false);

    const validActiveEmpIds = new Set(validActiveEmps.map(e => String(e._id)));
    const empMap = new Map(validActiveEmps.map(e => [String(e._id), e]));

    const query = {};
    if (employeeId) {
      query.employee = employeeId;
    } else if (manager || branch) {
      query.employee = { $in: Array.from(validActiveEmpIds) };
    } else if (!isTopMgr) {
      query.employee = { $in: Array.from(validActiveEmpIds) };
    }
    // isTopMgr with no specific filter = no employee restriction (fetch all)

    if (status) query.status = status;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const [sy, sm, sd] = startDate.split('-').map(Number);
        if (sy && sm && sd) {
          query.date.$gte = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
        } else {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          query.date.$gte = s;
        }
      }
      if (endDate) {
        const [ey, em, ed] = endDate.split('-').map(Number);
        if (ey && em && ed) {
          query.date.$lte = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
        } else {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          query.date.$lte = e;
        }
      }
    } else if (month && year) {
      const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));
      query.date = { $gte: start, $lte: end };
    } else {
      // Default to today only if no date scope is provided
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      query.date = { $gte: todayStart, $lte: todayEnd };
    }

    const rawRecords = await Attendance.find(query)
      .select('employee date status checkIn checkOut isHalfDay otHours lateDeductionAmount hourlyDeductionAmount breakTimes totalWorkedHours notes markedBy')
      .sort({ date: -1 })
      .limit(1000)
      .lean();

    // Map populated employee object onto raw records
    const records = rawRecords.map(r => {
      const empId = String(r.employee?._id || r.employee);
      const resolvedEmp = empMap.get(empId) || (typeof r.employee === 'object' ? r.employee : null) || { _id: empId };
      return {
        ...r,
        employee: resolvedEmp
      };
    });

    // Filter out records where employee is null/missing
    const restrictByEmpSet = !isTopMgr || employeeId || branch || manager;
    let filteredRecords = records.filter(r => {
      if (!r.employee || !r.employee._id) return false;
      if (restrictByEmpSet && validActiveEmpIds.size > 0) {
        return validActiveEmpIds.has(String(r.employee._id));
      }
      return true;
    });

    let dStart, dEnd;
    if (startDate && endDate) {
      dStart = new Date(startDate); dStart.setHours(0,0,0,0);
      dEnd = new Date(endDate); dEnd.setHours(23,59,59,999);
    } else if (month && year) {
      dStart = new Date(Number(year), Number(month) - 1, 1);
      dEnd = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
    } else {
      dStart = new Date(); dStart.setHours(0,0,0,0);
      dEnd = new Date(); dEnd.setHours(23,59,59,999);
    }
    const today = new Date();
    if (dEnd > today) dEnd = today;

    const recordMap = new Set();
    filteredRecords.forEach(r => {
      const empId = String(r.employee?._id || r.employee);
      const dObj = new Date(r.date);
      const isoStr = dObj.toISOString().split('T')[0];
      const localStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
      recordMap.add(`${empId}_${isoStr}`);
      recordMap.add(`${empId}_${localStr}`);
    });

    const dummyRecords = [];

    // Only generate dummy absent records for ranges <= 62 days to avoid memory explosion on large ranges
    const rangeDays = Math.ceil((dEnd - dStart) / 86400000);
    if ((!status || status === 'absent') && rangeDays <= 62) {
      const days = [];
      for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d).toISOString().split('T')[0]);
      }
      const empFilterSet = employeeId ? new Set([String(employeeId)]) : validActiveEmpIds;
      
      for (const emp of validActiveEmps) {
        if (!empFilterSet.has(String(emp._id))) continue;
        for (const dayStr of days) {
          const key = `${emp._id}_${dayStr}`;
          if (!recordMap.has(key)) {
            dummyRecords.push({
              _id: `dummy_${key}`,
              employee: emp,
              date: new Date(dayStr),
              status: 'absent',
              isDummy: true
            });
          }
        }
      }
    }
    const allRecords = [...filteredRecords, ...dummyRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, count: allRecords.length, records: allRecords });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / MANAGER — Update a specific record
// PUT /api/attendance/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAttendance = async (req, res, next) => {
  try {
    if (!isTopManagerOrAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Project Managers and Team Leaders cannot update attendance records.'
      });
    }

    const existing = await Attendance.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Record not found' });

    const body = { ...req.body };
    if (body.checkIn) body.checkIn = new Date(body.checkIn);
    if (body.checkOut) body.checkOut = new Date(body.checkOut);
    if (Array.isArray(body.breakTimes)) {
      body.breakTimes = body.breakTimes.map((b) => ({
        breakIn: b?.breakIn ? new Date(b.breakIn) : undefined,
        breakOut: b?.breakOut ? new Date(b.breakOut) : undefined,
        notes: b?.notes || '',
      }));
    }

    const hours = computeAttendanceHours({
      checkIn: body.checkIn ?? existing.checkIn,
      checkOut: body.checkOut ?? existing.checkOut,
      breakTimes: body.breakTimes ?? existing.breakTimes,
      status: body.status ?? existing.status,
      isHalfDay: body.isHalfDay ?? existing.isHalfDay,
    });

    const record = await Attendance.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...body,
          totalWorkedHours: hours.totalWorkedHours,
          breakHours: hours.breakHours,
          leaveHours: hours.leaveHours,
          nonWorkedHours: hours.nonWorkedHours,
          missingHours: hours.missingHours,
          otHours: hours.overtimeHours || body.otHours || existing.otHours,
          markedBy: req.user._id,
        },
      },
      { new: true, runValidators: true }
    );
    const period = monthYearFromDate(record.date);
    await triggerPayrollSync({
      employeeId: record.employee,
      month: period.month,
      year: period.year,
      source: 'attendance',
      module: 'attendance',
      entityId: record._id,
      reason: 'Attendance record updated',
      user: req.user,
    });

    res.json({ success: true, attendance: record });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN / MANAGER — Analytics
// GET /api/attendance/analytics
// ─────────────────────────────────────────────────────────────────────────────
exports.getAttendanceAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const { branch, startDate, endDate } = req.query;
    
    let start, end, month, year;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      month = start.getMonth() + 1;
      year = start.getFullYear();
    } else {
      month = Number(req.query.month || now.getMonth() + 1);
      year = Number(req.query.year || now.getFullYear());
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0, 23, 59, 59, 999);
    }

    const isTopMgr = isTopManagerOrAdmin(req.user);
    const empFilter = {
      status: { $in: ['active', 'internship', 'contract', 'on_leave'] },
      ...(branch ? { branch } : {})
    };

    if (!isTopMgr) {
      const ownEmp = await Employee.findOne({ userId: req.user._id });
      const ownEmpId = ownEmp ? ownEmp._id : null;
      empFilter.$or = [
        { manager: req.user._id },
        ...(ownEmpId ? [{ _id: ownEmpId }] : [{ userId: req.user._id }])
      ];
    }

    const activeEmps = await Employee.find(empFilter)
      .select('_id userId employeeNo branch manager status firstName lastName')
      .populate('userId', 'name employeeNo isActive')
      .lean();

    const validActiveEmps = activeEmps.filter(e => e.userId && e.userId.isActive !== false);
    const validActiveEmpIds = new Set(validActiveEmps.map(e => String(e._id)));
    const empMap = new Map(validActiveEmps.map(e => [String(e._id), e]));

    const query = {
      date: { $gte: start, $lte: end },
      employee: { $in: Array.from(validActiveEmpIds) }
    };

    const records = await Attendance.find(query)
      .select('employee date status isHalfDay checkIn checkOut otHours totalWorkedHours')
      .maxTimeMS(6000)
      .lean();

    const today = new Date();
    let dEnd = end > today ? today : end;
    
    const recordMap = new Set(records.map(r => `${r.employee?._id || r.employee}_${new Date(r.date).toISOString().split('T')[0]}`));
    const days = [];
    for (let d = new Date(start); d <= dEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d).toISOString().split('T')[0]);
    }
    
    const dummyRecords = [];
    for (const emp of validActiveEmps) {
      for (const dayStr of days) {
        const key = `${emp._id}_${dayStr}`;
        if (!recordMap.has(key)) {
          dummyRecords.push({
            employee: emp,
            date: new Date(dayStr),
            status: 'absent',
            isHalfDay: false
          });
        }
      }
    }
    
    const allRecords = [...records, ...dummyRecords];

    const byStatus = allRecords.reduce((acc, row) => {
      const key = row.isHalfDay ? 'half_day' : row.status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const byEmployee = allRecords.reduce((acc, row) => {
      const empId = String(row.employee?._id || row.employee);
      const empObj = empMap.get(empId) || (typeof row.employee === 'object' ? row.employee : null);
      const name = empObj?.userId?.name || (empObj?.firstName ? `${empObj.firstName} ${empObj.lastName || ''}`.trim() : '') || 'Employee';
      const employeeNo = empObj?.employeeNo || empObj?.userId?.employeeNo || '';
      if (!acc[empId]) acc[empId] = { employeeId: empId, employeeNo, name, present: 0, absent: 0, leave: 0, half_day: 0 };
      const key = row.isHalfDay ? 'half_day' : row.status;
      if (acc[empId][key] !== undefined) acc[empId][key] += 1;
      return acc;
    }, {});

    const dailyTrendMap = {};
    allRecords.forEach((row) => {
      const day = new Date(row.date).getDate();
      if (!dailyTrendMap[day]) dailyTrendMap[day] = { day, present: 0, absent: 0, leave: 0, half_day: 0 };
      const key = row.isHalfDay ? 'half_day' : row.status;
      if (dailyTrendMap[day][key] !== undefined) dailyTrendMap[day][key] += 1;
    });

    res.json({
      success: true, month, year, byStatus,
      byEmployee: Object.values(byEmployee).sort((a, b) => (b.present + b.half_day) - (a.present + a.half_day)),
      dailyTrend: Object.values(dailyTrendMap).sort((a, b) => a.day - b.day),
      totalRecords: allRecords.length,
    });
  } catch (err) { next(err); }
};
