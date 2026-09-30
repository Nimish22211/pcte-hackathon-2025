const express = require('express');
const { body, validationResult } = require('express-validator');
const Issue = require('../models/Issue');
const User = require('../models/User');
const { auth, requireRole, optionalAuth } = require('../middleware/auth');
const { CATEGORIES, STATUSES } = require('../config/constants');
const { checkStatusChange, presentIssue, presentHistory } = require('../config/workflow');

const router = express.Router();

// Answers with the status carried by model errors (403/400), or a generic 500
const handleError = (res, error, logMessage, clientMessage) => {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(logMessage, error);
  return res.status(500).json({ error: clientMessage });
};

// Payload broadcast to everyone in the "issues" room: never contains internal data
const publicPayload = (issue) => presentIssue(issue, null);

// Re-reads an issue after a change so responses include reporter / official / serviceman names
const reload = async (issueModel, changed) => (changed ? (await issueModel.findById(changed.id)) || changed : changed);

const validationFailed = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: 'Validation failed', details: errors.array() });
  return true;
};

// @route   GET /api/issues
// @desc    Get all issues with optional filters
// @access  Public (with optional auth)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const issueModel = new Issue(req.db);
    const issues = await issueModel.findAll(req.query);

    res.json(issues.map((issue) => presentIssue(issue, req.user)));
  } catch (error) {
    handleError(res, error, 'Get issues error:', 'Server error while fetching issues');
  }
});

// @route   GET /api/issues/analytics
// @desc    Get analytics data
// @access  Private (Admin only)
router.get('/analytics', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const issueModel = new Issue(req.db);
    res.json(await issueModel.getAnalytics());
  } catch (error) {
    handleError(res, error, 'Get analytics error:', 'Server error while fetching analytics');
  }
});

// @route   GET /api/issues/trends
// @desc    Get trend data for charts
// @access  Private (Admin only)
router.get('/trends', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const issueModel = new Issue(req.db);
    const months = parseInt(req.query.months, 10) || 6;
    res.json(await issueModel.getTrendData(months));
  } catch (error) {
    handleError(res, error, 'Get trends error:', 'Server error while fetching trends');
  }
});

// @route   GET /api/issues/official-stats/:officialId
// @desc    Get statistics for an official or serviceman
// @access  Private (Official/Serviceman: own stats only, Admin: anyone)
router.get('/official-stats/:officialId', [
  auth,
  requireRole(['official', 'serviceman', 'admin'])
], async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.officialId) {
      return res.status(403).json({ error: 'Access denied. Can only view your own statistics.' });
    }

    const issueModel = new Issue(req.db);
    res.json(await issueModel.getOfficialStats(req.params.officialId));
  } catch (error) {
    handleError(res, error, 'Get official stats error:', 'Server error while fetching official statistics');
  }
});

// @route   GET /api/issues/assigned/:officialId
// @desc    Get issues assigned to an official (as official) or serviceman (as serviceman)
// @access  Private (Official/Serviceman: own issues only, Admin: anyone)
router.get('/assigned/:officialId', [
  auth,
  requireRole(['official', 'serviceman', 'admin'])
], async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.officialId) {
      return res.status(403).json({ error: 'Access denied. Can only view your own assigned issues.' });
    }

    const issueModel = new Issue(req.db);
    const issues = await issueModel.findByAssignedOfficial(req.params.officialId);
    res.json(issues.map((issue) => presentIssue(issue, req.user)));
  } catch (error) {
    handleError(res, error, 'Get assigned issues error:', 'Server error while fetching assigned issues');
  }
});

// @route   GET /api/issues/:id
// @desc    Get issue by ID (internal notes and reporter details only for staff on the issue)
// @access  Public (with optional auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const issueModel = new Issue(req.db);
    const issue = await issueModel.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    res.json(presentIssue(issue, req.user));
  } catch (error) {
    handleError(res, error, 'Get issue error:', 'Server error while fetching issue');
  }
});

// @route   POST /api/issues
// @desc    Create a new issue
// @access  Private
router.post('/', [
  auth,
  body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Title must be between 5 and 255 characters'),
  body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category').isIn(CATEGORIES).withMessage('Invalid category'),
  body('severity').isInt({ min: 1, max: 5 }).withMessage('Severity must be between 1 and 5'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('address').optional({ values: 'null' }).isString().withMessage('Address must be a string'),
  body('photos').optional({ values: 'null' }).isArray({ max: 5 }).withMessage('Photos must be an array of up to 5 items')
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    const issueModel = new Issue(req.db);
    const issue = await issueModel.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      severity: req.body.severity,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: req.body.address,
      photos: req.body.photos,
      reported_by: req.user.id
    });

    // Real-time update to everyone watching issues
    req.io.to('issues').emit('issue-created', publicPayload(issue));

    // Notification for admins and officials
    req.io.to('admin-notifications').emit('notification', {
      type: 'issue_created',
      title: 'New Issue Reported',
      message: `${issue.title} has been reported in ${issue.category}`,
      issueId: issue.id,
      userId: req.user.id
    });

    res.status(201).json(presentIssue(issue, req.user));
  } catch (error) {
    handleError(res, error, 'Create issue error:', 'Server error while creating issue');
  }
});

// @route   PUT /api/issues/:id/status
// @desc    Update issue status (see config/workflow.js for who may do what)
// @access  Private (Official/Serviceman/Admin)
router.put('/:id/status', [
  auth,
  requireRole(['official', 'serviceman', 'admin']),
  body('status').isIn(STATUSES).withMessage('Invalid status'),
  body('internal_notes').optional({ values: 'falsy' }).isString().withMessage('Internal notes must be a string')
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    const issueModel = new Issue(req.db);
    const { status, internal_notes } = req.body;

    const updatedIssue = await reload(issueModel, await issueModel.updateStatus(
      req.params.id,
      status,
      req.user.id,
      internal_notes,
      (current) => checkStatusChange(req.user, current, status)
    ));

    if (!updatedIssue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    req.io.to('issues').emit('issue-status-changed', {
      issue: publicPayload(updatedIssue),
      updatedBy: req.user.name,
      timestamp: new Date().toISOString()
    });

    // Tell everyone involved except the person who made the change
    const label = status.replace('_', ' ');
    const audience = [
      { id: updatedIssue.reported_by, message: `Your issue "${updatedIssue.title}" status changed to ${label}` },
      { id: updatedIssue.assigned_to, message: `Issue "${updatedIssue.title}" is now ${label}` },
      { id: updatedIssue.serviceman_id, message: `Issue "${updatedIssue.title}" is now ${label}` }
    ];
    const notified = new Set([req.user.id]);
    audience.forEach(({ id, message }) => {
      if (!id || notified.has(id)) return;
      notified.add(id);
      req.io.to(`user-${id}`).emit('notification', {
        type: status === 'resolved' ? 'issue_resolved' : 'issue_status_changed',
        title: 'Issue Status Updated',
        message,
        issueId: updatedIssue.id,
        userId: req.user.id
      });
    });

    res.json(presentIssue(updatedIssue, req.user));
  } catch (error) {
    handleError(res, error, 'Update issue status error:', 'Server error while updating issue status');
  }
});

// @route   PUT /api/issues/:id/assign
// @desc    Assign issue to an official
// @access  Private (Admin only)
router.put('/:id/assign', [
  auth,
  requireRole(['admin']),
  body('assigned_to').isString().notEmpty().withMessage('Assigned to must be a valid user ID')
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    const issueModel = new Issue(req.db);
    const userModel = new User(req.db);

    const official = await userModel.findById(req.body.assigned_to);
    if (!official || official.role !== 'official') {
      return res.status(400).json({ error: 'Issues can only be assigned to an active official' });
    }

    const updatedIssue = await reload(issueModel, await issueModel.assignToOfficial(req.params.id, official, req.user.id));

    if (!updatedIssue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    req.io.to('issues').emit('issue-assigned', {
      issue: publicPayload(updatedIssue),
      assignedTo: official.name,
      assignedBy: req.user.name,
      timestamp: new Date().toISOString()
    });

    // Notify the official
    req.io.to(`user-${official.id}`).emit('notification', {
      type: 'issue_assigned',
      title: 'New Issue Assigned',
      message: `You have been assigned to issue: "${updatedIssue.title}". Please choose a serviceman.`,
      issueId: updatedIssue.id,
      userId: req.user.id
    });

    // Notify the reporter
    if (updatedIssue.reported_by) {
      req.io.to(`user-${updatedIssue.reported_by}`).emit('notification', {
        type: 'issue_assigned',
        title: 'Issue Assigned',
        message: `Your issue "${updatedIssue.title}" has been assigned to ${official.name}`,
        issueId: updatedIssue.id,
        userId: req.user.id
      });
    }

    res.json(presentIssue(updatedIssue, req.user));
  } catch (error) {
    handleError(res, error, 'Assign issue error:', 'Server error while assigning issue');
  }
});

// @route   PUT /api/issues/:id/assign-serviceman
// @desc    Choose the serviceman who will do the work
// @access  Private (assigned Official, or Admin)
router.put('/:id/assign-serviceman', [
  auth,
  requireRole(['official', 'admin']),
  body('serviceman_id').isString().notEmpty().withMessage('Serviceman is required')
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    const issueModel = new Issue(req.db);
    const userModel = new User(req.db);

    const serviceman = await userModel.findById(req.body.serviceman_id);
    if (!serviceman || serviceman.role !== 'serviceman') {
      return res.status(400).json({ error: 'Work can only be assigned to an active serviceman' });
    }

    // Officials may only use servicemen from their own department
    if (req.user.role === 'official' && serviceman.department !== req.user.department) {
      return res.status(403).json({ error: 'You can only assign servicemen from your own department' });
    }

    const updatedIssue = await reload(issueModel, await issueModel.assignServiceman(req.params.id, serviceman, req.user));

    if (!updatedIssue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    req.io.to('issues').emit('issue-assigned', {
      issue: publicPayload(updatedIssue),
      assignedTo: serviceman.name,
      assignedBy: req.user.name,
      timestamp: new Date().toISOString()
    });

    // Notify the serviceman
    req.io.to(`user-${serviceman.id}`).emit('notification', {
      type: 'issue_assigned',
      title: 'New Job Assigned',
      message: `You have been assigned to issue: "${updatedIssue.title}"`,
      issueId: updatedIssue.id,
      userId: req.user.id
    });

    // Notify the reporter
    if (updatedIssue.reported_by) {
      req.io.to(`user-${updatedIssue.reported_by}`).emit('notification', {
        type: 'issue_assigned',
        title: 'Issue Assigned',
        message: `A serviceman has been assigned to your issue "${updatedIssue.title}"`,
        issueId: updatedIssue.id,
        userId: req.user.id
      });
    }

    res.json(presentIssue(updatedIssue, req.user));
  } catch (error) {
    handleError(res, error, 'Assign serviceman error:', 'Server error while assigning serviceman');
  }
});

// @route   GET /api/issues/:id/history
// @desc    Get issue status history (notes and staff names only for staff on the issue)
// @access  Private
router.get('/:id/history', auth, async (req, res) => {
  try {
    const issueModel = new Issue(req.db);
    const issue = await issueModel.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const history = await issueModel.getStatusHistory(req.params.id);
    res.json(presentHistory(history, issue, req.user));
  } catch (error) {
    handleError(res, error, 'Get issue history error:', 'Server error while fetching issue history');
  }
});

module.exports = router;
