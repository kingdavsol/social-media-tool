#!/usr/bin/env node

const crypto = require('crypto');
const { generateToken, hash } = require('../lib/encryption');

function generateApiKey() {
  const token = generateToken(32);
  const keyPrefix = 'sk_' + token.substring(0, 8);
  const keyHash = hash(keyPrefix + token);

  console.log('\n✅ New API Key Generated\n');
  console.log('📋 Full Key (Store Securely):');
  console.log(`   ${keyPrefix}_${token.substring(8, 16)}\n`);
  console.log('🔐 Key Hash (Store in Database):');
  console.log(`   ${keyHash}\n`);
  console.log('⚠️  Keep your API key secure. Do not share it!\n');

  return { fullKey: keyPrefix + token, keyHash };
}

if (require.main === module) {
  generateApiKey();
}

module.exports = { generateApiKey };
