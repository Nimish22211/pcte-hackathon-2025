const { auth: firebaseAuth } = require('../config/firebase');
const User = require('../models/User');

const extractToken = (req) => {
  const header = req.header('Authorization');
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, '').trim() || null;
};

// Verifies the Firebase ID token and loads the user's Firestore profile
const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = await firebaseAuth.verifyIdToken(token);
    const userModel = new User(req.db);
    const user = await userModel.findById(decoded.uid);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.code || error.message);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];

    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${userRoles.join(' or ')}, your role: ${req.user.role}`
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = await firebaseAuth.verifyIdToken(token);
        const userModel = new User(req.db);
        const user = await userModel.findById(decoded.uid);
        req.user = user;
      } catch (tokenError) {
        // Invalid token, but continue without authentication for optional auth
        console.log('Optional auth: Invalid token, continuing without auth');
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = { auth, requireRole, optionalAuth };
