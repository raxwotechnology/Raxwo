const Performance = require('../models/Performance');
const { isTopManagerOrAdmin } = require('../utils/userPermissions');
const { getManagerScope } = require('../utils/managerScope');

exports.upsertPerformance = async (req, res, next) => {
  try {
    const { developer, month, year, tasksCompleted = 0, commits = 0, codeQuality = 0, collaboration = 0, project, notes = '' } = req.body;
    if (!isTopManagerOrAdmin(req.user)) {
      const scope = await getManagerScope(req.user);
      const isAllowed = scope.userIds.some(id => String(id) === String(developer));
      if (!isAllowed) {
        return res.status(403).json({ success: false, message: 'You can only review performance for your team members.' });
      }
    }
    const score = Math.round((Number(tasksCompleted) * 0.35) + (Number(commits) * 0.2) + (Number(codeQuality) * 0.3) + (Number(collaboration) * 0.15));
    const record = await Performance.findOneAndUpdate(
      { developer, month, year },
      { developer, month, year, tasksCompleted, commits, codeQuality, collaboration, score, project, notes },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, record });
  } catch (err) { next(err); }
};

exports.getPerformance = async (req, res, next) => {
  try {
    const query = {};
    if (!isTopManagerOrAdmin(req.user)) {
      const scope = await getManagerScope(req.user);
      if (req.query.developer) {
        if (scope.userIds.some(id => String(id) === String(req.query.developer))) {
          query.developer = req.query.developer;
        } else {
          query.developer = { $in: [] };
        }
      } else {
        query.developer = { $in: scope.userIds };
      }
    } else if (req.query.developer) {
      query.developer = req.query.developer;
    }

    if (req.query.month) query.month = Number(req.query.month);
    if (req.query.year) query.year = Number(req.query.year);
    const records = await Performance.find(query)
      .populate('developer', 'name email role')
      .populate('project', 'title status')
      .sort({ year: -1, month: -1, score: -1 });
    res.json({ success: true, count: records.length, records });
  } catch (err) { next(err); }
};

exports.updatePerformance = async (req, res, next) => {
  try {
    const record = await Performance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Review not found' });

    const fields = ['tasksCompleted', 'commits', 'codeQuality', 'collaboration', 'notes', 'project'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    });
    record.score = Math.round(
      (Number(record.tasksCompleted) * 0.35) +
      (Number(record.commits) * 0.2) +
      (Number(record.codeQuality) * 0.3) +
      (Number(record.collaboration) * 0.15)
    );
    await record.save();

    const populated = await Performance.findById(record._id)
      .populate('developer', 'name email role')
      .populate('project', 'title status');

    res.json({ success: true, record: populated });
  } catch (err) { next(err); }
};

exports.deletePerformance = async (req, res, next) => {
  try {
    const record = await Performance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Review not found' });
    await record.deleteOne();
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) { next(err); }
};
