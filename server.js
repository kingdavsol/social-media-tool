const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const logger = require('./lib/logger');
const { initializeDatabase } = require('./lib/database');
const scheduler = require('./lib/scheduler');

// Import routes
const accountsRoutes = require('./routes/accounts');
const postsRoutes = require('./routes/posts');
const contentRoutes = require('./routes/content');
const analyticsRoutes = require('./routes/analytics');
const autoResponseRoutes = require('./routes/auto-response');
const adsRoutes = require('./routes/ads');
const dashboardRoutes = require('./routes/dashboard');
const stripeRoutes = require('./routes/stripe');
const { subscriptionGate, checkAccountLimit, checkPostLimit, requireFeature } = require('./routes/subscriptionGate');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Error handling for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logger.error('Bad JSON', err);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
});

// Health check endpoint (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Basic authentication for admin endpoints
const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'change-me'
  },
  challenge: true,
  realm: 'Social Media Marketing Tool'
});

// API Routes (no auth for now, can add JWT later)
// Apply subscription gates
app.use('/api/accounts', subscriptionGate, accountsRoutes);
app.use('/api/posts', subscriptionGate, postsRoutes);
app.use('/api/content', subscriptionGate, contentRoutes);
app.use('/api/analytics', subscriptionGate, requireFeature('analytics'), analyticsRoutes);
app.use('/api/auto-response', subscriptionGate, requireFeature('advanced-automation'), autoResponseRoutes);
app.use('/api/ads', subscriptionGate, requireFeature('advanced-features'), adsRoutes);
app.use('/api/stripe', stripeRoutes);

// Dashboard routes with auth
app.use('/dashboard', adminAuth, dashboardRoutes);

// Serve static files (dashboard HTML, CSS, JS)
app.use(express.static('public'));

// Root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// 404 handler (comes after static files and routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize scheduler
    await scheduler.initialize();
    logger.info('Scheduler initialized');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

// Start server
startServer();

module.exports = app;
