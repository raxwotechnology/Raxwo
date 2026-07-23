const Project  = require('../models/Project');
const Invoice  = require('../models/Invoice');
const Target   = require('../models/Target');
const Employee = require('../models/Employee');
const Payroll  = require('../models/Payroll');
const path = require('path');
const fs   = require('fs');
const { createNotification } = require('../services/notificationService');
const { triggerPayrollSync, monthYearFromDate } = require('../utils/payrollSyncHook');
const {
  validateInvoicesBelongToClient,
  normalizeInvoiceIds,
  loadInvoicesForProject,
  applyPaymentStatusToProject,
} = require('../utils/projectInvoiceSync');

const POPULATE = [
  { path: 'client', select: 'name email avatar phone' },
  { path: 'projectManager', select: 'name email avatar' },
  { path: 'assignedEmployees', select: 'name email avatar status' },
  { path: 'salaryAllocations.employee', populate: { path: 'userId', select: 'name email avatar status' } },
  { path: 'branch', select: 'name' },
  { path: 'invoice', select: 'invoiceNo total totalPaid totalAdvances remainingBalance status dueDate payments currency' },
  { path: 'linkedInvoices', select: 'invoiceNo total totalPaid remainingBalance status dueDate currency' },
  { path: 'tasks.assignedTo', select: 'name email avatar' },
  { path: 'notes.createdBy', select: 'name' },
];

// ── GET all projects ──────────────────────────────────────────────────────────
exports.getProjects = async (req, res, next) => {
  try {
    const { status, client, branch } = req.query;
    let query = {};
    if (status) query.status = status;
    if (branch) query.branch = branch;

    if (req.user.role === 'client') query.client = req.user._id;
    else if (client) query.client = client;
    if (['developer', 'designer', 'marketing'].includes(req.user.role)) query.assignedEmployees = req.user._id;

    // Auto-mark overdue
    const now = new Date();
    await Project.updateMany(
      { status: 'active', deadline: { $lt: now } },
      { status: 'overdue' }
    );

    const projects = await Project.find(query)
      .populate('client', 'name email avatar')
      .populate('branch', 'name')
      .populate('invoice', 'invoiceNo total totalPaid remainingBalance status')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: projects.length, projects });
  } catch (err) { next(err); }
};

// ── GET single project ────────────────────────────────────────────────────────
exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate(POPULATE);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, project });
  } catch (err) { next(err); }
};

// ── CREATE project ────────────────────────────────────────────────────────────
async function applyInvoiceLinks(payload) {
  const invoiceIds = normalizeInvoiceIds(payload);
  if (!invoiceIds.length) {
    payload.linkedInvoices = [];
    delete payload.invoice;
    return { invoiceIds: [] };
  }
  await validateInvoicesBelongToClient(payload.client, invoiceIds);
  payload.linkedInvoices = invoiceIds;
  payload.invoice = invoiceIds[0];
  return { invoiceIds };
}

exports.createProject = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (!payload.client) delete payload.client;
    if (!payload.projectManager) delete payload.projectManager;
    if (!payload.branch) delete payload.branch;
    if (!Array.isArray(payload.assignedEmployees)) payload.assignedEmployees = [];
    payload.assignedEmployees = payload.assignedEmployees.filter(Boolean);

    const { invoiceIds } = await applyInvoiceLinks(payload);
    const invoices = await loadInvoicesForProject(invoiceIds);

    const project = await Project.create(payload);
    await applyPaymentStatusToProject(project, invoices);
    await project.save();

    if (invoiceIds.length && project.client) {
      await Invoice.updateMany(
        { _id: { $in: invoiceIds }, client: project.client },
        { $set: { project: project._id } },
      );
    }

    // Fire-and-forget: notifications + email/SMS should not block response or crash project creation
    if (project.client) {
      createNotification({
        recipient: project.client,
        title: 'New Project Created',
        message: `Your project "${project.title}" has been created and is in ${project.status} stage.`,
        type: 'project', link: '/my-projects',
      }).catch(e => console.error('[Project] Notification failed:', e.message));

      // Send client email/SMS in the background
      (async () => {
        try {
          const populatedProj = await Project.findById(project._id).populate('client');
          if (populatedProj?.client?.email) {
            const { sendProjectAssignedClientEmail } = require('../services/emailService');
            await sendProjectAssignedClientEmail(populatedProj.client.email, populatedProj.client.name, project);
            console.log(`[Project] ✅ Email sent to client: ${populatedProj.client.email}`);
          }
          if (populatedProj?.client?.phone) {
            const { sendProjectAssignedClientSms } = require('../services/smsService');
            await sendProjectAssignedClientSms(populatedProj.client.phone, populatedProj.client.name, project.title);
            console.log(`[Project] ✅ SMS sent to client: ${populatedProj.client.phone}`);
          }
        } catch (emailErr) {
          console.error('[Project] ❌ Client email/SMS failed:', emailErr.message);
        }
      })();
    }

    if (project.assignedEmployees?.length > 0) {
      // Send employee emails/SMS in the background
      (async () => {
        try {
          const { sendProjectAssignedEmployeeEmail } = require('../services/emailService');
          const { sendProjectAssignedEmployeeSms } = require('../services/smsService');
          const populatedProj = await Project.findById(project._id).populate('client');
          const User = require('../models/User');
          for (const empId of project.assignedEmployees) {
            createNotification({
              recipient: empId,
              title: 'New Project Assignment',
              message: `You have been assigned to project "${project.title}".`,
              type: 'project', link: '/developer/projects',
            }).catch(e => console.error('[Project] Employee notification failed:', e.message));
            const empUser = await User.findById(empId);
            const pDetails = { title: project.title, deadline: project.deadline, clientName: populatedProj?.client?.name };
            if (empUser?.email) {
              await sendProjectAssignedEmployeeEmail(empUser.email, empUser.name, pDetails);
              console.log(`[Project] ✅ Email sent to employee: ${empUser.email}`);
            }
            if (empUser?.phone) {
              await sendProjectAssignedEmployeeSms(empUser.phone, empUser.name, project.title);
              console.log(`[Project] ✅ SMS sent to employee: ${empUser.phone}`);
            }
          }
        } catch (empErr) {
          console.error('[Project] ❌ Employee email/SMS failed:', empErr.message);
        }
      })();
    }

    const populated = await Project.findById(project._id).populate(POPULATE);
    res.status(201).json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── UPDATE project ────────────────────────────────────────────────────────────
exports.updateProject = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.client === '') delete payload.client;
    if (payload.projectManager === '') delete payload.projectManager;
    if (Array.isArray(payload.assignedEmployees)) payload.assignedEmployees = payload.assignedEmployees.filter(Boolean);

    const hasInvoicePayload = payload.invoice !== undefined || payload.linkedInvoices !== undefined;
    if (hasInvoicePayload) {
      const existing = await Project.findById(req.params.id).select('client');
      const clientId = payload.client || existing?.client;
      payload.client = clientId;
      await applyInvoiceLinks(payload);
    }

    const oldProject = await Project.findById(req.params.id).select('status assignedEmployees title client');
    let project = await Project.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    if (hasInvoicePayload) {
      const ids = [
        ...(project.invoice ? [project.invoice] : []),
        ...(project.linkedInvoices || []),
      ];
      const invoices = await loadInvoicesForProject(ids);
      await applyPaymentStatusToProject(project, invoices);
      await project.save();
      if (ids.length && project.client) {
        await Invoice.updateMany(
          { _id: { $in: ids }, client: project.client },
          { $set: { project: project._id } },
        );
      }
    }

    project = await Project.findById(project._id).populate(POPULATE);

    // ── Auto-update Target progress on completion ──────────────────────────────
    const COMPLETION_STATUSES = ['completed', 'completed_payment_pending', 'paid_completed'];
    const wasNotCompleted = !COMPLETION_STATUSES.includes(oldProject?.status);
    const isNowCompleted  = COMPLETION_STATUSES.includes(project.status);

    // ── Notify Client on Status Change ──────────────────────────────
    if (project.client && oldProject?.status !== project.status) {
      const { createNotification } = require('../services/notificationService');
      await createNotification({
        recipient: project.client._id || project.client,
        title: 'Project Status Updated',
        message: `Your project "${project.title}" status has been updated to "${project.status.replace(/_/g, ' ')}".`,
        type: 'project',
        link: '/my-projects'
      });
    }

    // ── Notify Client if newly assigned to project ──────────────────
    const oldClientStr = oldProject?.client ? String(oldProject.client) : null;
    const newClientStr = project.client ? String(project.client._id || project.client) : null;
    
    if (newClientStr && newClientStr !== oldClientStr) {
      const { sendProjectAssignedClientEmail } = require('../services/emailService');
      const { sendProjectAssignedClientSms } = require('../services/smsService');
      const popProj = await Project.findById(project._id).populate('client');
      
      if (popProj.client?.email) {
        await sendProjectAssignedClientEmail(popProj.client.email, popProj.client.name, project);
      }
      if (popProj.client?.phone) {
        await sendProjectAssignedClientSms(popProj.client.phone, popProj.client.name, project.title);
      }
    }

    // ── Notify newly assigned employees ─────────────────────────────
    if (project.assignedEmployees?.length > 0) {
      const oldAssigned = oldProject?.assignedEmployees?.map(e => String(e._id || e)) || [];
      const newAssigned = project.assignedEmployees.map(e => String(e._id || e));
      const newlyAssigned = newAssigned.filter(e => !oldAssigned.includes(e));

      if (newlyAssigned.length > 0) {
        const { sendProjectAssignedEmployeeEmail } = require('../services/emailService');
        const { sendProjectAssignedEmployeeSms } = require('../services/smsService');
        const popProj = await Project.findById(project._id).populate('client');
        const User = require('../models/User');

        for (const empId of newlyAssigned) {
          await createNotification({
            recipient: empId,
            title: 'New Project Assignment',
            message: `You have been added to project "${project.title}".`,
            type: 'project', link: '/developer/projects',
          });
          const empUser = await User.findById(empId);
          const pDetails = { title: project.title, deadline: project.deadline, clientName: popProj?.client?.name };
          if (empUser?.email) await sendProjectAssignedEmployeeEmail(empUser.email, empUser.name, pDetails);
          if (empUser?.phone) await sendProjectAssignedEmployeeSms(empUser.phone, empUser.name, project.title);
        }
      }
    }

    if (wasNotCompleted && isNowCompleted && project.assignedEmployees?.length) {
      for (const userObj of project.assignedEmployees) {
        const userId = userObj._id || userObj;
        // Find the Employee record for this user
        const emp = await Employee.findOne({ userId }).select('_id basicSalary');
        if (!emp) continue;

        // Find active/partial targets for this employee
        const now = new Date();
        const targets = await Target.find({
          employee: emp._id,
          status: { $in: ['active', 'partial'] },
          year: now.getFullYear(),
        });

        for (const target of targets) {
          target.achievedValue = (target.achievedValue || 0) + 1;
          const pct = target.targetValue > 0 ? (target.achievedValue / target.targetValue) * 100 : 0;

          if (pct >= 100) {
            target.status = 'achieved';
            target.achievedAt = target.achievedAt || new Date();

            // Auto-push bonus to payroll
            if (target.bonusEnabled && !target.bonusAdded) {
              let bonusAmt = target.bonusAmount || 0;
              if (target.bonusPercentage > 0) bonusAmt += (emp.basicSalary || 0) * (target.bonusPercentage / 100);
              if (bonusAmt > 0) {
                const period = monthYearFromDate(now);
                await triggerPayrollSync({
                  employeeId: emp._id,
                  month: period.month,
                  year: period.year,
                  source: 'project_target',
                  module: 'projects',
                  entityId: target._id,
                  reason: `Target achieved: ${target.title}`,
                  user: req.user,
                });
                target.bonusAdded = true;
              }
              // Notify employee
              await createNotification({
                recipient: userId,
                title: '🏆 Target Achieved!',
                message: `You completed "${project.title}" and achieved your target "${target.title}". Bonus has been added to payroll!`,
                type: 'payroll', link: '/developer/performance',
              });
            } else {
              await createNotification({
                recipient: userId,
                title: '🏆 Target Achieved!',
                message: `Great work! You achieved your target "${target.title}" by completing "${project.title}".`,
                type: 'project', link: '/developer/performance',
              });
            }
          } else if (pct > 0) {
            target.status = 'partial';
            // Progress notification
            await createNotification({
              recipient: userId,
              title: '🎯 Target Progress Updated',
              message: `Target "${target.title}" updated to ${Math.round(pct)}% after completing "${project.title}".`,
              type: 'project', link: '/developer/performance',
            });
          }
          await target.save();
        }
      }
    }

    if (project.client) {
      await createNotification({ recipient: project.client._id || project.client, title: 'Project Updated', message: `Project "${project.title}" has been updated.`, type: 'project', link: '/my-projects' });
    }

    const period = monthYearFromDate();
    const empIds = new Set((project.salaryAllocations || []).map((a) => String(a.employee)));
    for (const empId of empIds) {
      await triggerPayrollSync({
        employeeId: empId,
        month: period.month,
        year: period.year,
        source: 'project',
        module: 'projects',
        entityId: project._id,
        reason: 'Project commissions/allocations updated',
        user: req.user,
      });
    }

    res.json({ success: true, project });
  } catch (err) { next(err); }
};

// ── DELETE project ────────────────────────────────────────────────────────────
exports.deleteProject = async (req, res, next) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) { next(err); }
};

// ── ADD NOTE ──────────────────────────────────────────────────────────────────
exports.addNote = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    project.notes.push({
      content: req.body.content,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.status(201).json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── UPDATE NOTE ───────────────────────────────────────────────────────────────
exports.updateNote = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    const note = project.notes.id(req.params.noteId);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    note.content = String(content).trim();
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── DELETE NOTE ───────────────────────────────────────────────────────────────
exports.deleteNote = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    const note = project.notes.id(req.params.noteId);
    if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
    project.notes.pull(req.params.noteId);
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── ADD LINK ──────────────────────────────────────────────────────────────────
exports.addLink = async (req, res, next) => {
  try {
    let { label, url } = req.body;
    label = label != null ? String(label).trim() : '';
    url = url != null ? String(url).trim() : '';
    if (!label || !url) return res.status(400).json({ success: false, message: 'Label and URL are required' });
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    project.links.push({ label, url, addedBy: req.user._id });
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── REMOVE LINK ───────────────────────────────────────────────────────────────
exports.removeLink = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    project.links = project.links.filter(l => String(l._id) !== req.params.linkId);
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── UPLOAD DOCUMENT ───────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    project.documents.push({
      name: req.body.name || req.file.originalname,
      url: `/uploads/documents/${req.file.filename}`,
      fileType: req.file.mimetype,
      uploadedBy: req.user._id,
      uploadedByName: req.user.name,
    });
    await project.save();
    const populated = await Project.findById(project._id).populate(POPULATE);
    res.status(201).json({ success: true, project: populated });
  } catch (err) { next(err); }
};

// ── REMOVE DOCUMENT ───────────────────────────────────────────────────────────
exports.removeDocument = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    project.documents = project.documents.filter(d => String(d._id) !== req.params.docId);
    await project.save();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── TASKS ─────────────────────────────────────────────────────────────────────
exports.addTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    project.tasks.push(req.body);
    await project.save();
    res.status(201).json({ success: true, project });
  } catch (err) { next(err); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Not found' });
    const task = project.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    Object.assign(task, req.body);
    if (req.body.status === 'done') task.completedAt = new Date();
    await project.save();
    if (task.assignedTo) {
      await createNotification({ recipient: task.assignedTo, title: 'Task Updated', message: `Task "${task.title}" status: ${task.status}`, type: 'project', link: '/developer/tasks' });
    }
    res.json({ success: true, project });
  } catch (err) { next(err); }
};

// ── STATS ─────────────────────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const total = await Project.countDocuments();
    const active = await Project.countDocuments({ status: 'active' });
    const completed = await Project.countDocuments({ status: 'completed' });
    const byStatus = await Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    res.json({ success: true, stats: { total, active, completed, byStatus } });
  } catch (err) { next(err); }
};
