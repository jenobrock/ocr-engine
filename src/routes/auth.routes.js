const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');

const router = express.Router();

if (!config.JWT_SECRET) {
  console.warn('JWT_SECRET not set: signup/login will be disabled');
}

router.post('/signup', async (req, res, next) => {
  try {
    if (!config.JWT_SECRET) {
      return res.status(503).json({ error: 'Auth not configured' });
    }
    const { email, password, name } = req.body || {};
    if (!email || !password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Email and password required (min 6 characters)' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const user = new User({
      email: email.toLowerCase().trim(),
      password: password,
      name: (name || '').trim(),
    });
    await user.save();
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    if (!config.JWT_SECRET) {
      return res.status(503).json({ error: 'Auth not configured' });
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
