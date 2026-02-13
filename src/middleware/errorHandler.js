function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
