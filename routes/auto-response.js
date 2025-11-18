const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');
const { getDatabase } = require('../lib/database');
const { validateAutoResponseRule } = require('../lib/validation');
const AIContentGenerator = require('../lib/ai-content-generator');

const aiGenerator = new AIContentGenerator();

/**
 * Get auto-response rules
 */
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const accountId = req.query.accountId;

    let query = 'SELECT * FROM auto_response_rules';
    const params = [];

    if (accountId) {
      query += ' WHERE account_id = ?';
      params.push(accountId);
    }

    query += ' ORDER BY created_at DESC';
    const rules = await db.all(query, params);

    res.json(rules);
  } catch (error) {
    logger.error('Error fetching auto-response rules:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single rule details
 */
router.get('/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const rule = await db.get(`
      SELECT * FROM auto_response_rules WHERE id = ?
    `, [req.params.id]);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    logger.error('Error fetching rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create auto-response rule
 */
router.post('/', async (req, res) => {
  try {
    const {
      accountId,
      platform,
      ruleName,
      triggerType,
      triggerKeywords,
      responseType,
      responseTemplate,
      aiContext,
      applyToComments,
      applyToDms,
      excludeFollowers,
      excludeKeywords,
      minAccountAgeDays,
      responseDelaySec
    } = req.body;

    // Create request object for validation
    const ruleData = {
      account_id: accountId,
      platform,
      rule_name: ruleName,
      trigger_type: triggerType,
      trigger_keywords: triggerKeywords,
      response_type: responseType,
      response_template: responseTemplate,
      response_delay_seconds: responseDelaySec,
      min_account_age_days: minAccountAgeDays
    };

    const errors = validateAutoResponseRule(ruleData);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const db = await getDatabase();

    // Check if account exists
    const account = await db.get('SELECT id FROM accounts WHERE id = ?', [accountId]);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const ruleId = uuidv4();

    await db.run(`
      INSERT INTO auto_response_rules
      (id, account_id, platform, rule_name, trigger_type, trigger_keywords, response_type,
       response_template, ai_context, apply_to_comments, apply_to_dms, exclude_followers,
       exclude_keywords, min_account_age_days, response_delay_seconds, is_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      ruleId, accountId, platform, ruleName, triggerType,
      JSON.stringify(triggerKeywords), responseType, responseTemplate, aiContext || null,
      applyToComments ? 1 : 0, applyToDms ? 1 : 0, excludeFollowers ? 1 : 0,
      JSON.stringify(excludeKeywords) || null, minAccountAgeDays || 0, responseDelaySec || 0
    ]);

    res.status(201).json({
      id: ruleId,
      message: 'Auto-response rule created successfully'
    });
  } catch (error) {
    logger.error('Error creating auto-response rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update auto-response rule
 */
router.patch('/:id', async (req, res) => {
  try {
    const {
      ruleName,
      responseTemplate,
      aiContext,
      isEnabled,
      applyToComments,
      applyToDms,
      responseDelaySec
    } = req.body;

    const db = await getDatabase();

    const rule = await db.get('SELECT id FROM auto_response_rules WHERE id = ?', [req.params.id]);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updates = [];
    const values = [];

    if (ruleName !== undefined) {
      updates.push('rule_name = ?');
      values.push(ruleName);
    }
    if (responseTemplate !== undefined) {
      updates.push('response_template = ?');
      values.push(responseTemplate);
    }
    if (aiContext !== undefined) {
      updates.push('ai_context = ?');
      values.push(aiContext);
    }
    if (isEnabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(isEnabled ? 1 : 0);
    }
    if (applyToComments !== undefined) {
      updates.push('apply_to_comments = ?');
      values.push(applyToComments ? 1 : 0);
    }
    if (applyToDms !== undefined) {
      updates.push('apply_to_dms = ?');
      values.push(applyToDms ? 1 : 0);
    }
    if (responseDelaySec !== undefined) {
      updates.push('response_delay_seconds = ?');
      values.push(responseDelaySec);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    await db.run(`
      UPDATE auto_response_rules
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    res.json({ success: true, message: 'Rule updated' });
  } catch (error) {
    logger.error('Error updating rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete auto-response rule
 */
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDatabase();

    const rule = await db.get('SELECT id FROM auto_response_rules WHERE id = ?', [req.params.id]);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await db.run('DELETE FROM auto_response_rules WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    logger.error('Error deleting rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get processed interactions
 */
router.get('/account/:accountId/interactions', async (req, res) => {
  try {
    const db = await getDatabase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const interactions = await db.all(`
      SELECT id, platform, interaction_type, from_user_name, content,
             auto_response_rule_id, response_sent, responded_at, created_at
      FROM processed_interactions
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [req.params.accountId, limit]);

    res.json(interactions);
  } catch (error) {
    logger.error('Error fetching interactions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate AI response
 */
router.post('/generate-response', async (req, res) => {
  try {
    const { commentContent, context = '', tone = 'friendly' } = req.body;

    if (!commentContent || commentContent.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const response = await aiGenerator.generateAutoResponse(commentContent, context, tone);

    res.json({
      generatedResponse: response
    });
  } catch (error) {
    logger.error('Error generating response:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test auto-response rule
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { testContent } = req.body;

    if (!testContent || testContent.trim().length === 0) {
      return res.status(400).json({ error: 'Test content is required' });
    }

    const db = await getDatabase();

    const rule = await db.get(`
      SELECT * FROM auto_response_rules WHERE id = ?
    `, [req.params.id]);

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Check if trigger conditions are met
    let triggers = false;

    if (rule.trigger_type === 'keyword') {
      const keywords = JSON.parse(rule.trigger_keywords || '[]');
      triggers = keywords.some(kw => testContent.toLowerCase().includes(kw.toLowerCase()));
    } else {
      triggers = true;
    }

    res.json({
      ruleId: req.params.id,
      ruleName: rule.rule_name,
      testContent,
      triggersRule: triggers,
      wouldRespond: triggers ? rule.response_template : null
    });
  } catch (error) {
    logger.error('Error testing rule:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get rule statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const db = await getDatabase();

    const rule = await db.get('SELECT * FROM auto_response_rules WHERE id = ?', [req.params.id]);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const stats = await db.get(`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(CASE WHEN responded_at IS NOT NULL THEN 1 END) as responded_count,
        COUNT(CASE WHEN date(responded_at) = date('now') THEN 1 END) as responses_today
      FROM processed_interactions
      WHERE auto_response_rule_id = ?
    `, [req.params.id]);

    res.json({
      rule: {
        id: rule.id,
        name: rule.rule_name,
        isEnabled: rule.is_enabled
      },
      stats
    });
  } catch (error) {
    logger.error('Error fetching rule stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
