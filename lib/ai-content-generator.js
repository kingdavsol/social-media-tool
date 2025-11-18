const axios = require('axios');
const logger = require('./logger');

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * AI Content Generator using Claude API
 */
class AIContentGenerator {
  constructor() {
    this.apiKey = CLAUDE_API_KEY;
    if (!this.apiKey) {
      logger.warn('Claude API key not configured');
    }
  }

  /**
   * Generate caption for a post
   */
  async generateCaption(content, platform, tone = 'engaging', includeEmojis = true) {
    try {
      const prompt = `Generate a compelling social media caption for ${platform} based on the following content:

Content: "${content}"

Requirements:
- Tone: ${tone}
- Include emojis: ${includeEmojis}
- Max length: ${platform === 'tiktok' ? 150 : 250} characters
- Make it engaging and relevant to the platform
- Use natural language that resonates with audiences

Provide only the caption, no additional text.`;

      const caption = await this._callClaude(prompt);
      return caption.trim();
    } catch (error) {
      logger.error('Error generating caption:', error.message);
      throw error;
    }
  }

  /**
   * Generate hashtags for a post
   */
  async generateHashtags(content, platform, count = 10) {
    try {
      const prompt = `Generate ${count} highly relevant hashtags for ${platform} based on this content:

Content: "${content}"

Requirements:
- Mix of popular and niche hashtags
- Relevant to the content and platform trends
- No duplicate hashtags
- Format: one hashtag per line without the # symbol
- Focus on engagement and reach
- Consider platform-specific best practices

Provide only the hashtags, one per line, no explanations.`;

      const response = await this._callClaude(prompt);
      const hashtags = response
        .split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, count);
      return hashtags;
    } catch (error) {
      logger.error('Error generating hashtags:', error.message);
      throw error;
    }
  }

  /**
   * Generate description for a video
   */
  async generateDescription(videoTitle, videoContent, platform) {
    try {
      const prompt = `Generate a compelling video description for ${platform}:

Title: "${videoTitle}"
Content: "${videoContent}"

Requirements:
- ${platform === 'youtube' ? 'Max 5000 characters' : 'Max 2200 characters'}
- Include key keywords for SEO
- Add call-to-action
- Make it informative and engaging
- Include timestamps if applicable
- Professional tone

Provide only the description.`;

      const description = await this._callClaude(prompt);
      return description.trim();
    } catch (error) {
      logger.error('Error generating description:', error.message);
      throw error;
    }
  }

  /**
   * Generate auto-response for comments
   */
  async generateAutoResponse(commentContent, context = '', tone = 'friendly') {
    try {
      const prompt = `Generate an appropriate auto-response to the following comment:

Comment: "${commentContent}"
${context ? `Context: "${context}"` : ''}

Requirements:
- Tone: ${tone}
- Keep it brief (max 150 characters)
- Professional yet personable
- Acknowledge the comment appropriately
- Add value if possible
- No emojis unless appropriate for the context

Provide only the response, no additional text.`;

      const response = await this._callClaude(prompt);
      return response.trim();
    } catch (error) {
      logger.error('Error generating auto-response:', error.message);
      throw error;
    }
  }

  /**
   * Generate post ideas based on content theme
   */
  async generatePostIdeas(theme, platform, count = 5) {
    try {
      const prompt = `Generate ${count} creative post ideas for ${platform} around the theme of "${theme}":

Requirements:
- Each idea should be unique and engaging
- Mix of different content types (text, images, videos, stories, etc.)
- Include potential hashtag suggestions
- Consider current trends
- Tailor to platform-specific best practices
- Make them actionable and practical

Format each idea as:
Title: [brief title]
Type: [post type]
Concept: [brief concept]
Hashtags: [suggested hashtags]
---

Provide ${count} ideas in this format.`;

      const response = await this._callClaude(prompt);
      return response.trim();
    } catch (error) {
      logger.error('Error generating post ideas:', error.message);
      throw error;
    }
  }

  /**
   * Optimize existing caption
   */
  async optimizeCaption(caption, platform) {
    try {
      const prompt = `Optimize the following social media caption for ${platform}:

Current caption: "${caption}"

Requirements:
- Improve engagement potential
- Maintain the original message
- Optimize for platform algorithms
- Add relevant emojis
- Check character count limits (${platform === 'tiktok' ? 150 : 250} max)
- Keep natural language
- Remove redundant words

Provide only the optimized caption.`;

      const optimized = await this._callClaude(prompt);
      return optimized.trim();
    } catch (error) {
      logger.error('Error optimizing caption:', error.message);
      throw error;
    }
  }

  /**
   * Analyze sentiment of a comment
   */
  async analyzeSentiment(text) {
    try {
      const prompt = `Analyze the sentiment of this comment and respond with ONLY one word:

Comment: "${text}"

Respond with only ONE of: positive, negative, neutral, mixed

No explanation, just the sentiment word.`;

      const sentiment = await this._callClaude(prompt);
      const cleanSentiment = sentiment.trim().toLowerCase();

      if (!['positive', 'negative', 'neutral', 'mixed'].includes(cleanSentiment)) {
        return 'neutral';
      }

      return cleanSentiment;
    } catch (error) {
      logger.error('Error analyzing sentiment:', error.message);
      return 'neutral';
    }
  }

  /**
   * Extract key information from content
   */
  async extractKeywords(content, count = 5) {
    try {
      const prompt = `Extract the top ${count} keywords from the following content:

Content: "${content}"

Requirements:
- ${count} most important and relevant keywords
- One keyword per line
- No phrases, single words or short terms only
- Ordered by relevance
- Consider SEO value

Provide only the keywords, one per line, no numbering or explanations.`;

      const response = await this._callClaude(prompt);
      const keywords = response
        .split('\n')
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0)
        .slice(0, count);
      return keywords;
    } catch (error) {
      logger.error('Error extracting keywords:', error.message);
      throw error;
    }
  }

  /**
   * Generate platform-specific tags
   */
  async generatePlatformTags(content, platform) {
    try {
      let prompt = '';

      if (platform.toLowerCase() === 'instagram') {
        prompt = `Generate 10-15 relevant Instagram tags (people/places/things to tag) based on:
Content: "${content}"
Format: one tag per line without @ symbol
Focus on accuracy and relevance.`;
      } else if (platform.toLowerCase() === 'facebook') {
        prompt = `Generate 5-8 relevant tags for Facebook post based on:
Content: "${content}"
Format: one tag per line
Include category tags if applicable.`;
      } else if (platform.toLowerCase() === 'youtube') {
        prompt = `Generate 10-15 relevant YouTube tags based on:
Content: "${content}"
Format: one tag per line
Focus on search relevance and trending topics.`;
      } else if (platform.toLowerCase() === 'tiktok') {
        prompt = `Generate 8-12 relevant TikTok sounds/effects/tags based on:
Content: "${content}"
Format: one tag per line
Include trending and niche tags.`;
      }

      const response = await this._callClaude(prompt);
      const tags = response
        .split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      return tags;
    } catch (error) {
      logger.error('Error generating platform tags:', error.message);
      throw error;
    }
  }

  /**
   * Call Claude API
   */
  async _callClaude(prompt) {
    try {
      if (!this.apiKey) {
        // Return placeholder if API key not configured
        logger.warn('Claude API key not configured, returning placeholder');
        return prompt.substring(0, 50) + '...';
      }

      const response = await axios.post(CLAUDE_API_URL, {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
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

module.exports = AIContentGenerator;
