const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const adManager = require('../lib/ad-manager');
const adGenerator = require('../lib/ad-generator');
const adOptimizer = require('../lib/ad-optimizer');
const imageGenerator = require('../lib/image-generator');
const { sanitizeText, isValidPlatform } = require('../lib/validation');

/**
 * Get all ad campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const db = await getDatabase();
    const accountId = req.query.accountId;
    const status = req.query.status;

    let query = 'SELECT * FROM ad_campaigns WHERE 1=1';
    const params = [];

    if (accountId) {
      query += ' AND account_id = ?';
      params.push(accountId);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const campaigns = await db.all(query, params);

    res.json(campaigns);
  } catch (error) {
    logger.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new ad campaign
 */
router.post('/campaigns', async (req, res) => {
  try {
    const {
      accountId,
      platform,
      campaignName,
      objective,
      budget,
      dailyBudget,
      startDate,
      endDate,
      targetAudience,
      targetLocations,
      targetInterests,
      ageMin,
      ageMax,
      gender,
      bidStrategy
    } = req.body;

    // Validation
    if (!accountId || !platform || !campaignName || !objective || !budget) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidPlatform(platform) && platform !== 'all') {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    await adManager.initialize();
    const result = await adManager.createCampaign({
      accountId,
      platform,
      campaignName,
      objective,
      budget,
      dailyBudget,
      startDate,
      endDate,
      targetAudience,
      targetLocations,
      targetInterests,
      ageMin,
      ageMax,
      gender,
      bidStrategy
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get campaign details
 */
router.get('/campaigns/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const campaign = await db.get(`
      SELECT * FROM ad_campaigns WHERE id = ?
    `, [req.params.id]);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get campaign creatives
    const creatives = await db.all(`
      SELECT * FROM ad_creatives WHERE campaign_id = ?
    `, [req.params.id]);

    // Get performance metrics
    const performance = await db.all(`
      SELECT
        date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(conversions) as conversions,
        SUM(spend) as spend,
        AVG(ctr) as ctr,
        AVG(cpc) as cpc,
        AVG(roas) as roas
      FROM ad_performance
      WHERE campaign_id = ?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `, [req.params.id]);

    res.json({
      campaign,
      creatives,
      performance
    });
  } catch (error) {
    logger.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update campaign
 */
router.patch('/campaigns/:id', async (req, res) => {
  try {
    const { status, dailyBudget, bidStrategy } = req.body;

    const db = await getDatabase();
    const campaign = await db.get('SELECT id FROM ad_campaigns WHERE id = ?', [req.params.id]);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const updates = [];
    const values = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (dailyBudget) {
      updates.push('daily_budget = ?');
      values.push(dailyBudget);
    }

    if (bidStrategy) {
      updates.push('bid_strategy = ?');
      values.push(bidStrategy);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    await db.run(`
      UPDATE ad_campaigns SET ${updates.join(', ')} WHERE id = ?
    `, values);

    res.json({ success: true, message: 'Campaign updated' });
  } catch (error) {
    logger.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Launch campaign
 */
router.post('/campaigns/:id/launch', async (req, res) => {
  try {
    await adManager.initialize();
    const result = await adManager.launchCampaign(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Error launching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Pause campaign
 */
router.post('/campaigns/:id/pause', async (req, res) => {
  try {
    await adManager.initialize();
    const result = await adManager.pauseCampaign(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create ad creative
 */
router.post('/creatives', async (req, res) => {
  try {
    const {
      campaignId,
      accountId,
      platform,
      headline,
      description,
      callToAction,
      imageUrl,
      videoUrl,
      landingPageUrl,
      creativeType
    } = req.body;

    if (!campaignId || !accountId || !platform || !headline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = await getDatabase();
    const creativeId = uuidv4();

    await db.run(`
      INSERT INTO ad_creatives
      (id, campaign_id, account_id, platform, headline, description, call_to_action,
       image_url, video_url, landing_page_url, creative_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      creativeId, campaignId, accountId, platform, headline, description, callToAction,
      imageUrl, videoUrl, landingPageUrl, creativeType || 'image'
    ]);

    res.status(201).json({
      id: creativeId,
      message: 'Creative created successfully'
    });
  } catch (error) {
    logger.error('Error creating creative:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate ad headlines
 */
router.post('/generate/headlines', async (req, res) => {
  try {
    const { productName, productDescription, platform, count } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'Product name required' });
    }

    const headlines = await adGenerator.generateHeadlines(
      productName,
      productDescription || '',
      platform || 'facebook',
      count || 5
    );

    res.json({ headlines });
  } catch (error) {
    logger.error('Error generating headlines:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate ad copy
 */
router.post('/generate/copy', async (req, res) => {
  try {
    const { productName, productDescription, target, platform, count } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'Product name required' });
    }

    const copies = await adGenerator.generateAdCopy(
      productName,
      productDescription || '',
      target || 'general audience',
      platform || 'facebook',
      count || 3
    );

    res.json({ copies });
  } catch (error) {
    logger.error('Error generating copy:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate CTAs
 */
router.post('/generate/ctas', async (req, res) => {
  try {
    const { objective, productType, count } = req.body;

    if (!objective) {
      return res.status(400).json({ error: 'Objective required' });
    }

    const ctas = await adGenerator.generateCTAs(
      objective,
      productType || 'general',
      count || 5
    );

    res.json({ ctas });
  } catch (error) {
    logger.error('Error generating CTAs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate targeting criteria
 */
router.post('/generate/targeting', async (req, res) => {
  try {
    const { productName, productDescription, targetAudience } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'Product name required' });
    }

    const criteria = await adGenerator.generateTargetingCriteria(
      productName,
      productDescription || '',
      targetAudience || ''
    );

    res.json({ criteria });
  } catch (error) {
    logger.error('Error generating targeting criteria:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate image for ad
 */
router.post('/generate/image', async (req, res) => {
  try {
    const { productName, headline, callToAction, backgroundColor, platform } = req.body;

    if (!productName || !headline) {
      return res.status(400).json({ error: 'Product name and headline required' });
    }

    const image = await imageGenerator.generateAdBanner(
      productName,
      headline,
      backgroundColor || '#667eea',
      { platform: platform || 'instagram' }
    );

    res.json(image);
  } catch (error) {
    logger.error('Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get campaign performance
 */
router.get('/campaigns/:id/performance', async (req, res) => {
  try {
    await adManager.initialize();
    const performance = await adManager.getCampaignPerformance(req.params.id);
    res.json({ performance });
  } catch (error) {
    logger.error('Error fetching performance:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get budget status
 */
router.get('/campaigns/:id/budget', async (req, res) => {
  try {
    await adManager.initialize();
    const budget = await adManager.getBudgetStatus(req.params.id);
    res.json(budget);
  } catch (error) {
    logger.error('Error fetching budget:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Optimize campaign budgets
 */
router.post('/optimize/budgets', async (req, res) => {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID required' });
    }

    await adOptimizer.initialize();
    const result = await adOptimizer.optimizeCampaignBudgets(accountId);
    res.json(result);
  } catch (error) {
    logger.error('Error optimizing budgets:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get optimization recommendations
 */
router.get('/optimize/recommendations/:campaignId', async (req, res) => {
  try {
    await adOptimizer.initialize();

    const budgetRecommendations = await adOptimizer.optimizeBidStrategy(req.params.campaignId);
    const creativeRotations = await adOptimizer.recommendCreativeRotations(req.params.campaignId);
    const audienceOptimization = await adOptimizer.optimizeAudienceTargeting(req.params.campaignId);

    res.json({
      bidStrategy: budgetRecommendations,
      creativeRotations,
      audienceOptimization
    });
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Track conversion
 */
router.post('/conversions', async (req, res) => {
  try {
    const { campaignId, accountId, platform, creativeId, conversionType, conversionValue, userId } = req.body;

    if (!campaignId || !accountId || !platform || !conversionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await adManager.initialize();
    const result = await adManager.trackConversion({
      campaignId,
      accountId,
      platform,
      creativeId,
      conversionType,
      conversionValue: conversionValue || 0,
      userId
    });

    res.json(result);
  } catch (error) {
    logger.error('Error tracking conversion:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get leads from campaign
 */
router.get('/campaigns/:id/leads', async (req, res) => {
  try {
    await adManager.initialize();
    const leads = await adManager.getLeads(req.params.id);
    res.json({ leads });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add lead manually
 */
router.post('/leads', async (req, res) => {
  try {
    const { campaignId, accountId, leadName, leadEmail, leadPhone, leadCompany, leadValue } = req.body;

    if (!campaignId || !accountId || !leadName || !leadEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await adManager.initialize();
    const result = await adManager.addLead({
      campaignId,
      accountId,
      leadName,
      leadEmail,
      leadPhone,
      leadCompany,
      leadValue: leadValue || 0,
      leadSource: 'manual'
    });

    res.json(result);
  } catch (error) {
    logger.error('Error adding lead:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update lead status
 */
router.patch('/leads/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    await adManager.initialize();
    const result = await adManager.updateLeadStatus(req.params.id, status);
    res.json(result);
  } catch (error) {
    logger.error('Error updating lead:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get image specifications for platform
 */
router.get('/image-specs/:platform', async (req, res) => {
  try {
    const specs = imageGenerator.getImageSpecs(req.params.platform);
    res.json(specs);
  } catch (error) {
    logger.error('Error getting image specs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
