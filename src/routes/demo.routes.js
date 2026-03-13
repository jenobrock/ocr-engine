const express = require('express');
const DemoRequest = require('../models/DemoRequest');

const router = express.Router();

/**
 * @swagger
 * /api/demo:
 *   post:
 *     summary: Demander une démo personnalisée
 *     tags: [Demo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               name:    { type: string }
 *               email:   { type: string }
 *               company: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Demande enregistrée
 *       400:
 *         description: Email requis
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, company, message } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requis' });
    }
    const demo = new DemoRequest({ name, email, company, message });
    await demo.save();
    return res.json({ message: 'Demande enregistrée ! Nous vous contacterons sous 24h.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
