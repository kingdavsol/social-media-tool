#!/usr/bin/env node

const { initializeDatabase } = require('../lib/database');
const logger = require('../lib/logger');

async function main() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
