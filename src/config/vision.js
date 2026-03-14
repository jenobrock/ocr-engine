const fs = require('fs');
const config = require('./index');

let client = null;

function getVisionClient() {
  const credPath = config.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credPath) {
    const err = new Error(
      'GOOGLE_APPLICATION_CREDENTIALS non défini dans .env'
    );
    err.code = 'VISION_NOT_CONFIGURED';
    throw err;
  }

  if (!fs.existsSync(credPath)) {
    const err = new Error(
      `Fichier de credentials introuvable : ${credPath}`
    );
    err.code = 'VISION_NOT_CONFIGURED';
    throw err;
  }

  if (!client) {
    console.log('[Vision] Initialisation client avec :', credPath);
    const { ImageAnnotatorClient } = require('@google-cloud/vision');
    client = new ImageAnnotatorClient({ keyFilename: credPath });
  }

  return client;
}

// Reset client (utile si credentials changent)
function resetVisionClient() {
  client = null;
}

module.exports = { getVisionClient, resetVisionClient };
