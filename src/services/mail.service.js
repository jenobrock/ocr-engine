const sgMail = require('@sendgrid/mail');
const config = require('../config');

if (config.SENDGRID_API_KEY) {
  sgMail.setApiKey(config.SENDGRID_API_KEY);
} else {
  console.warn('[Mail] SENDGRID_API_KEY not set — emails will be skipped');
}

const FROM = { email: config.SENDER_EMAIL || 'noreply@seed-connect.info', name: 'Seed Flow' };

// ── Helpers ────────────────────────────────────────────────────────────────

function emailHeader(title) {
  return `
    <div style="background:linear-gradient(135deg,#833AB4 0%,#FD1D1D 100%);padding:36px 40px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <p style="font-family:'Georgia',serif;font-size:26px;font-weight:700;font-style:italic;color:#fff;margin:0 0 6px;letter-spacing:-0.5px;">
        Seed Flow
      </p>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.7);margin:0;letter-spacing:0.06em;text-transform:uppercase;">
        ${title}
      </p>
    </div>`;
}

function emailFooter() {
  return `
    <div style="background:#f5f5f5;padding:24px 40px;border-radius:0 0 12px 12px;text-align:center;border-top:1px solid #e8e8e8;">
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#999;margin:0 0 4px;">
        © 2025 Seed Flow — <a href="https://www.seed-connect.com" style="color:#833AB4;text-decoration:none;">Seed Connect</a>
      </p>
      <p style="font-family:Arial,sans-serif;font-size:11px;color:#bbb;margin:0;">
        Si vous n'avez pas effectué cette action, ignorez cet email.
      </p>
    </div>`;
}

function emailWrapper(content) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);" cellpadding="0" cellspacing="0">
        <tr><td>${content}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Emails ─────────────────────────────────────────────────────────────────

async function sendWelcomeEmail(to, name) {
  if (!config.SENDGRID_API_KEY) return;

  const displayName = name ? name.split(' ')[0] : 'là';

  const html = emailWrapper(`
    ${emailHeader('Bienvenue 🎉')}
    <div style="padding:36px 40px;">
      <h1 style="font-family:'Georgia',serif;font-size:22px;font-style:italic;color:#0f0f0f;margin:0 0 16px;">
        Bienvenue ${displayName} !
      </h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
        Votre compte <strong>Seed Flow</strong> est prêt. Vous bénéficiez de
        <strong>100 pages gratuites par mois</strong> pour transformer vos documents en données exploitables.
      </p>
      <div style="background:#f8f4ff;border-radius:8px;padding:20px;margin-bottom:28px;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#666;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Ce que vous pouvez faire maintenant</p>
        <ul style="font-family:Arial,sans-serif;font-size:14px;color:#444;margin:0;padding-left:20px;line-height:2;">
          <li>Importer vos premiers documents PDF ou images</li>
          <li>Extraire automatiquement texte et tableaux</li>
          <li>Exporter en Excel, CSV ou base SQL</li>
        </ul>
      </div>
      <a href="${config.APP_URL}/upload"
         style="display:inline-block;background:linear-gradient(135deg,#833AB4,#FD1D1D);color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;box-shadow:0 4px 16px rgba(131,58,180,0.35);">
        Commencer maintenant →
      </a>
      <p style="font-family:Arial,sans-serif;font-size:13px;color:#999;margin:28px 0 0;">
        Une question ? Répondez à cet email ou contactez-nous sur
        <a href="https://www.seed-connect.com" style="color:#833AB4;text-decoration:none;">seed-connect.com</a>
      </p>
    </div>
    ${emailFooter()}`);

  await sgMail.send({
    to,
    from: FROM,
    subject: '🎉 Bienvenue sur Seed Flow — votre compte est prêt',
    html,
  });
}

async function sendPasswordResetEmail(to, resetUrl) {
  if (!config.SENDGRID_API_KEY) return;

  const html = emailWrapper(`
    ${emailHeader('Réinitialisation du mot de passe')}
    <div style="padding:36px 40px;">
      <h1 style="font-family:'Georgia',serif;font-size:22px;font-style:italic;color:#0f0f0f;margin:0 0 16px;">
        Réinitialiser votre mot de passe
      </h1>
      <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 8px;">
        Vous avez demandé à réinitialiser le mot de passe de votre compte <strong>Seed Flow</strong>.
      </p>
      <p style="font-family:Arial,sans-serif;font-size:15px;color:#444;line-height:1.7;margin:0 0 28px;">
        Cliquez sur le bouton ci-dessous. Ce lien expire dans <strong>1 heure</strong>.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#833AB4,#FD1D1D);color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;box-shadow:0 4px 16px rgba(131,58,180,0.35);">
        Réinitialiser mon mot de passe →
      </a>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#aaa;margin:20px 0 0;word-break:break-all;">
        Ou copiez ce lien dans votre navigateur :<br>
        <a href="${resetUrl}" style="color:#833AB4;">${resetUrl}</a>
      </p>
      <div style="margin-top:28px;padding:16px;background:#fff8f8;border-left:3px solid #FD1D1D;border-radius:4px;">
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#888;margin:0;">
          ⚠️ Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
        </p>
      </div>
    </div>
    ${emailFooter()}`);

  await sgMail.send({
    to,
    from: FROM,
    subject: 'Réinitialisez votre mot de passe Seed Flow',
    html,
  });
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
