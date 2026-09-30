const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { ROLES, DEPARTMENTS, DEPARTMENT_ROLES } = require('../config/constants');

const router = express.Router();

const validationFailed = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ error: 'Validation failed', details: errors.array() });
  return true;
};

// Officials and servicemen must belong to a department
const departmentRule = body('department').custom((value, { req }) => {
  if (DEPARTMENT_ROLES.includes(req.body.role)) {
    if (!DEPARTMENTS.includes(value)) {
      throw new Error('A valid department is required for officials and servicemen');
    }
  } else if (value && !DEPARTMENTS.includes(value)) {
    throw new Error('Invalid department');
  }
  return true;
});

const departmentFor = (role, department) => (DEPARTMENT_ROLES.includes(role) ? department : null);

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin only)
router.get('/', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const userModel = new User(req.db);
    res.json(await userModel.findAll(req.query));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
});

// @route   POST /api/users
// @desc    Appoint staff: create an account with a role (Admin only)
// @access  Private (Admin only)
router.post('/', [
  auth,
  requireRole(['admin']),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().toLowerCase().isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ values: 'falsy' }).isMobilePhone().withMessage('Please provide a valid phone number'),
  body('role').isIn(ROLES).withMessage('Invalid role'),
  departmentRule
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    const { name, email, password, phone, role, department } = req.body;
    const userModel = new User(req.db);

    const user = await userModel.create({
      name,
      email,
      password,
      phone,
      role,
      department: departmentFor(role, department)
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error while creating user' });
  }
});

// @route   GET /api/users/officials
// @desc    Get all active officials (used by admins to assign issues)
// @access  Private (Admin only)
router.get('/officials', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const userModel = new User(req.db);
    res.json(await userModel.findByRoles(['official']));
  } catch (error) {
    console.error('Get officials error:', error);
    res.status(500).json({ error: 'Server error while fetching officials' });
  }
});

// @route   GET /api/users/servicemen
// @desc    Get active servicemen. Officials only get servicemen of their own department.
// @access  Private (Official/Admin)
router.get('/servicemen', [
  auth,
  requireRole(['official', 'admin'])
], async (req, res) => {
  try {
    const userModel = new User(req.db);

    if (req.user.role === 'official') {
      if (!req.user.department) return res.json([]);
      return res.json(await userModel.findByRoles(['serviceman'], { department: req.user.department }));
    }

    const department = typeof req.query.department === 'string' ? req.query.department : undefined;
    res.json(await userModel.findByRoles(['serviceman'], { department }));
  } catch (error) {
    console.error('Get servicemen error:', error);
    res.status(500).json({ error: 'Server error while fetching servicemen' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userModel = new User(req.db);
    const user = await userModel.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error while fetching user' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role / department (Admin only)
// @access  Private (Admin only)
router.put('/:id/role', [
  auth,
  requireRole(['admin']),
  body('role').isIn(ROLES).withMessage('Invalid role'),
  departmentRule
], async (req, res) => {
  try {
    if (validationFailed(req, res)) return;

    // Prevent admins from locking themselves out
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const { role, department } = req.body;
    const userModel = new User(req.db);

    const updatedUser = await userModel.updateRole(req.params.id, role, departmentFor(role, department));

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User role updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Server error while updating user role' });
  }
});

// @route   PUT /api/users/:id/deactivate
// @desc    Deactivate user (Admin only)
// @access  Private (Admin only)
router.put('/:id/deactivate', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    // Prevent admin from deactivating themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const userModel = new User(req.db);
    const deactivatedUser = await userModel.deactivateUser(req.params.id);

    if (!deactivatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deactivated successfully',
      user: deactivatedUser
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Server error while deactivating user' });
  }
});

// @route   PUT /api/users/:id/activate
// @desc    Re-activate a deactivated user (Admin only)
// @access  Private (Admin only)
router.put('/:id/activate', [
  auth,
  requireRole(['admin'])
], async (req, res) => {
  try {
    const userModel = new User(req.db);
    const activatedUser = await userModel.activateUser(req.params.id);

    if (!activatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User activated successfully',
      user: activatedUser
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Server error while activating user' });
  }
});

module.exports = router;
