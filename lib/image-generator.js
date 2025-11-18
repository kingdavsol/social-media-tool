const axios = require('axios');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Ad Image Generation and Optimization Service
 */
class AdImageGenerator {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'ad_images');
    this._ensureTempDir();
  }

  _ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate ad image with text overlay
   */
  async generateAdImageWithText(imageUrl, headlineText, ctaText, options = {}) {
    try {
      // Download base image
      const image = await Jimp.read(imageUrl);

      // Resize based on platform
      const dimensions = this._getPlatformDimensions(options.platform || 'instagram');
      image.resize(dimensions.width, dimensions.height);

      // Add semi-transparent overlay
      const overlay = new Jimp(dimensions.width, dimensions.height, 0x00000080); // Black 50% opacity
      image.composite(overlay, 0, 0);

      // Add headline text
      const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const headlineY = Math.floor(dimensions.height / 2) - 50;
      image.print(font32, 20, headlineY, headlineText, dimensions.width - 40);

      // Add CTA
      const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      const ctaY = Math.floor(dimensions.height * 0.85);
      image.print(font16, 20, ctaY, ctaText, dimensions.width - 40);

      // Save image
      const outputPath = path.join(this.tempDir, `ad_${uuidv4()}.png`);
      await image.write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        generated: true
      };
    } catch (error) {
      logger.error('Error generating ad image with text:', error);
      throw error;
    }
  }

  /**
   * Generate ad banner image
   */
  async generateAdBanner(productName, headline, backgroundColor = '#667eea', options = {}) {
    try {
      const dimensions = this._getPlatformDimensions(options.platform || 'facebook');
      const bgColor = parseInt(backgroundColor.replace('#', '0x'));

      // Create new image with background color
      const image = new Jimp(dimensions.width, dimensions.height, bgColor);

      // Add main heading
      const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const headlineY = Math.floor(dimensions.height / 3);
      image.print(font32, 40, headlineY, headline, dimensions.width - 80);

      // Add product name
      const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      const productY = Math.floor(dimensions.height * 0.7);
      image.print(font16, 40, productY, productName, dimensions.width - 80);

      // Save image
      const outputPath = path.join(this.tempDir, `banner_${uuidv4()}.png`);
      await image.write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        generated: true
      };
    } catch (error) {
      logger.error('Error generating ad banner:', error);
      throw error;
    }
  }

  /**
   * Optimize image for specific platform
   */
  async optimizeImageForPlatform(imagePath, platform) {
    try {
      const image = await Jimp.read(imagePath);
      const dimensions = this._getPlatformDimensions(platform);

      // Resize to platform dimensions
      image.resize(dimensions.width, dimensions.height);

      // Enhance colors slightly
      image.brighten(0.05);
      image.contrast(0.1);

      // Compress quality for file size
      const outputPath = path.join(this.tempDir, `optimized_${uuidv4()}.jpg`);
      await image.quality(85).write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        platform,
        optimized: true
      };
    } catch (error) {
      logger.error('Error optimizing image:', error);
      throw error;
    }
  }

  /**
   * Create carousel/collection ad images
   */
  async createCarouselImages(imageUrls, titles, ctaTexts, options = {}) {
    try {
      const carouselImages = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const carouselImage = await this.generateAdImageWithText(
          imageUrls[i],
          titles[i] || `Item ${i + 1}`,
          ctaTexts[i] || 'Learn More',
          options
        );
        carouselImages.push(carouselImage);
      }

      return carouselImages;
    } catch (error) {
      logger.error('Error creating carousel images:', error);
      throw error;
    }
  }

  /**
   * Generate product showcase image
   */
  async generateProductShowcaseImage(productImageUrl, productName, price, discount = null, options = {}) {
    try {
      const image = await Jimp.read(productImageUrl);
      const dimensions = this._getPlatformDimensions(options.platform || 'instagram');
      image.resize(dimensions.width, dimensions.height);

      // Add white background for text
      const textBg = new Jimp(dimensions.width, 200, 0xffffffff);
      image.composite(textBg, 0, dimensions.height - 200);

      // Add product name
      const font24 = await Jimp.loadFont(Jimp.FONT_SANS_24_BLACK);
      image.print(font24, 20, dimensions.height - 160, productName, dimensions.width - 40);

      // Add price
      const font20 = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      image.print(font20, 20, dimensions.height - 100, `$${price}`, dimensions.width - 40);

      // Add discount badge if applicable
      if (discount) {
        const discountColor = 0xff4444ff; // Red
        const badge = new Jimp(120, 60, discountColor);
        const font14 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        badge.print(font14, 10, 15, `Save ${discount}%`);
        image.composite(badge, dimensions.width - 140, 20);
      }

      const outputPath = path.join(this.tempDir, `showcase_${uuidv4()}.png`);
      await image.write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        generated: true
      };
    } catch (error) {
      logger.error('Error generating product showcase:', error);
      throw error;
    }
  }

  /**
   * Create comparison/before-after image
   */
  async createComparisonImage(beforeImageUrl, afterImageUrl, beforeLabel = 'Before', afterLabel = 'After') {
    try {
      const beforeImg = await Jimp.read(beforeImageUrl);
      const afterImg = await Jimp.read(afterImageUrl);

      // Resize to square
      const size = 400;
      beforeImg.resize(size, size);
      afterImg.resize(size, size);

      // Create canvas
      const canvas = new Jimp(size * 2 + 20, size + 80, 0xffffffff);

      // Add before image
      canvas.composite(beforeImg, 0, 40);

      // Add after image
      canvas.composite(afterImg, size + 20, 40);

      // Add labels
      const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      canvas.print(font16, 150, 10, beforeLabel);
      canvas.print(font16, size + 100, 10, afterLabel);

      const outputPath = path.join(this.tempDir, `comparison_${uuidv4()}.png`);
      await canvas.write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        generated: true
      };
    } catch (error) {
      logger.error('Error creating comparison image:', error);
      throw error;
    }
  }

  /**
   * Add watermark/logo to image
   */
  async addWatermark(imagePath, watermarkPath, position = 'bottom-right') {
    try {
      const image = await Jimp.read(imagePath);
      const watermark = await Jimp.read(watermarkPath);

      // Resize watermark to 15% of image width
      const watermarkSize = Math.floor(image.bitmap.width * 0.15);
      watermark.resize(watermarkSize, Jimp.AUTO);

      // Calculate position
      const positions = {
        'top-left': { x: 10, y: 10 },
        'top-right': { x: image.bitmap.width - watermarkSize - 10, y: 10 },
        'bottom-left': { x: 10, y: image.bitmap.height - watermark.bitmap.height - 10 },
        'bottom-right': { x: image.bitmap.width - watermarkSize - 10, y: image.bitmap.height - watermark.bitmap.height - 10 },
        'center': { x: Math.floor((image.bitmap.width - watermarkSize) / 2), y: Math.floor((image.bitmap.height - watermark.bitmap.height) / 2) }
      };

      const pos = positions[position] || positions['bottom-right'];

      // Apply watermark with some transparency
      watermark.opacity(0.5);
      image.composite(watermark, pos.x, pos.y);

      const outputPath = path.join(this.tempDir, `watermarked_${uuidv4()}.png`);
      await image.write(outputPath);

      return {
        imageUrl: `file://${outputPath}`,
        path: outputPath,
        watermarked: true
      };
    } catch (error) {
      logger.error('Error adding watermark:', error);
      throw error;
    }
  }

  /**
   * Get platform-specific image dimensions
   */
  _getPlatformDimensions(platform) {
    const dimensions = {
      facebook: { width: 1200, height: 628 },
      instagram: { width: 1080, height: 1080 },
      instagram_story: { width: 1080, height: 1920 },
      google: { width: 1200, height: 628 },
      tiktok: { width: 1080, height: 1920 },
      youtube: { width: 1280, height: 720 },
      linkedin: { width: 1200, height: 627 },
      twitter: { width: 1024, height: 512 }
    };
    return dimensions[platform] || dimensions.instagram;
  }

  /**
   * Get recommended image specs for platform
   */
  getImageSpecs(platform) {
    const specs = {
      facebook: {
        width: 1200,
        height: 628,
        format: 'jpg',
        maxSize: 4,
        aspectRatio: '1.91:1'
      },
      instagram: {
        width: 1080,
        height: 1080,
        format: 'jpg',
        maxSize: 8,
        aspectRatio: '1:1'
      },
      instagram_story: {
        width: 1080,
        height: 1920,
        format: 'jpg',
        maxSize: 8,
        aspectRatio: '9:16'
      },
      google: {
        width: 300,
        height: 250,
        format: 'jpg',
        maxSize: 500,
        aspectRatio: '6:5'
      },
      tiktok: {
        width: 1080,
        height: 1920,
        format: 'mp4',
        maxSize: 287,
        aspectRatio: '9:16'
      },
      youtube: {
        width: 1280,
        height: 720,
        format: 'jpg',
        maxSize: 2,
        aspectRatio: '16:9'
      }
    };
    return specs[platform] || specs.instagram;
  }

  /**
   * Cleanup old generated images
   */
  cleanupOldImages() {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

        // Delete files older than 24 hours
        if (ageHours > 24) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up old image: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning up images:', error);
    }
  }
}

module.exports = new AdImageGenerator();
