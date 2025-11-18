const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('./logger');
const { delay } = require('./helpers');

const VEED_API_KEY = process.env.VEED_API_KEY;
const VEED_API_URL = 'https://api.veed.io/v1';
const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY;

// FFmpeg setup
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Video and Media Generation Service
 */
class VideoMediaGenerator {
  constructor() {
    this.veedApiKey = VEED_API_KEY;
    this.googleApiKey = GOOGLE_API_KEY;
    this.tempDir = path.join(process.cwd(), 'temp');
    this._ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  _ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Create video using Veed.io API
   */
  async createVideoWithVeed(videoTitle, videoDescription, mediaItems, options = {}) {
    try {
      if (!this.veedApiKey) {
        throw new Error('Veed.io API key not configured');
      }

      const client = axios.create({
        baseURL: VEED_API_URL,
        headers: {
          'Authorization': `Bearer ${this.veedApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Create project
      const projectResponse = await client.post('/projects', {
        title: videoTitle,
        type: 'video'
      });

      const projectId = projectResponse.data.id;
      logger.info(`Created Veed project: ${projectId}`);

      // Upload media items
      const uploadedItems = [];
      for (const item of mediaItems) {
        const uploadResponse = await client.post(`/projects/${projectId}/assets`, {
          url: item.url,
          type: item.type // 'image' or 'video'
        });
        uploadedItems.push(uploadResponse.data);
        await delay(500); // Rate limiting
      }

      // Create timeline/sequence
      const sequenceResponse = await client.post(`/projects/${projectId}/sequences`, {
        name: 'main_sequence',
        assets: uploadedItems.map(item => ({
          id: item.id,
          duration: item.duration || 3000 // 3 seconds per item
        }))
      });

      const sequenceId = sequenceResponse.data.id;

      // Add captions if provided
      if (options.addCaptions) {
        await client.post(`/projects/${projectId}/sequences/${sequenceId}/captions`, {
          text: videoDescription,
          language: options.language || 'en',
          auto_generate: true
        });
      }

      // Add music if provided
      if (options.musicUrl) {
        await client.post(`/projects/${projectId}/sequences/${sequenceId}/audio`, {
          url: options.musicUrl,
          type: 'background_music'
        });
      }

      // Export video
      const exportResponse = await client.post(`/projects/${projectId}/export`, {
        format: options.format || 'mp4',
        resolution: options.resolution || '1080p',
        quality: options.quality || 'high'
      });

      const exportId = exportResponse.data.id;

      // Poll for completion
      let exportData = null;
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes with 10s intervals

      while (attempts < maxAttempts) {
        await delay(10000); // Wait 10 seconds

        const statusResponse = await client.get(`/projects/${projectId}/exports/${exportId}`);
        if (statusResponse.data.status === 'completed') {
          exportData = statusResponse.data;
          break;
        } else if (statusResponse.data.status === 'failed') {
          throw new Error(`Video export failed: ${statusResponse.data.error}`);
        }

        attempts++;
      }

      if (!exportData) {
        throw new Error('Video export timed out');
      }

      logger.info(`Veed video created successfully: ${exportData.download_url}`);

      return {
        videoUrl: exportData.download_url,
        projectId,
        platform: 'veed'
      };
    } catch (error) {
      logger.error('Error creating video with Veed:', error.message);
      throw error;
    }
  }

  /**
   * Generate thumbnail image
   */
  async generateThumbnail(videoPath, options = {}) {
    try {
      const format = options.format || 'png';
      const width = options.width || 1280;
      const height = options.height || 720;
      const overlayText = options.text || '';
      const backgroundColor = options.backgroundColor || '#000000';

      const outputPath = path.join(this.tempDir, `thumbnail_${Date.now()}.${format}`);

      // Extract frame from video
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .screenshots({
            timestamps: ['5%'],
            filename: path.basename(outputPath),
            folder: this.tempDir,
            size: `${width}x${height}`
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Load image and apply customizations
      let image = await Jimp.read(outputPath);
      image.resize(width, height);

      // Add overlay text if provided
      if (overlayText) {
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
        image.print(font, 20, 20, overlayText, width - 40);
      }

      // Save final thumbnail
      const finalPath = path.join(this.tempDir, `thumbnail_final_${Date.now()}.${format}`);
      await image.write(finalPath);

      return {
        thumbnailPath: finalPath,
        url: `file://${finalPath}`,
        width,
        height
      };
    } catch (error) {
      logger.error('Error generating thumbnail:', error.message);
      throw error;
    }
  }

  /**
   * Create AI-generated thumbnail using Jimp
   */
  async generateAIThumbnail(title, options = {}) {
    try {
      const width = options.width || 1280;
      const height = options.height || 720;
      const backgroundColor = options.backgroundColor || '#FF0000';
      const textColor = options.textColor || '#FFFFFF';

      // Create new image
      const image = new Jimp(width, height, backgroundColor);

      // Add main title
      const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const titleY = height / 2 - 50;
      image.print(font32, 40, titleY, title, width - 80);

      // Add timestamp/badge if provided
      if (options.badge) {
        const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        image.print(font16, width - 150, 20, options.badge);
      }

      const outputPath = path.join(this.tempDir, `ai_thumbnail_${Date.now()}.png`);
      await image.write(outputPath);

      return {
        thumbnailPath: outputPath,
        url: `file://${outputPath}`,
        width,
        height,
        generated: true
      };
    } catch (error) {
      logger.error('Error generating AI thumbnail:', error.message);
      throw error;
    }
  }

  /**
   * Add captions/subtitles to video
   */
  async addCaptions(videoPath, captions, options = {}) {
    try {
      const outputPath = path.join(this.tempDir, `captioned_${Date.now()}.mp4`);

      // Create subtitle file (VTT format)
      const vttPath = path.join(this.tempDir, `subtitles_${Date.now()}.vtt`);
      const vttContent = this._generateVTTContent(captions);
      fs.writeFileSync(vttPath, vttContent);

      // Use FFmpeg to add subtitles
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .videoFilter(`subtitles=${vttPath}:force_style='FontSize=${options.fontSize || 24},FontName=${options.fontName || 'Arial'}'`)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      return {
        videoPath: outputPath,
        captionsPath: vttPath
      };
    } catch (error) {
      logger.error('Error adding captions:', error.message);
      throw error;
    }
  }

  /**
   * Generate VTT subtitle content
   */
  _generateVTTContent(captions) {
    let vttContent = 'WEBVTT\n\n';

    captions.forEach(caption => {
      vttContent += `${this._formatTimestamp(caption.start)} --> ${this._formatTimestamp(caption.end)}\n`;
      vttContent += `${caption.text}\n\n`;
    });

    return vttContent;
  }

  /**
   * Format timestamp for VTT
   */
  _formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  /**
   * Create video collage from multiple images
   */
  async createCollage(imageUrls, options = {}) {
    try {
      const images = await Promise.all(
        imageUrls.map(url => Jimp.read(url))
      );

      const cols = options.cols || 2;
      const rows = Math.ceil(images.length / cols);
      const itemWidth = options.itemWidth || 640;
      const itemHeight = options.itemHeight || 640;

      const canvasWidth = itemWidth * cols;
      const canvasHeight = itemHeight * rows;

      // Create canvas
      const collage = new Jimp(canvasWidth, canvasHeight, 0xffffffff);

      // Place images
      let index = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (index < images.length) {
            const image = images[index].resize(itemWidth, itemHeight);
            collage.composite(image, col * itemWidth, row * itemHeight);
            index++;
          }
        }
      }

      const outputPath = path.join(this.tempDir, `collage_${Date.now()}.png`);
      await collage.write(outputPath);

      return {
        collageUrl: `file://${outputPath}`,
        width: canvasWidth,
        height: canvasHeight
      };
    } catch (error) {
      logger.error('Error creating collage:', error.message);
      throw error;
    }
  }

  /**
   * Compress video for different platforms
   */
  async compressVideo(videoPath, platform, options = {}) {
    try {
      const platformSettings = {
        instagram: { width: 1080, height: 1350, bitrate: '2000k', fps: 30 },
        tiktok: { width: 1080, height: 1920, bitrate: '1500k', fps: 30 },
        youtube: { width: 1920, height: 1080, bitrate: '4000k', fps: 30 },
        facebook: { width: 1200, height: 628, bitrate: '2500k', fps: 30 }
      };

      const settings = platformSettings[platform] || platformSettings.instagram;
      const outputPath = path.join(this.tempDir, `compressed_${platform}_${Date.now()}.mp4`);

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .size(`${settings.width}x${settings.height}`)
          .fps(settings.fps)
          .videoBitrate(settings.bitrate)
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      return {
        videoPath: outputPath,
        platform,
        settings
      };
    } catch (error) {
      logger.error('Error compressing video:', error.message);
      throw error;
    }
  }

  /**
   * Extract metadata from video
   */
  async getVideoMetadata(videoPath) {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) reject(err);
          else resolve({
            duration: metadata.format.duration,
            bitrate: metadata.format.bit_rate,
            size: metadata.format.size,
            codec: metadata.streams[0]?.codec_name,
            width: metadata.streams[0]?.width,
            height: metadata.streams[0]?.height,
            fps: metadata.streams[0]?.r_frame_rate
          });
        });
      });
    } catch (error) {
      logger.error('Error getting video metadata:', error.message);
      throw error;
    }
  }

  /**
   * Cleanup temp files
   */
  cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        // Only delete files older than 1 hour
        const stats = fs.statSync(filePath);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        if (ageHours > 1) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up temp file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp files:', error.message);
    }
  }
}

module.exports = VideoMediaGenerator;
