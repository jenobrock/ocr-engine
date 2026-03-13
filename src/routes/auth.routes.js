const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/mail.service');

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

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error('[Mail] Welcome email failed:', err.message);
    });

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

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return the same response to avoid user enumeration
    if (!user) {
      return res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
    }

    const rawToken = user.createResetToken();
    await user.save({ validateBeforeSave: false });

    const origin = req.headers.origin || 'http://localhost:4200';
    const resetUrl = `${origin}/reset-password?token=${rawToken}`;

    // Send email via SendGrid
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl)
      .then(() => true)
      .catch((err) => {
        console.error('[Mail] Reset email failed:', err.message);
        return false;
      });

    // In dev mode (no SendGrid), still return the token so it can be tested
    const isDev = config.NODE_ENV !== 'production' && !config.SENDGRID_API_KEY;
    if (isDev) {
      console.log(`[Auth/Dev] Reset link for ${user.email}: ${resetUrl}`);
    }

    res.json({
      message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.',
      ...(isDev && { resetToken: rawToken }),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Token and new password required (min 6 characters)' });
    }
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ error: 'Token is invalid or has expired' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const jwtToken = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      message: 'Password updated successfully',
      token: jwtToken,
      user: { id: user._id.toString(), email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
