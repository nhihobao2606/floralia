const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const User = require('../models/user');

const TOKEN_TTL_MS = 60 * 60 * 1000;

function createMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('SMTP password-reset email settings are incomplete.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

function getResetUrl(token) {
  const baseUrl = (process.env.CLIENT_URL || 'http://localhost:4200').replace(/\/+$/, '');
  const resetUrl = new URL('/reset-password', `${baseUrl}/`);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

async function requestPasswordReset(email) {
  const mailer = createMailer();
  const user = await User.findByEmail(email);
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  const updated = await User.setPasswordResetToken(email, tokenHash, expiresAt);
  if (updated.matchedCount !== 1) return;

  const resetUrl = getResetUrl(token);
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Đặt lại mật khẩu Floralia',
      text: `Bạn vừa yêu cầu đặt lại mật khẩu Floralia. Mở liên kết sau trong vòng 1 giờ: ${resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu Floralia.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });
  } catch (error) {
    await User.clearPasswordResetToken(tokenHash);
    throw error;
  }
}

async function resetPassword(token, password) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await User.updatePasswordWithResetToken(tokenHash, new Date(), hashedPassword);
  return result.matchedCount === 1;
}

module.exports = { requestPasswordReset, resetPassword };
