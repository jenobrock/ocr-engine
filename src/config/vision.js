const { ImageAnnotatorClient } = require('@google-cloud/vision');
const config = require('./index');

let client = null;

function getVisionClient() {
  if (!config.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('GOOGLE_APPLICATION_CREDENTIALS not set - Vision API will fail');
  }
  if (!client) {
    client = new ImageAnnotatorClient();
  }
  return client;
}

module.exports = { getVisionClient };
