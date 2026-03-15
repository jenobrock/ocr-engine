const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  sharp = null;
  console.warn('[Image] sharp not installed — zone cropping disabled. Run: npm install sharp');
}

/**
 * Return a PNG buffer suitable for display and zone cropping.
 * - Images  : resized to max 1400px wide (kept sharp for detail)
 * - PDFs    : first page converted with pdftoppm (requires poppler-utils)
 *
 * @param {string} filePath
 * @param {string} mimeType
 * @returns {Promise<Buffer>}
 */
async function getPreviewBuffer(filePath, mimeType) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable : ${filePath}`);
  }

  if (mimeType === 'application/pdf') {
    return pdfToImage(filePath);
  }

  const buf = await fsp.readFile(filePath);

  if (sharp) {
    return sharp(buf)
      .resize({ width: 1400, withoutEnlargement: true })
      .png()
      .toBuffer();
  }

  return buf;
}

/**
 * Convert first page of a PDF to PNG using pdftoppm (poppler-utils).
 * @param {string} filePath
 * @returns {Promise<Buffer>}
 */
function pdfToImage(filePath) {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const outPrefix = path.join(
      tmpDir,
      `preview_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    execFile(
      'pdftoppm',
      ['-r', '150', '-png', '-singlefile', filePath, outPrefix],
      (err) => {
        if (err) {
          reject(
            new Error(
              `pdftoppm échoué : ${err.message}. ` +
              `Installez poppler-utils : sudo apt-get install -y poppler-utils`
            )
          );
          return;
        }

        const outFile = `${outPrefix}.png`;
        if (!fs.existsSync(outFile)) {
          reject(new Error('La conversion PDF → image n\'a produit aucun fichier.'));
          return;
        }

        const buf = fs.readFileSync(outFile);
        try { fs.unlinkSync(outFile); } catch (_) {}
        resolve(buf);
      }
    );
  });
}

/**
 * Crop a rectangular zone from an image buffer.
 * Coordinates are expressed as ratios (0.0 – 1.0) relative to image dimensions.
 *
 * @param {Buffer} imageBuffer  PNG or JPEG buffer
 * @param {{ x: number, y: number, w: number, h: number }} zone
 * @returns {Promise<Buffer>} PNG buffer of the cropped zone
 */
async function cropZone(imageBuffer, zone) {
  if (!sharp) {
    throw new Error('sharp n\'est pas installé. Exécutez : npm install sharp');
  }

  const meta = await sharp(imageBuffer).metadata();
  const imgW = meta.width;
  const imgH = meta.height;

  const rawLeft   = Math.round(zone.x * imgW);
  const rawTop    = Math.round(zone.y * imgH);
  const rawWidth  = Math.max(1, Math.round(zone.w * imgW));
  const rawHeight = Math.max(1, Math.round(zone.h * imgH));

  // Clamp to image bounds
  const left   = Math.max(0, Math.min(rawLeft,  imgW - 2));
  const top    = Math.max(0, Math.min(rawTop,   imgH - 2));
  const width  = Math.min(rawWidth,  imgW - left);
  const height = Math.min(rawHeight, imgH - top);

  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

module.exports = { getPreviewBuffer, cropZone };
