const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const { getDatabase } = require('./database');

/**
 * AI-Powered Ad Optimization and Auto-Management
 */
class AdOptimizer {
  constructor() {
    this.db = null;
    this.optimizationThresholds = {
      lowPerformance: 0.5, // CTR below 0.5%
      highCPC: 2.0, // CPC above $2
      lowROAS: 1.5, // ROAS below 1.5x
      lowConversionRate: 0.5 // Conversion rate below 0.5%
    };
  }

  async initialize() {
    this.db = await getDatabase();
  }

  /**
   * Auto-optimize campaign budgets based on performance
   */
  async optimizeCampaignBudgets(accountId) {
    try {
      const campaigns = await this.db.all(`
        SELECT * FROM ad_campaigns WHERE account_id = ? AND status = 'active'
      `, [accountId]);

      for (const campaign of campaigns) {
        const performance = await this._getCampaignMetrics(campaign.id);
        const optimization = await this._determineBudgetOptimization(campaign, performance);

        if (optimization) {
          await this._applyBudgetOptimization(campaign.id, accountId, optimization);
        }
      }

      return { success: true, campaignsOptimized: campaigns.length };
    } catch (error) {
      logger.error('Error optimizing budgets:', error);
      throw error;
    }
  }

  /**
   * Auto-pause underperforming creatives
   */
  async pauseUnderformingCreatives(campaignId) {
    try {
      const creatives = await this.db.all(`
        SELECT ac.* FROM ad_creatives ac
        WHERE ac.campaign_id = ? AND ac.status = 'active'
      `, [campaignId]);

      for (const creative of creatives) {
        const metrics = await this._getCreativeMetrics(creative.id);

        // Pause if CTR is below threshold and has enough data
        if (metrics.impressions > 1000 && metrics.ctr < this.optimizationThresholds.lowPerformance) {
          await this.db.run(`
            UPDATE ad_creatives SET status = 'paused' WHERE id = ?
          `, [creative.id]);

          await this._logOptimization(
            campaignId,
            creative.id,
            'creative',
            'paused',
            'active',
            `Low CTR (${metrics.ctr.toFixed(2)}%)`
          );

          logger.info(`Paused underperforming creative: ${creative.id}`);
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error pausing underperforming creatives:', error);
      throw error;
    }
  }

  /**
   * Scale successful campaigns
   */
  async scaleSuccessfulCampaigns(accountId) {
    try {
      const campaigns = await this.db.all(`
        SELECT ac.* FROM ad_campaigns ac
        WHERE ac.account_id = ? AND ac.status = 'active'
      `, [accountId]);

      for (const campaign of campaigns) {
        const metrics = await this._getCampaignMetrics(campaign.id);

        // Scale budget if ROAS is strong
        if (metrics.roas > 3.0 && metrics.spend > 100) {
          const newBudget = campaign.budget * 1.25; // Increase by 25%
          const newDailyBudget = campaign.daily_budget ? campaign.daily_budget * 1.25 : null;

          await this.db.run(`
            UPDATE ad_campaigns
            SET budget = ?, daily_budget = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newBudget, newDailyBudget, campaign.id]);

          await this._logOptimization(
            campaign.id,
            null,
            'budget',
            newBudget,
            campaign.budget,
            `High ROAS (${metrics.roas.toFixed(2)}x) - Scaling campaign`
          );

          logger.info(`Scaled successful campaign: ${campaign.id}`);
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error scaling campaigns:', error);
      throw error;
    }
  }

  /**
   * Optimize audience targeting
   */
  async optimizeAudienceTargeting(campaignId) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      const metrics = await this._getCampaignMetrics(campaignId);

      // Recommend audience changes based on performance
      const recommendations = {
        narrowAudience: metrics.cpc > 2.0 && metrics.ctr < 1.0,
        expandAudience: metrics.roas > 2.0 && metrics.spend < campaign.budget * 0.3,
        changeAge: metrics.ctr < 0.5,
        changeInterests: metrics.cpc > 2.0
      };

      return recommendations;
    } catch (error) {
      logger.error('Error optimizing audience:', error);
      throw error;
    }
  }

  /**
   * Recommend creative rotations
   */
  async recommendCreativeRotations(campaignId) {
    try {
      const creatives = await this.db.all(`
        SELECT ac.* FROM ad_creatives ac
        WHERE ac.campaign_id = ? AND ac.status IN ('active', 'paused')
      `, [campaignId]);

      const recommendations = [];

      for (const creative of creatives) {
        const metrics = await this._getCreativeMetrics(creative.id);

        // If active and performing poorly, recommend pause
        if (creative.status === 'active' && metrics.ctr < 0.3 && metrics.impressions > 500) {
          recommendations.push({
            creativeId: creative.id,
            action: 'pause',
            reason: 'Low CTR',
            ctr: metrics.ctr.toFixed(2)
          });
        }

        // If paused and could perform, recommend reactivation
        if (creative.status === 'paused' && metrics.ctr > 1.5) {
          recommendations.push({
            creativeId: creative.id,
            action: 'activate',
            reason: 'Shows strong potential',
            ctr: metrics.ctr.toFixed(2)
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('Error recommending creative rotations:', error);
      throw error;
    }
  }

  /**
   * Auto-allocate budget to best-performing audiences
   */
  async rebalanceBudgetByAudience(campaignId) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      const creatives = await this.db.all(`
        SELECT ac.* FROM ad_creatives ac
        WHERE ac.campaign_id = ? AND ac.status = 'active'
      `, [campaignId]);

      let totalROAS = 0;
      const creativeMetrics = [];

      // Calculate metrics for each creative
      for (const creative of creatives) {
        const metrics = await this._getCreativeMetrics(creative.id);
        creativeMetrics.push({
          id: creative.id,
          roas: metrics.roas,
          roi: metrics.roi
        });
        totalROAS += metrics.roas;
      }

      // Allocate budget proportionally
      const budgetAllocation = {};
      for (const metric of creativeMetrics) {
        const allocation = (metric.roas / totalROAS) * campaign.budget;
        budgetAllocation[metric.id] = allocation;
      }

      // Log the rebalancing
      const allocationId = uuidv4();
      await this.db.run(`
        INSERT INTO ad_budget_allocation
        (id, campaign_id, account_id, total_budget, allocation_date, budget_by_audience, auto_optimize, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_DATE, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        allocationId,
        campaignId,
        campaign.account_id,
        campaign.budget,
        JSON.stringify(budgetAllocation)
      ]);

      return { success: true, allocation: budgetAllocation };
    } catch (error) {
      logger.error('Error rebalancing budget:', error);
      throw error;
    }
  }

  /**
   * Analyze and recommend bid adjustments
   */
  async optimizeBidStrategy(campaignId) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      const metrics = await this._getCampaignMetrics(campaignId);

      const bidRecommendations = {
        currentBidStrategy: campaign.bid_strategy,
        recommendations: []
      };

      // Recommend bid strategy changes
      if (metrics.roas > 2.5 && metrics.cpc < 1.0) {
        bidRecommendations.recommendations.push({
          action: 'increaseeBid',
          reason: 'High ROAS and low CPC indicate room to increase bids',
          suggestedStrategy: 'target_roas'
        });
      }

      if (metrics.cpc > 2.5 && metrics.ctr < 0.5) {
        bidRecommendations.recommendations.push({
          action: 'decreaseBid',
          reason: 'High CPC and low CTR indicate over-bidding',
          suggestedStrategy: 'lowest_cost'
        });
      }

      if (metrics.conversions > 50 && metrics.cpc > 0) {
        bidRecommendations.recommendations.push({
          action: 'optimizeForConversions',
          reason: 'Sufficient conversion data available',
          suggestedStrategy: 'target_cost'
        });
      }

      return bidRecommendations;
    } catch (error) {
      logger.error('Error optimizing bid strategy:', error);
      throw error;
    }
  }

  /**
   * Get campaign metrics
   */
  async _getCampaignMetrics(campaignId) {
    try {
      const metrics = await this.db.get(`
        SELECT
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(conversions) as conversions,
          SUM(spend) as spend,
          AVG(ctr) as ctr,
          AVG(cpc) as cpc,
          AVG(roas) as roas,
          AVG(roi) as roi
        FROM ad_performance
        WHERE campaign_id = ?
        AND date >= date('now', '-7 days')
      `, [campaignId]);

      return {
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        conversions: metrics.conversions || 0,
        spend: metrics.spend || 0,
        ctr: metrics.ctr || 0,
        cpc: metrics.cpc || 0,
        roas: metrics.roas || 0,
        roi: metrics.roi || 0
      };
    } catch (error) {
      logger.error('Error getting campaign metrics:', error);
      return {};
    }
  }

  /**
   * Get creative metrics
   */
  async _getCreativeMetrics(creativeId) {
    try {
      const metrics = await this.db.get(`
        SELECT
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          AVG(ctr) as ctr,
          AVG(cpc) as cpc,
          AVG(roas) as roas,
          AVG(roi) as roi
        FROM ad_performance
        WHERE creative_id = ?
        AND date >= date('now', '-7 days')
      `, [creativeId]);

      return {
        impressions: metrics.impressions || 0,
        clicks: metrics.clicks || 0,
        ctr: metrics.ctr || 0,
        cpc: metrics.cpc || 0,
        roas: metrics.roas || 0,
        roi: metrics.roi || 0
      };
    } catch (error) {
      logger.error('Error getting creative metrics:', error);
      return {};
    }
  }

  /**
   * Determine budget optimization
   */
  async _determineBudgetOptimization(campaign, metrics) {
    try {
      if (metrics.roas > 2.5) {
        return {
          type: 'increase',
          percentage: 0.15, // 15% increase
          reason: 'High ROAS'
        };
      }

      if (metrics.roas < 1.0 && metrics.spend > 50) {
        return {
          type: 'decrease',
          percentage: 0.20, // 20% decrease
          reason: 'Low ROAS'
        };
      }

      return null;
    } catch (error) {
      logger.error('Error determining budget optimization:', error);
      return null;
    }
  }

  /**
   * Apply budget optimization
   */
  async _applyBudgetOptimization(campaignId, accountId, optimization) {
    try {
      const campaign = await this.db.get(`
        SELECT * FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      let newBudget = campaign.budget;
      let newDailyBudget = campaign.daily_budget;

      if (optimization.type === 'increase') {
        newBudget *= (1 + optimization.percentage);
        newDailyBudget = newDailyBudget ? newDailyBudget * (1 + optimization.percentage) : null;
      } else if (optimization.type === 'decrease') {
        newBudget *= (1 - optimization.percentage);
        newDailyBudget = newDailyBudget ? newDailyBudget * (1 - optimization.percentage) : null;
      }

      await this.db.run(`
        UPDATE ad_campaigns
        SET budget = ?, daily_budget = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newBudget, newDailyBudget, campaignId]);

      await this._logOptimization(
        campaignId,
        null,
        'budget',
        newBudget,
        campaign.budget,
        optimization.reason
      );

      logger.info(`Budget optimization applied to campaign ${campaignId}`);
    } catch (error) {
      logger.error('Error applying budget optimization:', error);
    }
  }

  /**
   * Log optimization action
   */
  async _logOptimization(campaignId, creativeId, type, newValue, previousValue, reason) {
    try {
      const historyId = uuidv4();
      const campaign = await this.db.get(`
        SELECT account_id FROM ad_campaigns WHERE id = ?
      `, [campaignId]);

      await this.db.run(`
        INSERT INTO ad_optimization_history
        (id, campaign_id, account_id, creative_id, optimization_type, action_taken, previous_value, new_value, reason, automated, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `, [
        historyId,
        campaignId,
        campaign.account_id,
        creativeId,
        type,
        `${type} adjusted`,
        String(previousValue),
        String(newValue),
        reason
      ]);
    } catch (error) {
      logger.error('Error logging optimization:', error);
    }
  }
}

module.exports = new AdOptimizer();
