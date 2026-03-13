const express = require('express');
const ContactRequest = require('../models/ContactRequest');

const router = express.Router();

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Envoyer un message de contact
 *     tags: [Contact]
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
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Message reçu
 *       400:
 *         description: Email requis
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requis' });
    }
    const contact = new ContactRequest({ name, email, subject, message });
    await contact.save();
    return res.json({ message: 'Message bien reçu, nous vous répondrons rapidement.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
