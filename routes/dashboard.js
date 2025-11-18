const express = require('express');
const router = express.Router();
const path = require('path');
const { getDatabase } = require('../lib/database');
const logger = require('../lib/logger');

/**
 * Serve dashboard HTML
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

/**
 * Get dashboard data
 */
router.get('/api/data', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get overview statistics
    const overview = await db.get(`
      SELECT
        COUNT(DISTINCT account_id) as total_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'instagram' THEN account_id END) as instagram_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'facebook' THEN account_id END) as facebook_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'youtube' THEN account_id END) as youtube_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'tiktok' THEN account_id END) as tiktok_accounts,
        SUM(followers_count) as total_followers
      FROM accounts WHERE is_connected = 1
    `);

    // Get recent posts
    const recentPosts = await db.all(`
      SELECT
        sp.id,
        sp.title,
        sp.content,
        sp.scheduled_time,
        sp.status,
        COUNT(spa.account_id) as account_count
      FROM scheduled_posts sp
      LEFT JOIN scheduled_post_accounts spa ON spa.post_id = sp.id
      GROUP BY sp.id
      ORDER BY sp.scheduled_time DESC
      LIMIT 10
    `);

    // Get accounts
    const accounts = await db.all(`
      SELECT id, platform, account_name, account_handle, followers_count, is_connected, last_sync
      FROM accounts
      ORDER BY platform, account_name
    `);

    // Get engagement summary
    const engagement = await db.get(`
      SELECT
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        COUNT(*) as total_engagements
      FROM engagement_data
      WHERE recorded_at >= datetime('now', '-7 days')
    `);

    // Get posted content stats
    const contentStats = await db.get(`
      SELECT
        COUNT(*) as total_posted,
        COUNT(CASE WHEN date(posted_at) = date('now') THEN 1 END) as posted_today,
        COUNT(CASE WHEN platform = 'instagram' THEN 1 END) as instagram_posts,
        COUNT(CASE WHEN platform = 'facebook' THEN 1 END) as facebook_posts,
        COUNT(CASE WHEN platform = 'youtube' THEN 1 END) as youtube_posts,
        COUNT(CASE WHEN platform = 'tiktok' THEN 1 END) as tiktok_posts
      FROM posted_content
    `);

    // Get scheduled posts count by status
    const scheduledCounts = await db.all(`
      SELECT status, COUNT(*) as count
      FROM scheduled_posts
      GROUP BY status
    `);

    res.json({
      overview,
      engagement,
      contentStats,
      scheduledCounts,
      recentPosts,
      accounts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get queue statistics
 */
router.get('/api/queue-stats', async (req, res) => {
  try {
    // This would be populated by the scheduler
    res.json({
      posts: { waiting: 0, active: 0, completed: 0, failed: 0 },
      engagement: { waiting: 0, active: 0, completed: 0, failed: 0 },
      analytics: { waiting: 0, active: 0, completed: 0, failed: 0 },
      autoResponse: { waiting: 0, active: 0, completed: 0, failed: 0 }
    });
  } catch (error) {
    logger.error('Error fetching queue stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
