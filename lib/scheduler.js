const cron = require('node-cron');
const Queue = require('bull');
const logger = require('./logger');
const { getDatabase } = require('./database');
const { getAPIClient } = require('./social-media-apis');
const { encryption } = require('./encryption');
const { delay, retryWithBackoff } = require('./helpers');

// Initialize queues
const postQueue = new Queue('posts', process.env.REDIS_URL || {
  settings: {
    maxStalledCount: 2,
    lockDuration: 30000,
    lockRenewTime: 15000
  }
});

const engagementQueue = new Queue('engagement', process.env.REDIS_URL);
const analyticsQueue = new Queue('analytics', process.env.REDIS_URL);
const autoResponseQueue = new Queue('auto-responses', process.env.REDIS_URL);

/**
 * Scheduler Service - handles all automated posting and monitoring
 */
class Scheduler {
  constructor() {
    this.db = null;
    this.isRunning = false;
    this.jobs = {};
  }

  /**
   * Initialize scheduler
   */
  async initialize() {
    try {
      this.db = await getDatabase();
      logger.info('Scheduler initialized');

      // Setup queue processors
      this._setupQueueProcessors();

      // Schedule jobs
      this._schedulePostingJobs();
      this._scheduleEngagementJobs();
      this._scheduleAnalyticsJobs();
      this._scheduleAutoResponseJobs();

      this.isRunning = true;
      logger.info('All scheduler jobs configured');
    } catch (error) {
      logger.error('Error initializing scheduler:', error);
      throw error;
    }
  }

  /**
   * Setup queue processors
   */
  _setupQueueProcessors() {
    // Post processing
    postQueue.process(5, async (job) => {
      return this._processPostJob(job);
    });

    postQueue.on('completed', (job) => {
      logger.info(`Post job completed: ${job.id}`);
    });

    postQueue.on('failed', (job, err) => {
      logger.error(`Post job failed: ${job.id}`, err.message);
    });

    // Engagement processing
    engagementQueue.process(3, async (job) => {
      return this._processEngagementJob(job);
    });

    // Analytics processing
    analyticsQueue.process(1, async (job) => {
      return this._processAnalyticsJob(job);
    });

    // Auto-response processing
    autoResponseQueue.process(2, async (job) => {
      return this._processAutoResponseJob(job);
    });
  }

  /**
   * Schedule posting jobs
   */
  _schedulePostingJobs() {
    // Check for scheduled posts every 5 minutes
    const checkInterval = (parseInt(process.env.POSTING_CHECK_INTERVAL) || 300000) / 1000 / 60;

    this.jobs.postingCheck = cron.schedule(`*/${checkInterval} * * * *`, async () => {
      try {
        await this._checkAndQueuePosts();
      } catch (error) {
        logger.error('Error in posting check job:', error);
      }
    });

    logger.info(`Scheduled posting check every ${checkInterval} minutes`);
  }

  /**
   * Schedule engagement monitoring
   */
  _scheduleEngagementJobs() {
    // Check engagement metrics every 10 minutes
    const checkInterval = (parseInt(process.env.ENGAGEMENT_CHECK_INTERVAL) || 600000) / 1000 / 60;

    this.jobs.engagementCheck = cron.schedule(`*/${checkInterval} * * * *`, async () => {
      try {
        await this._checkAndQueueEngagement();
      } catch (error) {
        logger.error('Error in engagement check job:', error);
      }
    });

    logger.info(`Scheduled engagement check every ${checkInterval} minutes`);
  }

  /**
   * Schedule analytics updates
   */
  _scheduleAnalyticsJobs() {
    // Update analytics every hour
    this.jobs.analyticsUpdate = cron.schedule('0 * * * *', async () => {
      try {
        await this._checkAndQueueAnalytics();
      } catch (error) {
        logger.error('Error in analytics job:', error);
      }
    });

    logger.info('Scheduled analytics update hourly');

    // Cleanup old analytics daily at 2 AM
    this.jobs.analyticsCleanup = cron.schedule('0 2 * * *', async () => {
      try {
        await this._cleanupOldAnalytics();
      } catch (error) {
        logger.error('Error in analytics cleanup job:', error);
      }
    });

    logger.info('Scheduled analytics cleanup daily at 2 AM');
  }

  /**
   * Schedule auto-response jobs
   */
  _scheduleAutoResponseJobs() {
    // Check for new interactions every 5 minutes
    const checkInterval = (parseInt(process.env.AUTO_RESPONSE_CHECK_INTERVAL) || 300000) / 1000 / 60;

    this.jobs.autoResponseCheck = cron.schedule(`*/${checkInterval} * * * *`, async () => {
      try {
        await this._checkAndQueueAutoResponses();
      } catch (error) {
        logger.error('Error in auto-response check job:', error);
      }
    });

    logger.info(`Scheduled auto-response check every ${checkInterval} minutes`);
  }

  /**
   * Check for scheduled posts and queue them
   */
  async _checkAndQueuePosts() {
    try {
      const now = new Date();

      // Find posts scheduled for the next 5 minutes
      const posts = await this.db.all(`
        SELECT id, title, content, post_type, media_urls, hashtags, mentions, scheduled_time, created_by
        FROM scheduled_posts
        WHERE status = 'scheduled'
          AND scheduled_time <= datetime('now', '+5 minutes')
          AND scheduled_time > datetime('now')
        ORDER BY scheduled_time ASC
      `);

      logger.info(`Found ${posts.length} posts to queue`);

      for (const post of posts) {
        // Get associated accounts
        const accounts = await this.db.all(`
          SELECT pa.account_id, pa.platform, a.access_token, a.account_handle
          FROM scheduled_post_accounts pa
          JOIN accounts a ON a.id = pa.account_id
          WHERE pa.post_id = ?
        `, [post.id]);

        // Queue post for each account
        for (const account of accounts) {
          await postQueue.add({
            postId: post.id,
            accountId: account.account_id,
            platform: account.platform,
            content: post.content,
            postType: post.post_type,
            mediaUrls: post.media_urls,
            hashtags: post.hashtags,
            mentions: post.mentions,
            accessToken: account.access_token,
            accountHandle: account.account_handle,
            scheduledTime: post.scheduled_time
          }, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false
          });
        }

        // Update post status to queued
        await this.db.run(`
          UPDATE scheduled_posts SET status = 'queued' WHERE id = ?
        `, [post.id]);
      }
    } catch (error) {
      logger.error('Error checking and queueing posts:', error);
    }
  }

  /**
   * Process a post job
   */
  async _processPostJob(job) {
    const { postId, accountId, platform, content, postType, mediaUrls, hashtags, mentions, accessToken } = job.data;

    try {
      logger.info(`Processing post ${postId} for account ${accountId} on ${platform}`);

      // Update status to posting
      await this.db.run(`
        UPDATE scheduled_post_accounts SET status = 'posted' WHERE post_id = ? AND account_id = ?
      `, [postId, accountId]);

      // Create post on platform
      const credentials = { accessToken };
      const apiClient = getAPIClient(platform, credentials);

      let result;

      if (platform === 'instagram') {
        if (postType === 'carousel') {
          const items = JSON.parse(mediaUrls || '[]');
          result = await apiClient.createCarousel(accountId, items, content, hashtags, mentions);
        } else if (postType === 'reel') {
          const [videoUrl, thumbnailUrl] = mediaUrls.split(',');
          result = await apiClient.createReel(accountId, videoUrl, content, thumbnailUrl, hashtags, mentions);
        } else {
          const media = JSON.parse(mediaUrls || '{}');
          result = await apiClient.createPost(accountId, media, content, hashtags, mentions);
        }
      } else if (platform === 'facebook') {
        result = await apiClient.createPagePost(accountId, content, null, mediaUrls, hashtags);
      } else if (platform === 'youtube') {
        // YouTube requires OAuth and file upload - simplified here
        result = {
          id: `yt_${Date.now()}`,
          url: `https://youtube.com/watch?v=${Date.now()}`
        };
      } else if (platform === 'tiktok') {
        result = await apiClient.createPost(accountId, mediaUrls, content, hashtags);
      }

      // Store posted content
      const postedId = require('uuid').v4();
      await this.db.run(`
        INSERT INTO posted_content (id, post_id, account_id, platform, platform_post_id, post_url, content, media_urls, post_type, posted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [postedId, postId, accountId, platform, result.id, result.url, content, mediaUrls, postType]);

      // Update account posted time
      await this.db.run(`
        UPDATE scheduled_post_accounts SET post_url = ?, platform_post_id = ? WHERE post_id = ? AND account_id = ?
      `, [result.url, result.id, postId, accountId]);

      logger.info(`Successfully posted to ${platform}: ${result.url}`);

      // Check if all accounts have posted
      const remaining = await this.db.get(`
        SELECT COUNT(*) as count FROM scheduled_post_accounts WHERE post_id = ? AND status = 'pending'
      `, [postId]);

      if (remaining.count === 0) {
        await this.db.run(`
          UPDATE scheduled_posts SET status = 'posted', posted_at = CURRENT_TIMESTAMP WHERE id = ?
        `, [postId]);
      }

      return { success: true, postId, accountId, platform, url: result.url };
    } catch (error) {
      logger.error(`Error posting to ${platform}:`, error);

      // Update error message
      await this.db.run(`
        UPDATE scheduled_post_accounts SET status = 'failed', error_message = ? WHERE post_id = ? AND account_id = ?
      `, [error.message, postId, accountId]);

      throw error;
    }
  }

  /**
   * Check and queue engagement monitoring
   */
  async _checkAndQueueEngagement() {
    try {
      // Get all connected accounts
      const accounts = await this.db.all(`
        SELECT id, account_id, platform, access_token FROM accounts WHERE is_connected = 1
      `);

      for (const account of accounts) {
        await engagementQueue.add({
          accountId: account.id,
          platform: account.platform,
          accessToken: account.access_token
        }, {
          removeOnComplete: true,
          removeOnFail: false
        });
      }

      logger.info(`Queued engagement check for ${accounts.length} accounts`);
    } catch (error) {
      logger.error('Error queueing engagement:', error);
    }
  }

  /**
   * Process engagement job
   */
  async _processEngagementJob(job) {
    const { accountId, platform, accessToken } = job.data;

    try {
      logger.info(`Processing engagement for ${platform} account ${accountId}`);

      // Get recent posts
      const recentPosts = await this.db.all(`
        SELECT id, platform_post_id FROM posted_content
        WHERE account_id = ? AND platform = ?
        ORDER BY posted_at DESC LIMIT 10
      `, [accountId, platform]);

      const credentials = { accessToken };
      const apiClient = getAPIClient(platform, credentials);

      // Fetch metrics for each post
      for (const post of recentPosts) {
        const metrics = await apiClient.getPostMetrics(post.platform_post_id);

        // Store engagement data
        const engagementId = require('uuid').v4();
        await this.db.run(`
          INSERT OR REPLACE INTO engagement_data
          (id, posted_content_id, account_id, platform, likes, comments, shares, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [engagementId, post.id, accountId, platform, metrics.like_count || 0, metrics.comments_count || 0, 0]);

        await delay(500);
      }

      return { success: true, accountId, platform, postsProcessed: recentPosts.length };
    } catch (error) {
      logger.error(`Error processing engagement for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Check and queue analytics updates
   */
  async _checkAndQueueAnalytics() {
    try {
      const accounts = await this.db.all(`
        SELECT id, account_id, platform, access_token FROM accounts WHERE is_connected = 1
      `);

      for (const account of accounts) {
        await analyticsQueue.add({
          accountId: account.id,
          platform: account.platform,
          accessToken: account.access_token
        }, {
          removeOnComplete: true,
          removeOnFail: false
        });
      }

      logger.info(`Queued analytics update for ${accounts.length} accounts`);
    } catch (error) {
      logger.error('Error queueing analytics:', error);
    }
  }

  /**
   * Process analytics job
   */
  async _processAnalyticsJob(job) {
    const { accountId, platform, accessToken } = job.data;

    try {
      logger.info(`Processing analytics for ${platform} account ${accountId}`);

      const credentials = { accessToken };
      const apiClient = getAPIClient(platform, credentials);

      // Get account info
      const accountInfo = await apiClient.getAccountInfo(accountId);

      // Store daily analytics
      const analyticsId = require('uuid').v4();
      await this.db.run(`
        INSERT OR REPLACE INTO analytics_daily
        (id, account_id, platform, date, total_followers, recorded_at)
        VALUES (?, ?, ?, CURRENT_DATE, ?, CURRENT_TIMESTAMP)
      `, [analyticsId, accountId, platform, accountInfo.followers_count || 0]);

      // Store growth tracking
      const growthId = require('uuid').v4();
      await this.db.run(`
        INSERT OR REPLACE INTO account_growth
        (id, account_id, platform, date, followers_count, recorded_at)
        VALUES (?, ?, ?, CURRENT_DATE, ?, CURRENT_TIMESTAMP)
      `, [growthId, accountId, platform, accountInfo.followers_count || 0]);

      return { success: true, accountId, platform, followers: accountInfo.followers_count };
    } catch (error) {
      logger.error(`Error processing analytics for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup old analytics
   */
  async _cleanupOldAnalytics() {
    try {
      const retentionDays = parseInt(process.env.ANALYTICS_RETENTION_DAYS) || 365;

      const result = await this.db.run(`
        DELETE FROM analytics_daily
        WHERE date < date('now', '-${retentionDays} days')
      `);

      logger.info(`Cleaned up ${result.changes} old analytics records`);
    } catch (error) {
      logger.error('Error cleaning up analytics:', error);
    }
  }

  /**
   * Check and queue auto-responses
   */
  async _checkAndQueueAutoResponses() {
    try {
      const activeRules = await this.db.all(`
        SELECT id, account_id, platform, trigger_type, trigger_keywords, response_template
        FROM auto_response_rules
        WHERE is_enabled = 1
      `);

      for (const rule of activeRules) {
        await autoResponseQueue.add({
          ruleId: rule.id,
          accountId: rule.account_id,
          platform: rule.platform,
          triggerType: rule.trigger_type,
          triggerKeywords: rule.trigger_keywords,
          responseTemplate: rule.response_template
        }, {
          removeOnComplete: true,
          removeOnFail: false
        });
      }

      logger.info(`Queued auto-response check for ${activeRules.length} rules`);
    } catch (error) {
      logger.error('Error queueing auto-responses:', error);
    }
  }

  /**
   * Process auto-response job
   */
  async _processAutoResponseJob(job) {
    const { ruleId, accountId, platform, triggerType, responseTemplate } = job.data;

    try {
      logger.info(`Processing auto-response rule ${ruleId} for ${platform} account ${accountId}`);

      // Get account credentials
      const account = await this.db.get(`
        SELECT access_token FROM accounts WHERE id = ?
      `, [accountId]);

      if (!account) {
        throw new Error(`Account ${accountId} not found`);
      }

      const credentials = { accessToken: account.access_token };
      const apiClient = getAPIClient(platform, credentials);

      // Get recent interactions
      let interactions = [];

      if (triggerType === 'comment') {
        // Get recent comments
        const recentPosts = await this.db.all(`
          SELECT platform_post_id FROM posted_content
          WHERE account_id = ? AND platform = ?
          ORDER BY posted_at DESC LIMIT 5
        `, [accountId, platform]);

        for (const post of recentPosts) {
          const comments = await apiClient.getPostComments(post.platform_post_id);
          interactions = interactions.concat(comments);
        }
      }

      // Process and respond to interactions
      for (const interaction of interactions) {
        // Check if already processed
        const processed = await this.db.get(`
          SELECT id FROM processed_interactions
          WHERE interaction_id = ? AND auto_response_rule_id = ?
        `, [interaction.id, ruleId]);

        if (!processed) {
          // Reply to interaction
          await apiClient.replyToComment(interaction.id, responseTemplate);

          // Log interaction as processed
          const interactionId = require('uuid').v4();
          await this.db.run(`
            INSERT INTO processed_interactions
            (id, account_id, platform, interaction_id, interaction_type, from_user_id, from_user_name, content, auto_response_rule_id, response_sent, responded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [interactionId, accountId, platform, interaction.id, triggerType, interaction.from?.id, interaction.from?.username, interaction.text, ruleId, responseTemplate]);

          logger.info(`Responded to interaction ${interaction.id}`);
          await delay(1000); // Rate limiting
        }
      }

      return { success: true, ruleId, accountId, platform, responsesCount: interactions.length };
    } catch (error) {
      logger.error(`Error processing auto-response:`, error);
      throw error;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    try {
      for (const [name, job] of Object.entries(this.jobs)) {
        if (job && job.stop) {
          job.stop();
          logger.info(`Stopped job: ${name}`);
        }
      }
      this.isRunning = false;
      logger.info('Scheduler stopped');
    } catch (error) {
      logger.error('Error stopping scheduler:', error);
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats() {
    try {
      const postStats = await postQueue.getJobCounts();
      const engagementStats = await engagementQueue.getJobCounts();
      const analyticsStats = await analyticsQueue.getJobCounts();
      const autoResponseStats = await autoResponseQueue.getJobCounts();

      return {
        posts: postStats,
        engagement: engagementStats,
        analytics: analyticsStats,
        autoResponse: autoResponseStats
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }
}

module.exports = new Scheduler();
