const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const AIContentGenerator = require('../lib/ai-content-generator');
const VideoMediaGenerator = require('../lib/video-media-generator');
const { isValidPlatform } = require('../lib/validation');

const aiGenerator = new AIContentGenerator();
const videoGenerator = new VideoMediaGenerator();

/**
 * Generate caption for content
 */
router.post('/generate-caption', async (req, res) => {
  try {
    const { content, platform, tone = 'engaging', includeEmojis = true } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const caption = await aiGenerator.generateCaption(content, platform, tone, includeEmojis);

    res.json({
      caption,
      platform,
      length: caption.length
    });
  } catch (error) {
    logger.error('Error generating caption:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate hashtags for content
 */
router.post('/generate-hashtags', async (req, res) => {
  try {
    const { content, platform, count = 10 } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const hashtags = await aiGenerator.generateHashtags(content, platform, count);

    res.json({
      hashtags,
      platform,
      count: hashtags.length
    });
  } catch (error) {
    logger.error('Error generating hashtags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate video description
 */
router.post('/generate-description', async (req, res) => {
  try {
    const { videoTitle, videoContent, platform } = req.body;

    if (!videoTitle || videoTitle.trim().length === 0) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    if (!videoContent || videoContent.trim().length === 0) {
      return res.status(400).json({ error: 'Video content is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const description = await aiGenerator.generateDescription(videoTitle, videoContent, platform);

    res.json({
      description,
      platform,
      length: description.length
    });
  } catch (error) {
    logger.error('Error generating description:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate platform-specific tags
 */
router.post('/generate-tags', async (req, res) => {
  try {
    const { content, platform } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const tags = await aiGenerator.generatePlatformTags(content, platform);

    res.json({
      tags,
      platform,
      count: tags.length
    });
  } catch (error) {
    logger.error('Error generating tags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate post ideas
 */
router.post('/generate-ideas', async (req, res) => {
  try {
    const { theme, platform, count = 5 } = req.body;

    if (!theme || theme.trim().length === 0) {
      return res.status(400).json({ error: 'Theme is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const ideas = await aiGenerator.generatePostIdeas(theme, platform, count);

    res.json({
      ideas,
      platform,
      theme
    });
  } catch (error) {
    logger.error('Error generating post ideas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Optimize caption
 */
router.post('/optimize-caption', async (req, res) => {
  try {
    const { caption, platform } = req.body;

    if (!caption || caption.trim().length === 0) {
      return res.status(400).json({ error: 'Caption is required' });
    }

    if (!platform || !isValidPlatform(platform)) {
      return res.status(400).json({ error: 'Valid platform is required' });
    }

    const optimizedCaption = await aiGenerator.optimizeCaption(caption, platform);

    res.json({
      originalCaption: caption,
      optimizedCaption,
      platform
    });
  } catch (error) {
    logger.error('Error optimizing caption:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Extract keywords
 */
router.post('/extract-keywords', async (req, res) => {
  try {
    const { content, count = 5 } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const keywords = await aiGenerator.extractKeywords(content, count);

    res.json({
      keywords,
      count: keywords.length
    });
  } catch (error) {
    logger.error('Error extracting keywords:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate thumbnail
 */
router.post('/generate-thumbnail', async (req, res) => {
  try {
    const { title, options = {} } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const thumbnail = await videoGenerator.generateAIThumbnail(title, options);

    res.json({
      thumbnailPath: thumbnail.thumbnailPath,
      width: thumbnail.width,
      height: thumbnail.height,
      generated: true
    });
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get content templates
 */
router.get('/templates', async (req, res) => {
  try {
    const db = await getDatabase();
    const platform = req.query.platform;

    let query = 'SELECT id, name, platform, category, template_content FROM content_templates';
    const params = [];

    if (platform && isValidPlatform(platform)) {
      query += ' WHERE platform = ? OR platform IS NULL';
      params.push(platform);
    }

    query += ' ORDER BY platform, name';
    const templates = await db.all(query, params);

    res.json(templates);
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create content template
 */
router.post('/templates', async (req, res) => {
  try {
    const { name, platform, category, templateContent, hashtagTemplate } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (!templateContent || templateContent.trim().length === 0) {
      return res.status(400).json({ error: 'Template content is required' });
    }

    const db = await getDatabase();
    const templateId = uuidv4();

    await db.run(`
      INSERT INTO content_templates
      (id, name, platform, category, template_content, hashtag_template, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      templateId, name, platform || null, category || null, templateContent, hashtagTemplate || null
    ]);

    res.status(201).json({
      id: templateId,
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analyze comment sentiment
 */
router.post('/analyze-sentiment', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const sentiment = await aiGenerator.analyzeSentiment(text);

    res.json({
      text,
      sentiment
    });
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
