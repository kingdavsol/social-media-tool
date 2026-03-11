const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const { encrypt, decrypt } = require('../lib/encryption');
const { isValidPlatform, isValidHandle } = require('../lib/validation');
const { formatDate } = require('../lib/helpers');
const { checkAccountLimit } = require('./subscriptionGate');

/**
 * Get all connected accounts
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const accounts = await db.all(`
      SELECT id, platform, account_name, account_handle, profile_picture_url,
             followers_count, is_connected, last_sync, created_at
      FROM accounts
      ORDER BY platform, account_name
    `);

    res.json(accounts);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single account details
 */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const account = await db.get(`
      SELECT * FROM accounts WHERE id = ?
    `, [req.params.id]);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Don't return encrypted tokens
    delete account.access_token;
    delete account.refresh_token;

    res.json(account);
  } catch (error) {
    logger.error('Error fetching account:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add new account
 */
router.post('/', checkAccountLimit(), async (req, res) => {
  try {
    const { platform, accountName, accountHandle, accountId, profilePictureUrl, accessToken, refreshToken, tokenExpiresAt, oauthScopes } = req.body;

    // Validation
    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    if (!accountName || accountName.trim().length === 0) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    if (!accountHandle || !isValidHandle(accountHandle)) {
      return res.status(400).json({ error: 'Valid account handle is required' });
    }

    if (!accountId || accountId.trim().length === 0) {
      return res.status(400).json({ error: 'Account ID is required' });
    }

    if (!accessToken || accessToken.trim().length === 0) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const db = await getDatabase();

    // Check if account already exists
    const existing = await db.get(`
      SELECT id FROM accounts WHERE account_id = ? AND platform = ?
    `, [accountId, platform]);

    if (existing) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    // Create account
    const id = uuidv4();
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

    await db.run(`
      INSERT INTO accounts
      (id, platform, account_name, account_handle, account_id, profile_picture_url,
       access_token, refresh_token, token_expires_at, oauth_scopes, is_connected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      id, platform, accountName, accountHandle, accountId, profilePictureUrl || null,
      encryptedAccessToken, encryptedRefreshToken, tokenExpiresAt || null, oauthScopes || null
    ]);

    res.status(201).json({
      id,
      platform,
      accountName,
      accountHandle,
      message: 'Account added successfully'
    });
  } catch (error) {
    logger.error('Error adding account:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update account
 */
router.patch('/:id', async (req, res) => {
  try {
    const { accountName, profilePictureUrl, followersCount } = req.body;

    const db = await getDatabase();

    // Check if account exists
    const account = await db.get('SELECT id FROM accounts WHERE id = ?', [req.params.id]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Update account
    await db.run(`
      UPDATE accounts
      SET account_name = COALESCE(?, account_name),
          profile_picture_url = COALESCE(?, profile_picture_url),
          followers_count = COALESCE(?, followers_count),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [accountName || null, profilePictureUrl || null, followersCount || null, req.params.id]);

    res.json({ success: true, message: 'Account updated' });
  } catch (error) {
    logger.error('Error updating account:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove account
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDatabase();

    const account = await db.get('SELECT id FROM accounts WHERE id = ?', [req.params.id]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Soft delete - mark as disconnected instead of deleting
    await db.run(`
      UPDATE accounts SET is_connected = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true, message: 'Account disconnected' });
  } catch (error) {
    logger.error('Error removing account:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get account statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const db = await getDatabase();

    const account = await db.get('SELECT * FROM accounts WHERE id = ?', [req.params.id]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get recent analytics
    const analyticsData = await db.all(`
      SELECT date, total_followers, posts_published, total_engagement, avg_engagement_rate
      FROM analytics_daily
      WHERE account_id = ?
      ORDER BY date DESC
      LIMIT 30
    `, [req.params.id]);

    // Get growth data
    const growthData = await db.all(`
      SELECT date, followers_count
      FROM account_growth
      WHERE account_id = ?
      ORDER BY date DESC
      LIMIT 90
    `, [req.params.id]);

    // Get posted content stats
    const contentStats = await db.get(`
      SELECT COUNT(*) as total_posts,
             SUM(CASE WHEN date(posted_at) = date('now') THEN 1 ELSE 0 END) as posts_today
      FROM posted_content
      WHERE account_id = ?
    `, [req.params.id]);

    res.json({
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.account_name,
        accountHandle: account.account_handle,
        followersCount: account.followers_count
      },
      analytics: analyticsData,
      growth: growthData,
      contentStats: contentStats
    });
  } catch (error) {
    logger.error('Error fetching account stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Refresh account token
 */
router.post('/:id/refresh-token', async (req, res) => {
  try {
    const { accessToken, refreshToken, expiresAt } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const db = await getDatabase();

    const account = await db.get('SELECT id FROM accounts WHERE id = ?', [req.params.id]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

    await db.run(`
      UPDATE accounts
      SET access_token = ?, refresh_token = COALESCE(?, refresh_token),
          token_expires_at = COALESCE(?, token_expires_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [encryptedAccessToken, encryptedRefreshToken, expiresAt || null, req.params.id]);

    res.json({ success: true, message: 'Token updated' });
  } catch (error) {
    logger.error('Error refreshing token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get accounts by platform
 */
router.get('/platform/:platform', async (req, res) => {
  try {
    if (!isValidPlatform(req.params.platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    const db = await getDatabase();
    const accounts = await db.all(`
      SELECT id, platform, account_name, account_handle, profile_picture_url,
             followers_count, is_connected, last_sync, created_at
      FROM accounts
      WHERE platform = ? AND is_connected = 1
      ORDER BY account_name
    `, [req.params.platform.toLowerCase()]);

    res.json(accounts);
  } catch (error) {
    logger.error('Error fetching platform accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
