const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const ocrRoutes = require('./routes/ocr.routes');
const aiCleaningRoutes = require('./routes/ai-cleaning.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'SeedScan OCR Engine API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    components: {
      securitySchemes: {
        ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        Bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      security: [{ ApiKey: [] }, { Bearer: [] }],
    },
  },
  apis: ['./src/routes/*.js'],
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/ocr', ocrRoutes);
app.use('/api/ai-cleaning', aiCleaningRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
