const sqlite3 = require('sqlite3').verbose();
const sqlite = require('sqlite');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

let db = null;

async function initializeDatabase() {
  try {
    const dbPath = process.env.DATABASE_PATH || './db.sqlite';

    db = await sqlite.open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');

    // Create tables
    await createTables();

    logger.info('Database initialized successfully');
    return db;
  } catch (error) {
    logger.error('Database initialization error:', error);
    throw error;
  }
}

async function createTables() {
  // Accounts table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK(platform IN ('facebook', 'instagram', 'youtube', 'tiktok')),
      account_name TEXT NOT NULL,
      account_handle TEXT UNIQUE NOT NULL,
      account_id TEXT UNIQUE NOT NULL,
      profile_picture_url TEXT,
      followers_count INTEGER DEFAULT 0,
      is_connected BOOLEAN DEFAULT 1,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at DATETIME,
      oauth_scopes TEXT,
      metadata JSON,
      last_sync DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Scheduled Posts table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL,
      post_type TEXT NOT NULL CHECK(post_type IN ('text', 'image', 'video', 'carousel', 'reel', 'story', 'short')),
      media_urls TEXT,
      hashtags TEXT,
      mentions TEXT,
      scheduled_time DATETIME NOT NULL,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'queued', 'posting', 'posted', 'failed', 'cancelled')),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      posted_at DATETIME,
      error_message TEXT
    )
  `);

  // Post-Account Mapping (many-to-many)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_post_accounts (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'posted', 'failed')),
      post_url TEXT,
      platform_post_id TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      posted_at DATETIME,
      FOREIGN KEY (post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(post_id, account_id)
    )
  `);

  // Posted Content History
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posted_content (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_post_id TEXT UNIQUE,
      post_url TEXT,
      content TEXT,
      media_urls TEXT,
      post_type TEXT,
      posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES scheduled_posts(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Engagement Data
  await db.exec(`
    CREATE TABLE IF NOT EXISTS engagement_data (
      id TEXT PRIMARY KEY,
      posted_content_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (posted_content_id) REFERENCES posted_content(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Analytics Daily Summary
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_daily (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      date DATE NOT NULL,
      new_followers INTEGER DEFAULT 0,
      total_followers INTEGER DEFAULT 0,
      posts_published INTEGER DEFAULT 0,
      total_engagement INTEGER DEFAULT 0,
      total_reach INTEGER DEFAULT 0,
      total_impressions INTEGER DEFAULT 0,
      avg_engagement_rate REAL DEFAULT 0,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, platform, date)
    )
  `);

  // Auto-Response Rules
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auto_response_rules (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('comment', 'dm', 'mention', 'keyword')),
      trigger_keywords TEXT,
      response_type TEXT NOT NULL CHECK(response_type IN ('text', 'template', 'ai_generated')),
      response_template TEXT NOT NULL,
      ai_context TEXT,
      is_enabled BOOLEAN DEFAULT 1,
      apply_to_comments BOOLEAN DEFAULT 1,
      apply_to_dms BOOLEAN DEFAULT 1,
      exclude_followers BOOLEAN DEFAULT 0,
      exclude_keywords TEXT,
      min_account_age_days INTEGER DEFAULT 0,
      response_delay_seconds INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Processed Interactions (for tracking what we've responded to)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS processed_interactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      interaction_id TEXT NOT NULL,
      interaction_type TEXT NOT NULL CHECK(interaction_type IN ('comment', 'dm', 'mention')),
      from_user_id TEXT,
      from_user_name TEXT,
      content TEXT,
      auto_response_rule_id TEXT,
      response_sent TEXT,
      responded_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (auto_response_rule_id) REFERENCES auto_response_rules(id) ON DELETE SET NULL
    )
  `);

  // Content Templates
  await db.exec(`
    CREATE TABLE IF NOT EXISTS content_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT,
      category TEXT,
      template_content TEXT NOT NULL,
      hashtag_template TEXT,
      post_type TEXT,
      media_suggestions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Video Queue
  await db.exec(`
    CREATE TABLE IF NOT EXISTS video_queue (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      platform TEXT NOT NULL,
      video_title TEXT,
      video_description TEXT,
      video_source TEXT NOT NULL CHECK(video_source IN ('veed', 'google', 'upload', 'generated')),
      source_url TEXT,
      output_formats TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      output_video_url TEXT,
      output_thumbnail_url TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE
    )
  `);

  // Generated Thumbnails
  await db.exec(`
    CREATE TABLE IF NOT EXISTS thumbnails (
      id TEXT PRIMARY KEY,
      posted_content_id TEXT,
      video_queue_id TEXT,
      thumbnail_url TEXT NOT NULL,
      thumbnail_style TEXT,
      auto_generated BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (posted_content_id) REFERENCES posted_content(id) ON DELETE CASCADE,
      FOREIGN KEY (video_queue_id) REFERENCES video_queue(id) ON DELETE CASCADE
    )
  `);

  // Generated Content (captions, tags, descriptions)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      account_id TEXT,
      platform TEXT,
      content_type TEXT NOT NULL CHECK(content_type IN ('caption', 'hashtags', 'description', 'title', 'tags')),
      original_content TEXT,
      generated_content TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES scheduled_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // User Preferences & Settings
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      preference_key TEXT UNIQUE NOT NULL,
      preference_value TEXT,
      data_type TEXT DEFAULT 'string',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Content Calendar
  await db.exec(`
    CREATE TABLE IF NOT EXISTS content_calendar (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      platform TEXT,
      event_date DATE NOT NULL,
      event_title TEXT NOT NULL,
      event_description TEXT,
      suggested_post_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API Tokens (encrypted)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      token_prefix TEXT NOT NULL,
      account_id TEXT,
      created_by TEXT,
      last_used DATETIME,
      expires_at DATETIME,
      scopes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Hashtag Performance
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hashtag_performance (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      hashtag TEXT NOT NULL,
      uses_count INTEGER DEFAULT 0,
      avg_reach INTEGER DEFAULT 0,
      avg_engagement INTEGER DEFAULT 0,
      trending BOOLEAN DEFAULT 0,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform, hashtag)
    )
  `);

  // Account Growth Tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS account_growth (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      date DATE NOT NULL,
      followers_count INTEGER,
      engagement_rate REAL,
      reach INTEGER,
      impressions INTEGER,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, platform, date)
    )
  `);

  // Create indices for better query performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_accounts_platform ON accounts(platform);
    CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
    CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_time ON scheduled_posts(scheduled_time);
    CREATE INDEX IF NOT EXISTS idx_posted_content_account_platform ON posted_content(account_id, platform);
    CREATE INDEX IF NOT EXISTS idx_engagement_data_account ON engagement_data(account_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
    CREATE INDEX IF NOT EXISTS idx_interactions_account ON processed_interactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_video_queue_status ON video_queue(status);
    CREATE INDEX IF NOT EXISTS idx_generated_content_type ON generated_content(content_type);
  `);

  logger.info('All database tables created successfully');
}

async function getDatabase() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  createTables
};
