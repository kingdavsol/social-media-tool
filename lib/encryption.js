const crypto = require('crypto');
const logger = require('./logger');

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-12';

// Ensure key is correct length (32 bytes for AES-256)
function getEncryptionKey() {
  const key = ENCRYPTION_KEY;
  if (key.length < 32) {
    return crypto
      .createHash('sha256')
      .update(key)
      .digest();
  }
  return key.substring(0, 32);
}

/**
 * Encrypt sensitive data (API tokens, credentials)
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text with IV prepended
 */
function encrypt(text) {
  try {
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Return IV + encrypted data as hex string
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV prepended
 * @returns {string} Decrypted text
 */
function decrypt(encryptedText) {
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash a value (for API keys, passwords)
 * @param {string} text - Text to hash
 * @returns {string} SHA256 hash
 */
function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes
 * @returns {string} Random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate encrypted token
 * @param {string} token - Token to validate
 * @param {string} hash - Hash to compare against
 * @returns {boolean} Whether token matches hash
 */
function validateToken(token, tokenHash) {
  const computedHash = hash(token);
  return computedHash === tokenHash;
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateToken,
  validateToken
};
