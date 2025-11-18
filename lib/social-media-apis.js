const axios = require('axios');
const logger = require('./logger');
const { retryWithBackoff, delay } = require('./helpers');

const FACEBOOK_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0';
const FACEBOOK_GRAPH_URL = `https://graph.instagram.com/${FACEBOOK_API_VERSION}`;
const FACEBOOK_API_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3';
const TIKTOK_API_URL = 'https://open.tiktokapis.com/v1';

/**
 * Facebook/Instagram API Client
 */
class FacebookInstagramAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: FACEBOOK_GRAPH_URL,
      params: {
        access_token: accessToken
      }
    });
  }

  /**
   * Get account info
   */
  async getAccountInfo(userId) {
    try {
      const response = await this.client.get(`/${userId}?fields=id,username,name,biography,profile_picture_url,followers_count,media_count,ig_id`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching account info:', error.message);
      throw error;
    }
  }

  /**
   * Create a post (caption + image/video)
   */
  async createPost(userId, media, caption, hashtags, mentions) {
    try {
      const fullCaption = this._buildCaption(caption, hashtags, mentions);

      const payload = {
        image_url: media.url, // For single image
        caption: fullCaption,
        user_tags: mentions
      };

      // For video
      if (media.type === 'video') {
        payload.video_url = media.url;
        delete payload.image_url;
      }

      const response = await this.client.post(`/${userId}/media`, payload);
      return {
        id: response.data.id,
        url: `https://instagram.com/p/${response.data.id}`
      };
    } catch (error) {
      logger.error('Error creating Instagram post:', error.message);
      throw error;
    }
  }

  /**
   * Create a carousel (multiple images)
   */
  async createCarousel(userId, items, caption, hashtags, mentions) {
    try {
      const fullCaption = this._buildCaption(caption, hashtags, mentions);

      const carouselItems = items.map(item => ({
        image_url: item.url
      }));

      const response = await this.client.post(`/${userId}/media`, {
        media_type: 'CAROUSEL',
        children: carouselItems,
        caption: fullCaption
      });

      return {
        id: response.data.id,
        url: `https://instagram.com/p/${response.data.id}`
      };
    } catch (error) {
      logger.error('Error creating carousel:', error.message);
      throw error;
    }
  }

  /**
   * Create a reel
   */
  async createReel(userId, videoUrl, caption, thumbnail, hashtags, mentions) {
    try {
      const fullCaption = this._buildCaption(caption, hashtags, mentions);

      const response = await this.client.post(`/${userId}/media`, {
        media_type: 'REELS',
        video_url: videoUrl,
        thumbnail_url: thumbnail,
        caption: fullCaption
      });

      return {
        id: response.data.id,
        url: `https://instagram.com/reel/${response.data.id}`
      };
    } catch (error) {
      logger.error('Error creating reel:', error.message);
      throw error;
    }
  }

  /**
   * Get engagement metrics for a post
   */
  async getPostMetrics(mediaId) {
    try {
      const response = await this.client.get(`/${mediaId}?fields=id,like_count,comments_count,media_product_type`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching post metrics:', error.message);
      throw error;
    }
  }

  /**
   * Get comments on a post
   */
  async getPostComments(mediaId, limit = 100) {
    try {
      const response = await this.client.get(`/${mediaId}/comments?fields=id,from,text,timestamp,like_count&limit=${limit}`);
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching comments:', error.message);
      throw error;
    }
  }

  /**
   * Reply to a comment
   */
  async replyToComment(commentId, message) {
    try {
      const response = await this.client.post(`/${commentId}/replies`, {
        message
      });
      return response.data;
    } catch (error) {
      logger.error('Error replying to comment:', error.message);
      throw error;
    }
  }

  /**
   * Get story insights
   */
  async getStoryMetrics(storyId) {
    try {
      const response = await this.client.get(`/${storyId}?fields=id,story_expiration_timestamp,seen_count,replay_count`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching story metrics:', error.message);
      throw error;
    }
  }

  /**
   * Facebook: Create a page post
   */
  async createPagePost(pageId, message, link, image, hashtags) {
    try {
      const client = axios.create({
        baseURL: FACEBOOK_API_URL,
        params: {
          access_token: this.accessToken
        }
      });

      const fullMessage = this._buildCaption(message, hashtags);

      const payload = {
        message: fullMessage
      };

      if (image) payload.picture = image;
      if (link) payload.link = link;

      const response = await client.post(`/${pageId}/feed`, payload);
      return {
        id: response.data.id,
        url: `https://facebook.com/${response.data.id}`
      };
    } catch (error) {
      logger.error('Error creating Facebook page post:', error.message);
      throw error;
    }
  }

  /**
   * Get page comments
   */
  async getPageComments(postId, limit = 100) {
    try {
      const client = axios.create({
        baseURL: FACEBOOK_API_URL,
        params: {
          access_token: this.accessToken
        }
      });

      const response = await client.get(`/${postId}/comments?fields=id,from,message,created_time,type&limit=${limit}`);
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching page comments:', error.message);
      throw error;
    }
  }

  _buildCaption(text, hashtags = [], mentions = []) {
    let caption = text;
    if (hashtags && hashtags.length > 0) {
      caption += '\n\n' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    if (mentions && mentions.length > 0) {
      caption += '\n' + mentions.map(mention => `@${mention}`).join(' ');
    }
    return caption;
  }
}

/**
 * YouTube API Client
 */
class YouTubeAPI {
  constructor(apiKey, accessToken = null) {
    this.apiKey = apiKey;
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: YOUTUBE_API_URL,
      params: {
        key: apiKey
      }
    });
  }

  /**
   * Get channel info
   */
  async getChannelInfo(channelId) {
    try {
      const response = await this.client.get('/channels', {
        params: {
          part: 'snippet,statistics,contentDetails',
          id: channelId
        }
      });
      return response.data.items?.[0];
    } catch (error) {
      logger.error('Error fetching channel info:', error.message);
      throw error;
    }
  }

  /**
   * Upload a video (requires OAuth and upload token)
   */
  async uploadVideo(metadata, videoPath) {
    try {
      if (!this.accessToken) {
        throw new Error('Access token required for video upload');
      }

      const client = axios.create({
        baseURL: 'https://www.googleapis.com/upload/youtube/v3',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      // This would require actual file upload logic
      // For now, returning structure for integration
      logger.info('Video upload would be performed here with proper OAuth');

      return {
        videoId: 'mock-video-id',
        url: `https://youtube.com/watch?v=mock-video-id`
      };
    } catch (error) {
      logger.error('Error uploading video:', error.message);
      throw error;
    }
  }

  /**
   * Create a short
   */
  async createShort(metadata, videoPath) {
    try {
      return this.uploadVideo(metadata, videoPath);
    } catch (error) {
      logger.error('Error creating short:', error.message);
      throw error;
    }
  }

  /**
   * Get video statistics
   */
  async getVideoStats(videoId) {
    try {
      const response = await this.client.get('/videos', {
        params: {
          part: 'statistics,insights',
          id: videoId
        }
      });
      return response.data.items?.[0]?.statistics;
    } catch (error) {
      logger.error('Error fetching video stats:', error.message);
      throw error;
    }
  }

  /**
   * Search videos
   */
  async searchVideos(query, limit = 10) {
    try {
      const response = await this.client.get('/search', {
        params: {
          part: 'snippet',
          q: query,
          maxResults: limit,
          type: 'video'
        }
      });
      return response.data.items;
    } catch (error) {
      logger.error('Error searching videos:', error.message);
      throw error;
    }
  }

  /**
   * Get playlist items
   */
  async getPlaylistItems(playlistId) {
    try {
      const response = await this.client.get('/playlistItems', {
        params: {
          part: 'snippet',
          playlistId,
          maxResults: 50
        }
      });
      return response.data.items;
    } catch (error) {
      logger.error('Error fetching playlist items:', error.message);
      throw error;
    }
  }
}

/**
 * TikTok API Client
 */
class TikTokAPI {
  constructor(clientKey, clientSecret, accessToken = null) {
    this.clientKey = clientKey;
    this.clientSecret = clientSecret;
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: TIKTOK_API_URL,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  }

  /**
   * Get user info
   */
  async getUserInfo(userId) {
    try {
      const response = await this.client.get(`/user/info/${userId}`);
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching TikTok user info:', error.message);
      throw error;
    }
  }

  /**
   * Create a post (text with optional video)
   */
  async createPost(videoId, description, hashtags) {
    try {
      const fullDescription = this._buildCaption(description, hashtags);

      // TikTok requires actual video upload via their API
      // This is a structural example
      const response = await this.client.post('/video/publish/', {
        data: {
          video_id: videoId,
          description: fullDescription
        }
      });

      return {
        videoId: response.data.data.video_id,
        url: `https://tiktok.com/@user/video/${response.data.data.video_id}`
      };
    } catch (error) {
      logger.error('Error creating TikTok post:', error.message);
      throw error;
    }
  }

  /**
   * Get video metrics
   */
  async getVideoMetrics(videoId) {
    try {
      const response = await this.client.get(`/video/${videoId}/query/`, {
        params: {
          fields: 'like_count,comment_count,share_count,view_count,download_count,create_time'
        }
      });
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching TikTok video metrics:', error.message);
      throw error;
    }
  }

  /**
   * Get user videos
   */
  async getUserVideos(userId, limit = 30) {
    try {
      const response = await this.client.get(`/user/${userId}/video/list`, {
        params: {
          max_count: limit
        }
      });
      return response.data.data.videos;
    } catch (error) {
      logger.error('Error fetching user videos:', error.message);
      throw error;
    }
  }

  /**
   * Search hashtags
   */
  async searchHashtags(keyword) {
    try {
      const response = await this.client.get('/search/hashtag/info/', {
        params: {
          keyword
        }
      });
      return response.data.data;
    } catch (error) {
      logger.error('Error searching hashtags:', error.message);
      throw error;
    }
  }

  _buildCaption(text, hashtags = []) {
    let caption = text;
    if (hashtags && hashtags.length > 0) {
      caption += ' ' + hashtags.map(tag => `#${tag}`).join(' ');
    }
    return caption;
  }
}

/**
 * Factory function to get appropriate API client
 */
function getAPIClient(platform, credentials) {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return new FacebookInstagramAPI(credentials.accessToken);
    case 'facebook':
      return new FacebookInstagramAPI(credentials.accessToken);
    case 'youtube':
      return new YouTubeAPI(credentials.apiKey, credentials.accessToken);
    case 'tiktok':
      return new TikTokAPI(credentials.clientKey, credentials.clientSecret, credentials.accessToken);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

module.exports = {
  FacebookInstagramAPI,
  YouTubeAPI,
  TikTokAPI,
  getAPIClient
};
