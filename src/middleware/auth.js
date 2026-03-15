const jwt = require('jsonwebtoken');
const config = require('../config');

function auth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const bearer = req.headers.authorization;

  if (config.API_KEY && apiKey === config.API_KEY) {
    req.authenticated = true;
    return next();
  }

  // Token from Authorization header or from query param (needed for <img src="...?token=...">)
  const rawToken = (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null)
    || req.query.token;

  if (config.JWT_SECRET && rawToken) {
    try {
      jwt.verify(rawToken, config.JWT_SECRET);
      req.authenticated = true;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized: API Key or JWT required' });
}

module.exports = { auth };
