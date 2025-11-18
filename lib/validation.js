const logger = require('./logger');

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate social media account handle
 */
function isValidHandle(handle) {
  // Remove @ if present
  const cleanHandle = handle.replace(/^@/, '');
  return cleanHandle.length >= 2 && cleanHandle.length <= 50 && /^[a-zA-Z0-9._-]+$/.test(cleanHandle);
}

/**
 * Validate platform name
 */
function isValidPlatform(platform) {
  const validPlatforms = ['facebook', 'instagram', 'youtube', 'tiktok'];
  return validPlatforms.includes(platform.toLowerCase());
}

/**
 * Validate post type
 */
function isValidPostType(type) {
  const validTypes = ['text', 'image', 'video', 'carousel', 'reel', 'story', 'short'];
  return validTypes.includes(type.toLowerCase());
}

/**
 * Validate scheduled time (must be in future)
 */
function isValidScheduledTime(datetime) {
  const scheduledTime = new Date(datetime);
  const now = new Date();
  return scheduledTime > now;
}

/**
 * Validate content length by platform
 */
function isValidContentLength(content, platform) {
  const limits = {
    facebook: 63206,
    instagram: 2200,
    youtube: 5000,
    tiktok: 2200
  };

  const limit = limits[platform] || 5000;
  return content.length <= limit;
}

/**
 * Validate hashtag format
 */
function isValidHashtag(hashtag) {
  const cleanHashtag = hashtag.replace(/^#/, '');
  return cleanHashtag.length >= 1 && cleanHashtag.length <= 30 && /^[a-zA-Z0-9_]+$/.test(cleanHashtag);
}

/**
 * Validate trigger keywords
 */
function isValidKeywords(keywords) {
  if (!Array.isArray(keywords)) return false;
  return keywords.length > 0 && keywords.every(kw => kw.length > 0 && kw.length <= 100);
}

/**
 * Validate response delay (in seconds)
 */
function isValidResponseDelay(delay) {
  return Number.isInteger(delay) && delay >= 0 && delay <= 3600; // Max 1 hour
}

/**
 * Validate account age requirement (in days)
 */
function isValidMinAccountAge(days) {
  return Number.isInteger(days) && days >= 0 && days <= 3650; // Max 10 years
}

/**
 * Sanitize text input to prevent injection
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 5000); // Max 5000 chars
}

/**
 * Validate post request body
 */
function validatePostRequest(req) {
  const errors = [];

  if (!req.body.content || req.body.content.trim().length === 0) {
    errors.push('Content is required');
  }

  if (!req.body.accounts || !Array.isArray(req.body.accounts) || req.body.accounts.length === 0) {
    errors.push('At least one account must be selected');
  }

  if (req.body.accounts && req.body.accounts.length > 50) {
    errors.push('Maximum 50 accounts per post');
  }

  if (req.body.scheduled_time && !isValidScheduledTime(req.body.scheduled_time)) {
    errors.push('Scheduled time must be in the future');
  }

  if (req.body.post_type && !isValidPostType(req.body.post_type)) {
    errors.push('Invalid post type');
  }

  if (req.body.hashtags && !Array.isArray(req.body.hashtags)) {
    errors.push('Hashtags must be an array');
  }

  if (req.body.hashtags && !req.body.hashtags.every(isValidHashtag)) {
    errors.push('One or more hashtags are invalid');
  }

  return errors;
}

/**
 * Validate auto-response rule
 */
function validateAutoResponseRule(rule) {
  const errors = [];

  if (!rule.account_id || rule.account_id.trim().length === 0) {
    errors.push('Account ID is required');
  }

  if (!rule.platform || !isValidPlatform(rule.platform)) {
    errors.push('Valid platform is required');
  }

  if (!rule.rule_name || rule.rule_name.length === 0 || rule.rule_name.length > 100) {
    errors.push('Rule name must be 1-100 characters');
  }

  const validTriggerTypes = ['comment', 'dm', 'mention', 'keyword'];
  if (!rule.trigger_type || !validTriggerTypes.includes(rule.trigger_type)) {
    errors.push('Valid trigger type is required');
  }

  if (rule.trigger_type === 'keyword' && !isValidKeywords(rule.trigger_keywords)) {
    errors.push('Trigger keywords required for keyword trigger type');
  }

  const validResponseTypes = ['text', 'template', 'ai_generated'];
  if (!rule.response_type || !validResponseTypes.includes(rule.response_type)) {
    errors.push('Valid response type is required');
  }

  if (!rule.response_template || rule.response_template.trim().length === 0) {
    errors.push('Response template is required');
  }

  if (rule.response_template.length > 2000) {
    errors.push('Response template exceeds maximum length');
  }

  if (rule.response_delay_seconds && !isValidResponseDelay(rule.response_delay_seconds)) {
    errors.push('Invalid response delay');
  }

  if (rule.min_account_age_days && !isValidMinAccountAge(rule.min_account_age_days)) {
    errors.push('Invalid minimum account age');
  }

  return errors;
}

/**
 * Validate video upload
 */
function validateVideoFile(file) {
  const errors = [];
  const maxSize = 100 * 1024 * 1024; // 100MB
  const validMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

  if (!file) {
    errors.push('No file provided');
  } else {
    if (file.size > maxSize) {
      errors.push('Video exceeds maximum size (100MB)');
    }
    if (!validMimes.includes(file.mimetype)) {
      errors.push('Invalid video format');
    }
  }

  return errors;
}

/**
 * Validate image file
 */
function validateImageFile(file) {
  const errors = [];
  const maxSize = 10 * 1024 * 1024; // 10MB
  const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!file) {
    errors.push('No file provided');
  } else {
    if (file.size > maxSize) {
      errors.push('Image exceeds maximum size (10MB)');
    }
    if (!validMimes.includes(file.mimetype)) {
      errors.push('Invalid image format');
    }
  }

  return errors;
}

module.exports = {
  isValidEmail,
  isValidUrl,
  isValidHandle,
  isValidPlatform,
  isValidPostType,
  isValidScheduledTime,
  isValidContentLength,
  isValidHashtag,
  isValidKeywords,
  isValidResponseDelay,
  isValidMinAccountAge,
  sanitizeText,
  validatePostRequest,
  validateAutoResponseRule,
  validateVideoFile,
  validateImageFile
};
