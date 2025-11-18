const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { getDatabase } = require('./database');
const { delay } = require('./helpers');

/**
 * Ad Campaign Management Service
 */
class AdCampaignManager {
  constructor() {
    this.db = null;
  }

  async initialize() {
    this.db = await getDatabase();
  }

  /**
   * Create a new ad campaign
   */
  async createCampaign(campaignData) {
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
        languages,
        bidStrategy
      } = campaignData;

      const campaignId = uuidv4();

      await this.db.run(`
        INSERT INTO ad_campaigns
        (id, account_id, platform, campaign_name, campaign_objective, budget, daily_budget,
         start_date, end_date, target_audience, target_locations, target_interests,
         age_min, age_max, gender, languages, bid_strategy, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        campaignId, accountId, platform, campaignName, objective, budget, dailyBudget,
        startDate, endDate, targetAudience, targetLocations, targetInterests,
        ageMin, ageMax, gender, languages, bidStrategy
      ]);

      logger.info(`Campaign created: ${campaignId}`);
      return { id: campaignId, message: 'Campaign created successfully' };
    } catch (error) {
      logger.error('Error creating campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaigns
   */
  async getCampaigns(accountId, status = null) {
    try {
      let query = `
        SELECT * FROM ad_campaigns
        WHERE account_id = ?
      `;
      const params = [accountId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';
      const campaigns = await this.db.all(query, params);

      return campaigns;
    } catch (error) {
      logger.error('Error fetching campaigns:', error);
      throw error;
    }
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(campaignId, status) {
    try {
      await this.db.run(`
        UPDATE ad_campaigns
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, campaignId]);

      logger.info(`Campaign ${campaignId} status updated to ${status}`);
      return { success: true };
    } catch (error) {
      logger.error('Error updating campaign status:', error);
      throw error;
    }
  }

  /**
   * Launch campaign to platform
   */
  async launchCampaign(campaignId) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get account details for API credentials
      const account = await this.db.get(`
        SELECT * FROM accounts WHERE id = ?
      `, [campaign.account_id]);

      // Get creatives for this campaign
      const creatives = await this.db.all(`
        SELECT * FROM ad_creatives WHERE campaign_id = ? AND status = 'active'
      `, [campaignId]);

      if (creatives.length === 0) {
        throw new Error('No active creatives for campaign');
      }

      // Call platform-specific API to launch campaign
      // This will be handled by platform-specific methods
      await this.updateCampaignStatus(campaignId, 'active');

      logger.info(`Campaign launched: ${campaignId}`);
      return { success: true, message: 'Campaign launched successfully' };
    } catch (error) {
      logger.error('Error launching campaign:', error);
      throw error;
    }
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId) {
    try {
      await this.updateCampaignStatus(campaignId, 'paused');
      return { success: true, message: 'Campaign paused' };
    } catch (error) {
      logger.error('Error pausing campaign:', error);
      throw error;
    }
  }

  /**
   * Get campaign performance
   */
  async getCampaignPerformance(campaignId) {
    try {
      const performance = await this.db.all(`
        SELECT
          ap.date,
          SUM(ap.impressions) as impressions,
          SUM(ap.clicks) as clicks,
          SUM(ap.conversions) as conversions,
          SUM(ap.leads) as leads,
          SUM(ap.spend) as spend,
          AVG(ap.ctr) as ctr,
          AVG(ap.cpc) as cpc,
          AVG(ap.cpm) as cpm,
          AVG(ap.roas) as roas,
          AVG(ap.roi) as roi
        FROM ad_performance ap
        WHERE ap.campaign_id = ?
        GROUP BY ap.date
        ORDER BY ap.date DESC
        LIMIT 30
      `, [campaignId]);

      return performance;
    } catch (error) {
      logger.error('Error fetching campaign performance:', error);
      throw error;
    }
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(campaignId) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      const performance = await this.db.get(`
        SELECT SUM(spend) as total_spend FROM ad_performance WHERE campaign_id = ?
      `, [campaignId]);

      const budgetRemaining = campaign.budget - (performance.total_spend || 0);
      const budgetUtilization = ((performance.total_spend || 0) / campaign.budget) * 100;

      return {
        totalBudget: campaign.budget,
        totalSpent: performance.total_spend || 0,
        remaining: budgetRemaining,
        utilization: budgetUtilization.toFixed(2)
      };
    } catch (error) {
      logger.error('Error fetching budget status:', error);
      throw error;
    }
  }

  /**
   * Create audience segment
   */
  async createAudience(audienceData) {
    try {
      const {
        accountId,
        platform,
        audienceName,
        audienceType,
        targetingCriteria,
        sourceData
      } = audienceData;

      const audienceId = uuidv4();

      await this.db.run(`
        INSERT INTO ad_audiences
        (id, account_id, platform, audience_name, audience_type, targeting_criteria, source_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        audienceId, accountId, platform, audienceName, audienceType, targetingCriteria, sourceData
      ]);

      logger.info(`Audience created: ${audienceId}`);
      return { id: audienceId, message: 'Audience created' };
    } catch (error) {
      logger.error('Error creating audience:', error);
      throw error;
    }
  }

  /**
   * Setup conversion tracking pixel
   */
  async setupConversionPixel(pixelData) {
    try {
      const {
        accountId,
        platform,
        pixelId,
        eventName
      } = pixelData;

      const id = uuidv4();

      await this.db.run(`
        INSERT INTO ad_pixels
        (id, account_id, platform, pixel_id, pixel_type, event_name, created_at)
        VALUES (?, ?, ?, ?, 'conversion', ?, CURRENT_TIMESTAMP)
      `, [id, accountId, platform, pixelId, eventName]);

      logger.info(`Conversion pixel setup: ${pixelId}`);
      return { success: true, pixelId };
    } catch (error) {
      logger.error('Error setting up conversion pixel:', error);
      throw error;
    }
  }

  /**
   * Track conversion
   */
  async trackConversion(conversionData) {
    try {
      const {
        campaignId,
        accountId,
        platform,
        creativeId,
        conversionType,
        conversionValue,
        userId
      } = conversionData;

      const conversionId = uuidv4();

      await this.db.run(`
        INSERT INTO ad_conversions
        (id, campaign_id, account_id, platform, creative_id, user_id, conversion_type, conversion_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        conversionId, campaignId, accountId, platform, creativeId, userId, conversionType, conversionValue
      ]);

      logger.info(`Conversion tracked: ${conversionId}`);
      return { id: conversionId, success: true };
    } catch (error) {
      logger.error('Error tracking conversion:', error);
      throw error;
    }
  }

  /**
   * Get leads from campaign
   */
  async getLeads(campaignId) {
    try {
      const leads = await this.db.all(`
        SELECT * FROM ad_leads
        WHERE campaign_id = ?
        ORDER BY created_at DESC
      `, [campaignId]);

      return leads;
    } catch (error) {
      logger.error('Error fetching leads:', error);
      throw error;
    }
  }

  /**
   * Add lead from ad
   */
  async addLead(leadData) {
    try {
      const {
        campaignId,
        accountId,
        leadName,
        leadEmail,
        leadPhone,
        leadCompany,
        leadValue,
        leadSource
      } = leadData;

      const leadId = uuidv4();

      await this.db.run(`
        INSERT INTO ad_leads
        (id, campaign_id, account_id, lead_name, lead_email, lead_phone, lead_company, lead_value, lead_source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        leadId, campaignId, accountId, leadName, leadEmail, leadPhone, leadCompany, leadValue, leadSource
      ]);

      logger.info(`Lead added: ${leadId}`);
      return { id: leadId, success: true };
    } catch (error) {
      logger.error('Error adding lead:', error);
      throw error;
    }
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId, status) {
    try {
      await this.db.run(`
        UPDATE ad_leads
        SET lead_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, leadId]);

      return { success: true };
    } catch (error) {
      logger.error('Error updating lead status:', error);
      throw error;
    }
  }
}

module.exports = new AdCampaignManager();
