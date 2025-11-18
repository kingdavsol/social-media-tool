const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const { isValidPlatform } = require('../lib/validation');
const { getPercentageChange } = require('../lib/helpers');

/**
 * Get platform overview analytics
 */
router.get('/overview', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get summary stats
    const stats = await db.get(`
      SELECT
        COUNT(DISTINCT account_id) as total_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'instagram' THEN account_id END) as instagram_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'facebook' THEN account_id END) as facebook_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'youtube' THEN account_id END) as youtube_accounts,
        COUNT(DISTINCT CASE WHEN platform = 'tiktok' THEN account_id END) as tiktok_accounts,
        SUM(followers_count) as total_followers,
        SUM(CASE WHEN platform = 'instagram' THEN followers_count ELSE 0 END) as instagram_followers,
        SUM(CASE WHEN platform = 'facebook' THEN followers_count ELSE 0 END) as facebook_followers,
        SUM(CASE WHEN platform = 'youtube' THEN followers_count ELSE 0 END) as youtube_followers,
        SUM(CASE WHEN platform = 'tiktok' THEN followers_count ELSE 0 END) as tiktok_followers
      FROM accounts WHERE is_connected = 1
    `);

    // Get posts published today
    const postsToday = await db.get(`
      SELECT COUNT(*) as count FROM posted_content WHERE date(posted_at) = date('now')
    `);

    // Get engagement metrics
    const engagement = await db.get(`
      SELECT
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        AVG(engagement_rate) as avg_engagement_rate
      FROM engagement_data
      WHERE recorded_at >= datetime('now', '-30 days')
    `);

    res.json({
      accounts: {
        total: stats.total_accounts,
        byPlatform: {
          instagram: stats.instagram_accounts,
          facebook: stats.facebook_accounts,
          youtube: stats.youtube_accounts,
          tiktok: stats.tiktok_accounts
        }
      },
      followers: {
        total: stats.total_followers,
        byPlatform: {
          instagram: stats.instagram_followers,
          facebook: stats.facebook_followers,
          youtube: stats.youtube_followers,
          tiktok: stats.tiktok_followers
        }
      },
      posts: {
        publishedToday: postsToday.count
      },
      engagement: {
        totalLikes: engagement.total_likes || 0,
        totalComments: engagement.total_comments || 0,
        totalShares: engagement.total_shares || 0,
        avgEngagementRate: engagement.avg_engagement_rate || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching overview analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get account analytics
 */
router.get('/account/:accountId', async (req, res) => {
  try {
    const db = await getDatabase();

    // Get account info
    const account = await db.get(`
      SELECT * FROM accounts WHERE id = ?
    `, [req.params.accountId]);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get recent daily analytics
    const dailyAnalytics = await db.all(`
      SELECT date, total_followers, posts_published, total_engagement, avg_engagement_rate
      FROM analytics_daily
      WHERE account_id = ?
      ORDER BY date DESC
      LIMIT 30
    `, [req.params.accountId]);

    // Get growth data
    const growthData = await db.all(`
      SELECT date, followers_count FROM account_growth
      WHERE account_id = ?
      ORDER BY date DESC
      LIMIT 90
    `, [req.params.accountId]);

    // Get engagement trend
    const engagementTrend = await db.all(`
      SELECT
        date(recorded_at) as date,
        SUM(likes) as likes,
        SUM(comments) as comments,
        SUM(shares) as shares,
        AVG(engagement_rate) as engagement_rate
      FROM engagement_data
      WHERE account_id = ?
      GROUP BY date(recorded_at)
      ORDER BY date DESC
      LIMIT 30
    `, [req.params.accountId]);

    // Get top posts
    const topPosts = await db.all(`
      SELECT
        pc.id,
        pc.content,
        pc.post_url,
        pc.posted_at,
        ed.likes,
        ed.comments,
        ed.shares,
        ed.engagement_rate
      FROM posted_content pc
      LEFT JOIN engagement_data ed ON ed.posted_content_id = pc.id
      WHERE pc.account_id = ?
      ORDER BY ed.likes + ed.comments + ed.shares DESC
      LIMIT 10
    `, [req.params.accountId]);

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.account_name,
        followers: account.followers_count,
        lastSync: account.last_sync
      },
      dailyAnalytics,
      growthData,
      engagementTrend,
      topPosts
    });
  } catch (error) {
    logger.error('Error fetching account analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get post performance
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const db = await getDatabase();

    const post = await db.get(`
      SELECT sp.id, sp.content, sp.scheduled_time, sp.posted_at
      FROM scheduled_posts sp
      WHERE sp.id = ?
    `, [req.params.postId]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get engagement by account
    const engagementByAccount = await db.all(`
      SELECT
        pc.account_id,
        a.account_name,
        a.platform,
        ed.likes,
        ed.comments,
        ed.shares,
        ed.engagement_rate,
        ed.recorded_at
      FROM posted_content pc
      LEFT JOIN engagement_data ed ON ed.posted_content_id = pc.id
      JOIN accounts a ON a.id = pc.account_id
      WHERE pc.post_id = ?
      ORDER BY ed.likes DESC
    `, [req.params.postId]);

    // Get aggregated metrics
    const metrics = await db.get(`
      SELECT
        COUNT(DISTINCT pc.account_id) as total_accounts_posted,
        SUM(ed.likes) as total_likes,
        SUM(ed.comments) as total_comments,
        SUM(ed.shares) as total_shares,
        AVG(ed.engagement_rate) as avg_engagement_rate
      FROM posted_content pc
      LEFT JOIN engagement_data ed ON ed.posted_content_id = pc.id
      WHERE pc.post_id = ?
    `, [req.params.postId]);

    res.json({
      post: {
        id: post.id,
        content: post.content.substring(0, 200),
        scheduledTime: post.scheduled_time,
        postedAt: post.posted_at
      },
      metrics: {
        accountsPosted: metrics.total_accounts_posted,
        totalLikes: metrics.total_likes || 0,
        totalComments: metrics.total_comments || 0,
        totalShares: metrics.total_shares || 0,
        avgEngagementRate: metrics.avg_engagement_rate || 0
      },
      byAccount: engagementByAccount
    });
  } catch (error) {
    logger.error('Error fetching post analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get platform comparison
 */
router.get('/platforms/comparison', async (req, res) => {
  try {
    const db = await getDatabase();

    const platformStats = await db.all(`
      SELECT
        platform,
        COUNT(DISTINCT id) as account_count,
        SUM(followers_count) as total_followers,
        AVG(followers_count) as avg_followers
      FROM accounts
      WHERE is_connected = 1
      GROUP BY platform
    `);

    const platformEngagement = await db.all(`
      SELECT
        a.platform,
        SUM(ed.likes) as total_likes,
        SUM(ed.comments) as total_comments,
        SUM(ed.shares) as total_shares,
        AVG(ed.engagement_rate) as avg_engagement_rate
      FROM engagement_data ed
      JOIN accounts a ON a.id = ed.account_id
      WHERE ed.recorded_at >= datetime('now', '-30 days')
      GROUP BY a.platform
    `);

    res.json({
      accountStats: platformStats,
      engagementStats: platformEngagement
    });
  } catch (error) {
    logger.error('Error fetching platform comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get hashtag performance
 */
router.get('/hashtags/performance', async (req, res) => {
  try {
    const db = await getDatabase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const hashtags = await db.all(`
      SELECT platform, hashtag, uses_count, avg_reach, avg_engagement, trending
      FROM hashtag_performance
      ORDER BY avg_engagement DESC
      LIMIT ?
    `, [limit]);

    res.json(hashtags);
  } catch (error) {
    logger.error('Error fetching hashtag performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get engagement over time
 */
router.get('/engagement/timeline', async (req, res) => {
  try {
    const db = await getDatabase();
    const days = Math.min(parseInt(req.query.days) || 30, 365);

    const timeline = await db.all(`
      SELECT
        date(recorded_at) as date,
        platform,
        SUM(likes) as likes,
        SUM(comments) as comments,
        SUM(shares) as shares,
        SUM(likes) + SUM(comments) + SUM(shares) as total_engagement
      FROM engagement_data
      WHERE recorded_at >= datetime('now', '-${days} days')
      GROUP BY date, platform
      ORDER BY date DESC
    `);

    res.json(timeline);
  } catch (error) {
    logger.error('Error fetching engagement timeline:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get content performance by type
 */
router.get('/content/by-type', async (req, res) => {
  try {
    const db = await getDatabase();

    const contentPerformance = await db.all(`
      SELECT
        pc.post_type,
        COUNT(DISTINCT pc.id) as post_count,
        SUM(ed.likes) as total_likes,
        SUM(ed.comments) as total_comments,
        SUM(ed.shares) as total_shares,
        AVG(ed.engagement_rate) as avg_engagement_rate
      FROM posted_content pc
      LEFT JOIN engagement_data ed ON ed.posted_content_id = pc.id
      GROUP BY pc.post_type
      ORDER BY avg_engagement_rate DESC
    `);

    res.json(contentPerformance);
  } catch (error) {
    logger.error('Error fetching content performance:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
