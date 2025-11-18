const axios = require('axios');
const logger = require('./logger');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * AI Ad Copy and Creative Generator using Claude
 */
class AdGenerator {
  constructor() {
    this.apiKey = CLAUDE_API_KEY;
  }

  /**
   * Generate ad headlines
   */
  async generateHeadlines(productName, productDescription, platform, count = 5) {
    try {
      const prompt = `Generate ${count} compelling ad headlines for a ${platform} ad campaign.

Product: ${productName}
Description: ${productDescription}

Requirements:
- Each headline should be unique and attention-grabbing
- Optimize for ${platform} (character limits: ${this._getPlatformHeadlineLimit(platform)})
- Include power words (Best, New, Free, Limited, Exclusive, etc.)
- Focus on benefits, not features
- Make them clickable and curiosity-driven
- No hashtags or special characters

Provide ONLY the headlines, one per line, numbered 1-${count}.`;

      const response = await this._callClaude(prompt);
      const headlines = response
        .split('\n')
        .filter(h => h.trim().length > 0)
        .map(h => h.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);

      return headlines;
    } catch (error) {
      logger.error('Error generating headlines:', error);
      throw error;
    }
  }

  /**
   * Generate ad copy/body text
   */
  async generateAdCopy(productName, productDescription, target, platform, count = 3) {
    try {
      const prompt = `Generate ${count} compelling ad copy variations for a ${platform} ad campaign.

Product: ${productName}
Description: ${productDescription}
Target Audience: ${target}

Requirements:
- Concise and persuasive copy (${this._getPlatformCopyLimit(platform)} characters max)
- Start with a hook that grabs attention
- Highlight key benefits
- Include proof/social proof if possible
- Create sense of urgency or exclusivity
- Make it conversational and relatable
- End with a clear value proposition
- Focus on what's in it for the customer

Provide ONLY the ad copy variations, separated by "---", no numbering.`;

      const response = await this._callClaude(prompt);
      const copies = response
        .split('---')
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .slice(0, count);

      return copies;
    } catch (error) {
      logger.error('Error generating ad copy:', error);
      throw error;
    }
  }

  /**
   * Generate call-to-action buttons
   */
  async generateCTAs(objective, productType, count = 5) {
    try {
      const prompt = `Generate ${count} compelling CTA (Call-To-Action) button texts for an ad campaign.

Objective: ${objective}
Product Type: ${productType}

Requirements:
- Action-oriented verbs (Shop, Learn, Sign Up, Get, Try, Discover, etc.)
- Create urgency when appropriate
- Keep under 20 characters
- Focus on customer benefit
- Make them clickable and clear
- Match the objective

Provide ONLY the CTA texts, one per line.`;

      const response = await this._callClaude(prompt);
      const ctas = response
        .split('\n')
        .filter(c => c.trim().length > 0)
        .map(c => c.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);

      return ctas;
    } catch (error) {
      logger.error('Error generating CTAs:', error);
      throw error;
    }
  }

  /**
   * Generate descriptions for ads
   */
  async generateDescriptions(headline, productName, benefits, count = 3) {
    try {
      const prompt = `Generate ${count} compelling ad descriptions that complement the headline.

Headline: "${headline}"
Product: ${productName}
Key Benefits: ${Array.isArray(benefits) ? benefits.join(', ') : benefits}

Requirements:
- Expand on the headline's promise
- Highlight 2-3 key benefits
- Include specific details or numbers if available
- Create curiosity without being clickbait
- Keep it concise (150-200 characters)
- Use conversational tone
- Add one specific benefit per description

Provide ONLY the descriptions, separated by "---".`;

      const response = await this._callClaude(prompt);
      const descriptions = response
        .split('---')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .slice(0, count);

      return descriptions;
    } catch (error) {
      logger.error('Error generating descriptions:', error);
      throw error;
    }
  }

  /**
   * Generate ad targeting suggestions
   */
  async generateTargetingCriteria(productName, productDescription, targetAudience) {
    try {
      const prompt = `Suggest detailed targeting criteria for an ad campaign.

Product: ${productName}
Description: ${productDescription}
Target Audience: ${targetAudience}

Provide targeting recommendations in this JSON format:
{
  "demographics": {
    "age_range": [min, max],
    "gender": "all/male/female",
    "languages": ["language1", "language2"]
  },
  "interests": ["interest1", "interest2", "interest3", "interest4", "interest5"],
  "behaviors": ["behavior1", "behavior2", "behavior3"],
  "lookalike_audiences": ["audience1", "audience2"],
  "exclusions": ["exclude1", "exclude2"],
  "device_types": ["mobile", "desktop"],
  "placements": ["feed", "stories", "reels"]
}

Provide ONLY the JSON, no additional text.`;

      const response = await this._callClaude(prompt);
      const criteria = JSON.parse(response);
      return criteria;
    } catch (error) {
      logger.error('Error generating targeting criteria:', error);
      throw error;
    }
  }

  /**
   * Generate bidding strategy recommendations
   */
  async generateBiddingStrategy(objective, budget, dailyBudget, targetCPA = null) {
    try {
      const prompt = `Recommend bidding strategy for an ad campaign.

Objective: ${objective}
Total Budget: $${budget}
Daily Budget: $${dailyBudget}
${targetCPA ? `Target CPA: $${targetCPA}` : ''}

Provide recommendations in JSON format:
{
  "bid_strategy": "automatic/lowest_cost/target_cost/target_roas/manual",
  "reason": "explanation",
  "recommended_bid_amount": number or null,
  "optimization_goal": "impressions/clicks/conversions",
  "daily_budget_recommendation": number,
  "tips": ["tip1", "tip2", "tip3"]
}

Provide ONLY the JSON, no additional text.`;

      const response = await this._callClaude(prompt);
      const strategy = JSON.parse(response);
      return strategy;
    } catch (error) {
      logger.error('Error generating bidding strategy:', error);
      throw error;
    }
  }

  /**
   * Generate A/B test suggestions
   */
  async generateABTestSuggestions(productName, currentPerformance = null) {
    try {
      const prompt = `Suggest A/B tests for an ad campaign to improve performance.

Product: ${productName}
${currentPerformance ? `Current Performance: ${JSON.stringify(currentPerformance)}` : 'New campaign'}

Provide A/B test recommendations in JSON format:
{
  "tests": [
    {
      "test_name": "Test Name",
      "variable": "headline/image/copy/cta/audience/placement",
      "variant_a": "description of variant A",
      "variant_b": "description of variant B",
      "expected_improvement": "potential improvement percentage",
      "metric_to_track": "ctr/cpc/conversions/roas",
      "duration_days": 7
    },
    ...
  ],
  "priority_order": ["test1", "test2", "test3"],
  "success_criteria": "definition of winning variant"
}

Provide ONLY the JSON, no additional text.`;

      const response = await this._callClaude(prompt);
      const tests = JSON.parse(response);
      return tests;
    } catch (error) {
      logger.error('Error generating A/B test suggestions:', error);
      throw error;
    }
  }

  /**
   * Optimize existing copy
   */
  async optimizeCopy(headline, copyText, platform, metric = 'ctr') {
    try {
      const prompt = `Optimize this ad copy to improve ${metric}.

Current Headline: "${headline}"
Current Copy: "${copyText}"
Platform: ${platform}
Optimize For: ${metric === 'ctr' ? 'Click-Through Rate' : metric === 'cpc' ? 'Cost Per Click' : 'Conversions'}

Provide optimization suggestions in JSON format:
{
  "optimized_headline": "improved headline",
  "optimized_copy": "improved copy text",
  "key_changes": ["change1", "change2", "change3"],
  "rationale": "explanation of why these changes improve ${metric}",
  "expected_improvement": "estimated improvement percentage"
}

Provide ONLY the JSON, no additional text.`;

      const response = await this._callClaude(prompt);
      const optimization = JSON.parse(response);
      return optimization;
    } catch (error) {
      logger.error('Error optimizing copy:', error);
      throw error;
    }
  }

  /**
   * Generate image descriptions for ads (for image generation/search)
   */
  async generateImageDescriptions(productName, productDescription, count = 3) {
    try {
      const prompt = `Generate detailed image descriptions for ad creatives.

Product: ${productName}
Description: ${productDescription}

Generate ${count} detailed image descriptions that would work well as ad visuals.

Requirements:
- Each description should guide image creation
- Include color suggestions, composition, mood
- Include specific elements (product, people, settings, text overlays)
- Focus on what would convert well as an ad
- Make them specific enough for image generation AI

Provide ONLY the descriptions, separated by "---".`;

      const response = await this._callClaude(prompt);
      const descriptions = response
        .split('---')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .slice(0, count);

      return descriptions;
    } catch (error) {
      logger.error('Error generating image descriptions:', error);
      throw error;
    }
  }

  /**
   * Helper: Get platform headline character limit
   */
  _getPlatformHeadlineLimit(platform) {
    const limits = {
      facebook: 25,
      instagram: 30,
      google: 30,
      tiktok: 35,
      all: 25
    };
    return limits[platform] || 25;
  }

  /**
   * Helper: Get platform copy character limit
   */
  _getPlatformCopyLimit(platform) {
    const limits = {
      facebook: 125,
      instagram: 125,
      google: 90,
      tiktok: 150,
      all: 90
    };
    return limits[platform] || 90;
  }

  /**
   * Call Claude API
   */
  async _callClaude(prompt) {
    try {
      if (!this.apiKey) {
        logger.warn('Claude API key not configured');
        return 'API key not configured';
      }

      const response = await axios.post(CLAUDE_API_URL, {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });

      return response.data.content[0].text;
    } catch (error) {
      logger.error('Claude API error:', error.response?.data || error.message);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }
}

module.exports = new AdGenerator();
