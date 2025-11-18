const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const logger = require('./logger');

/**
 * Generate a unique ID
 */
function generateId() {
  return uuidv4();
}

/**
 * Generate API key prefix for display (first 4 and last 4 chars)
 */
function generateApiKeyPrefix(fullKey) {
  return `${fullKey.substring(0, 4)}...${fullKey.substring(fullKey.length - 4)}`;
}

/**
 * Format date for display
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  return moment(date).format(format);
}

/**
 * Get timestamp for database
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(likes, comments, shares, followers) {
  if (followers === 0) return 0;
  const totalEngagement = likes + comments + shares;
  return parseFloat(((totalEngagement / followers) * 100).toFixed(2));
}

/**
 * Format numbers with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Get percentage change between two values
 */
function getPercentageChange(oldValue, newValue) {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return parseFloat((((newValue - oldValue) / oldValue) * 100).toFixed(2));
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text) {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

/**
 * Extract mentions from text
 */
function extractMentions(text) {
  const mentionRegex = /@[a-zA-Z0-9_.-]+/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(mention => mention.substring(1)) : [];
}

/**
 * Extract URLs from text
 */
function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

/**
 * Convert platform name to display name
 */
function getPlatformDisplayName(platform) {
  const names = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    youtube: 'YouTube',
    tiktok: 'TikTok'
  };
  return names[platform.toLowerCase()] || platform;
}

/**
 * Get platform icon/color
 */
function getPlatformColor(platform) {
  const colors = {
    facebook: '#1877F2',
    instagram: '#E4405F',
    youtube: '#FF0000',
    tiktok: '#000000'
  };
  return colors[platform.toLowerCase()] || '#999999';
}

/**
 * Convert post type to display name
 */
function getPostTypeDisplayName(type) {
  const names = {
    text: 'Text Post',
    image: 'Image Post',
    video: 'Video Post',
    carousel: 'Carousel',
    reel: 'Reel/Short',
    story: 'Story',
    short: 'YouTube Short'
  };
  return names[type.toLowerCase()] || type;
}

/**
 * Parse time string to minutes
 */
function parseTimeToMinutes(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/**
 * Get optimal posting times by platform
 */
function getOptimalPostingTimes(platform) {
  const times = {
    facebook: ['09:00', '13:00', '19:00', '20:00'],
    instagram: ['06:00', '09:00', '11:00', '14:00', '19:00', '21:00'],
    youtube: ['09:00', '14:00', '18:00', '20:00'],
    tiktok: ['06:00', '10:00', '14:00', '18:00', '21:00', '22:00']
  };
  return times[platform.toLowerCase()] || ['09:00', '14:00', '19:00'];
}

/**
 * Calculate next optimal posting time
 */
function getNextOptimalPostingTime(platform, includeAll = false) {
  const optimalTimes = getOptimalPostingTimes(platform);
  const now = moment();
  const currentTime = now.format('HH:mm');

  let nextTime = optimalTimes.find(time => time > currentTime);

  if (!nextTime) {
    // Schedule for next day
    nextTime = optimalTimes[0];
    return moment().add(1, 'day').startOf('day').hour(parseInt(nextTime.split(':')[0])).minute(parseInt(nextTime.split(':')[1]));
  }

  const scheduledTime = moment(now).hour(parseInt(nextTime.split(':')[0])).minute(parseInt(nextTime.split(':')[1]));
  return scheduledTime;
}

/**
 * Truncate text to max length
 */
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Sleep/delay function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, { error: error.message });
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Batch array into chunks
 */
function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Build query string from object
 */
function buildQueryString(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Sanitize JSON response
 */
function sanitizeResponse(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeResponse);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields
    if (!['access_token', 'refresh_token', 'token', 'password', 'secret'].includes(key.toLowerCase())) {
      sanitized[key] = sanitizeResponse(value);
    }
  }
  return sanitized;
}

/**
 * Get date range
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = moment(startDate);

  while (currentDate.isBefore(moment(endDate)) || currentDate.isSame(moment(endDate))) {
    dates.push(currentDate.format('YYYY-MM-DD'));
    currentDate.add(1, 'day');
  }

  return dates;
}

/**
 * Get time since (e.g., "2 hours ago")
 */
function getTimeSince(date) {
  return moment(date).fromNow();
}

module.exports = {
  generateId,
  generateApiKeyPrefix,
  formatDate,
  getCurrentTimestamp,
  calculateEngagementRate,
  formatNumber,
  getPercentageChange,
  extractHashtags,
  extractMentions,
  extractUrls,
  getPlatformDisplayName,
  getPlatformColor,
  getPostTypeDisplayName,
  parseTimeToMinutes,
  getOptimalPostingTimes,
  getNextOptimalPostingTime,
  truncateText,
  delay,
  retryWithBackoff,
  batchArray,
  buildQueryString,
  sanitizeResponse,
  getDateRange,
  getTimeSince
};
