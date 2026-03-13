const express = require('express');
const Newsletter = require('../models/Newsletter');

const router = express.Router();

/**
 * @swagger
 * /api/newsletter:
 *   post:
 *     summary: S'abonner à la newsletter
 *     tags: [Newsletter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Inscription réussie
 *       409:
 *         description: Email déjà inscrit
 */
router.post('/', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requis' });
    }
    const existing = await Newsletter.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà inscrit à la newsletter.' });
    }
    const sub = new Newsletter({ email });
    await sub.save();
    return res.json({ message: 'Vous êtes maintenant inscrit à la newsletter !' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
