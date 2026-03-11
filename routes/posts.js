const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const { validatePostRequest, isValidPostType, sanitizeText } = require('../lib/validation');
const { getPostTypeDisplayName, batchArray } = require('../lib/helpers');
const { checkPostLimit } = require('./subscriptionGate');

/**
 * Get all scheduled posts
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const status = req.query.status || 'scheduled';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const posts = await db.all(`
      SELECT sp.id, sp.title, sp.content, sp.post_type, sp.scheduled_time, sp.status,
             sp.created_at, COUNT(spa.account_id) as account_count
      FROM scheduled_posts sp
      LEFT JOIN scheduled_post_accounts spa ON spa.post_id = sp.id
      WHERE sp.status = ? OR ? = 'all'
      GROUP BY sp.id
      ORDER BY sp.scheduled_time DESC
      LIMIT ? OFFSET ?
    `, [status, status, limit, offset]);

    res.json(posts);
  } catch (error) {
    logger.error('Error fetching posts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get post details with account mappings
 */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();

    const post = await db.get(`
      SELECT * FROM scheduled_posts WHERE id = ?
    `, [req.params.id]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get associated accounts
    const accounts = await db.all(`
      SELECT spa.account_id, spa.platform, a.account_name, a.account_handle,
             spa.status, spa.post_url, spa.error_message
      FROM scheduled_post_accounts spa
      JOIN accounts a ON a.id = spa.account_id
      WHERE spa.post_id = ?
    `, [req.params.id]);

    post.accounts = accounts;
    res.json(post);
  } catch (error) {
    logger.error('Error fetching post:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create and schedule a post
 */
router.post('/', checkPostLimit(), async (req, res) => {
  try {
    const { title, content, postType, mediaUrls, accounts, scheduledTime, hashtags, mentions } = req.body;

    // Validation
    const errors = validatePostRequest(req);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (postType && !isValidPostType(postType)) {
      return res.status(400).json({ error: 'Invalid post type' });
    }

    const db = await getDatabase();

    // Create scheduled post
    const postId = uuidv4();
    const sanitizedContent = sanitizeText(content);

    await db.run(`
      INSERT INTO scheduled_posts
      (id, title, content, post_type, media_urls, hashtags, mentions, scheduled_time, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      postId,
      title || null,
      sanitizedContent,
      postType || 'text',
      JSON.stringify(mediaUrls) || null,
      JSON.stringify(hashtags) || null,
      JSON.stringify(mentions) || null,
      scheduledTime,
      req.user?.id || 'system'
    ]);

    // Create account mappings
    for (const accountId of accounts) {
      const mappingId = uuidv4();
      await db.run(`
        INSERT INTO scheduled_post_accounts
        (id, post_id, account_id, platform, status, created_at)
        SELECT ?, ?, ?, platform, 'pending', CURRENT_TIMESTAMP
        FROM accounts WHERE id = ?
      `, [mappingId, postId, accountId, accountId]);
    }

    res.status(201).json({
      id: postId,
      message: 'Post scheduled successfully',
      accountCount: accounts.length
    });
  } catch (error) {
    logger.error('Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk upload posts from CSV
 */
router.post('/bulk-upload', async (req, res) => {
  try {
    const { posts } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'Posts array is required' });
    }

    if (posts.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 posts per upload' });
    }

    const db = await getDatabase();
    const createdPostIds = [];

    // Batch insert posts
    for (const post of posts) {
      const postId = uuidv4();

      await db.run(`
        INSERT INTO scheduled_posts
        (id, title, content, post_type, media_urls, hashtags, mentions, scheduled_time, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        postId,
        post.title || null,
        sanitizeText(post.content),
        post.postType || 'text',
        JSON.stringify(post.mediaUrls) || null,
        JSON.stringify(post.hashtags) || null,
        JSON.stringify(post.mentions) || null,
        post.scheduledTime,
        req.user?.id || 'system'
      ]);

      // Add to all specified accounts
      if (post.accounts && Array.isArray(post.accounts)) {
        for (const accountId of post.accounts) {
          const mappingId = uuidv4();
          await db.run(`
            INSERT INTO scheduled_post_accounts
            (id, post_id, account_id, platform, status, created_at)
            SELECT ?, ?, ?, platform, 'pending', CURRENT_TIMESTAMP
            FROM accounts WHERE id = ?
          `, [mappingId, postId, accountId, accountId]);
        }
      }

      createdPostIds.push(postId);
    }

    res.status(201).json({
      message: 'Posts uploaded successfully',
      count: createdPostIds.length,
      postIds: createdPostIds
    });
  } catch (error) {
    logger.error('Error bulk uploading posts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update scheduled post
 */
router.patch('/:id', async (req, res) => {
  try {
    const { title, content, scheduledTime, postType } = req.body;

    const db = await getDatabase();

    const post = await db.get('SELECT status FROM scheduled_posts WHERE id = ?', [req.params.id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Can only edit scheduled posts
    if (post.status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only edit scheduled posts' });
    }

    await db.run(`
      UPDATE scheduled_posts
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          post_type = COALESCE(?, post_type),
          scheduled_time = COALESCE(?, scheduled_time),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title || null, content ? sanitizeText(content) : null, postType || null, scheduledTime || null, req.params.id]);

    res.json({ success: true, message: 'Post updated' });
  } catch (error) {
    logger.error('Error updating post:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancel scheduled post
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDatabase();

    const post = await db.get('SELECT status FROM scheduled_posts WHERE id = ?', [req.params.id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only cancel scheduled posts' });
    }

    await db.run('UPDATE scheduled_posts SET status = ? WHERE id = ?', ['cancelled', req.params.id]);

    res.json({ success: true, message: 'Post cancelled' });
  } catch (error) {
    logger.error('Error cancelling post:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get posted content history
 */
router.get('/:id/history', async (req, res) => {
  try {
    const db = await getDatabase();

    const content = await db.all(`
      SELECT pc.id, pc.platform, pc.content, pc.post_url, pc.post_type, pc.posted_at,
             a.account_name, a.account_handle
      FROM posted_content pc
      JOIN accounts a ON a.id = pc.account_id
      WHERE pc.post_id = ?
      ORDER BY pc.posted_at DESC
    `, [req.params.id]);

    res.json(content);
  } catch (error) {
    logger.error('Error fetching post history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Repost to additional accounts
 */
router.post('/:id/repost', async (req, res) => {
  try {
    const { additionalAccounts } = req.body;

    if (!Array.isArray(additionalAccounts) || additionalAccounts.length === 0) {
      return res.status(400).json({ error: 'Additional accounts required' });
    }

    const db = await getDatabase();

    const post = await db.get('SELECT * FROM scheduled_posts WHERE id = ?', [req.params.id]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Create new post with same content
    const newPostId = uuidv4();

    await db.run(`
      INSERT INTO scheduled_posts
      (id, title, content, post_type, media_urls, hashtags, mentions, scheduled_time, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 minutes'), 'scheduled', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      newPostId, post.title, post.content, post.post_type, post.media_urls,
      post.hashtags, post.mentions, req.user?.id || 'system'
    ]);

    // Add to additional accounts
    for (const accountId of additionalAccounts) {
      const mappingId = uuidv4();
      await db.run(`
        INSERT INTO scheduled_post_accounts
        (id, post_id, account_id, platform, status, created_at)
        SELECT ?, ?, ?, platform, 'pending', CURRENT_TIMESTAMP
        FROM accounts WHERE id = ?
      `, [mappingId, newPostId, accountId, accountId]);
    }

    res.status(201).json({
      newPostId,
      message: 'Post reposted to additional accounts'
    });
  } catch (error) {
    logger.error('Error reposting:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
