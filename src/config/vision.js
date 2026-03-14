const config = require('./index');

let client = null;

function getVisionClient() {
  if (!config.GOOGLE_APPLICATION_CREDENTIALS) {
    const err = new Error(
      'Google Cloud Vision non configuré. Ajoutez GOOGLE_APPLICATION_CREDENTIALS dans votre .env'
    );
    err.code = 'VISION_NOT_CONFIGURED';
    throw err;
  }

  if (!client) {
    const { ImageAnnotatorClient } = require('@google-cloud/vision');
    client = new ImageAnnotatorClient({
      keyFilename: config.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return client;
}

module.exports = { getVisionClient };
