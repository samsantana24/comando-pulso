const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const ISSUER = 'Comando Pulso';

function generateSecret(email) {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${ISSUER}:${email}`,
    issuer: ISSUER,
  });
  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url,
  };
}

async function generateQRCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
}

function verifyToken(base32Secret, token) {
  if (!base32Secret || !token) return false;
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: String(token).replace(/\s+/g, ''),
    window: 1,
  });
}

module.exports = { generateSecret, generateQRCodeDataUrl, verifyToken };
