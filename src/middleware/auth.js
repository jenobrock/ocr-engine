const jwt = require('jsonwebtoken');
const config = require('../config');

function auth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const bearer = req.headers.authorization;

  if (config.API_KEY && apiKey === config.API_KEY) {
    req.authenticated = true;
    return next();
  }

  if (config.JWT_SECRET && bearer && bearer.startsWith('Bearer ')) {
    const token = bearer.slice(7);
    try {
      jwt.verify(token, config.JWT_SECRET);
      req.authenticated = true;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized: API Key or JWT required' });
}

module.exports = { auth };
