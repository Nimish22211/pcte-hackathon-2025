const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Firebase (Firestore + Auth)
const { db, auth: firebaseAuth } = require('./config/firebase');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/authRoutes');
const issueRoutes = require('./routes/issueRoutes');
const userRoutes = require('./routes/userRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const server = createServer(app);

// Behind a hosting proxy (Render, Railway, ...) the real client IP comes from X-Forwarded-For
if (isProduction) {
  app.set('trust proxy', 1);
}

// Allowed browser origins. FRONTEND_URL may contain several comma-separated URLs.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL || '').split(',').map((url) => url.trim().replace(/\/$/, ''))
].filter(Boolean);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Identify the user behind a socket from the Firebase ID token sent in the handshake
io.use(async (socket, next) => {
  socket.data.user = null;
  const token = socket.handshake.auth && socket.handshake.auth.token;

  if (token) {
    try {
      const decoded = await firebaseAuth.verifyIdToken(token);
      socket.data.user = (await new User(db).findById(decoded.uid)) || null;
    } catch (error) {
      // Invalid or expired token: continue as an anonymous visitor
    }
  }

  next();
});

// Verify the Firestore connection on startup
const testConnection = async () => {
  try {
    await db.collection('users').limit(1).get();
    console.log('✅ Connected to Firebase Firestore');
  } catch (err) {
    console.error('❌ Firestore connection failed:', err.message);
    console.error('   Check your Firebase credentials in backend/.env and that Firestore is enabled.');
  }
};

testConnection();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // default 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 1000, // limit each IP per window
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body parsing middleware (photos are uploaded straight to Cloudinary, so JSON bodies stay small)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Make Firestore and Socket.IO accessible to routes
app.use((req, res, next) => {
  req.db = db;
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'firestore',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.on('join-room', (room) => {
    if (typeof room !== 'string') return;
    const user = socket.data.user;

    // Everyone may watch public issue updates; private rooms need the matching identity
    const allowed =
      room === 'issues' ||
      (user && room === `user-${user.id}`) ||
      (user && (user.role === 'admin' || user.role === 'official') && room === 'admin-notifications');

    if (allowed) {
      socket.join(room);
    }
  });

  socket.on('leave-room', (room) => {
    if (typeof room === 'string') {
      socket.leave(room);
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error('Server Error:', error);
  }
  res.status(status).json({
    error: status >= 500 && isProduction
      ? 'Internal Server Error'
      : error.message
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: Firebase Firestore`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`⏳ ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, server, io };
