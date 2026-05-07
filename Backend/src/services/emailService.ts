import nodemailer from 'nodemailer';

import { authConfig } from '../config/authConfig.js';

interface TemporaryPasswordEmailArgs {
  email: string;
  name: string;
  roleLabel: string;
  temporaryPassword: string;
}

type EmailMode = 'smtp' | 'log';
type EmailModeReason = 'smtp_enabled' | 'log_only_enabled' | 'smtp_not_configured';

function isPlaceholderSecret(value: string | undefined): boolean {
  return String(value || '').trim() === 'REPLACE_WITH_GMAIL_APP_PASSWORD';
}

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

function getEmailMode(): { mode: EmailMode; reason: EmailModeReason } {
  if (authConfig.smtpHost && !authConfig.emailLogOnly) {
    return { mode: 'smtp', reason: 'smtp_enabled' };
  }

  if (authConfig.emailLogOnly) {
    return { mode: 'log', reason: 'log_only_enabled' };
  }

  return { mode: 'log', reason: 'smtp_not_configured' };
}

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      getEmailMode().mode === 'smtp'
        ? nodemailer.createTransport({
          host: authConfig.smtpHost,
          port: authConfig.smtpPort,
          secure: authConfig.smtpSecure,
          auth: authConfig.smtpUser
            ? {
              user: authConfig.smtpUser,
              pass: authConfig.smtpPassword || '',
            }
            : undefined,
        })
        : nodemailer.createTransport({
          jsonTransport: true,
        }),
    );
  }

  return transporterPromise;
}

function buildHtmlEmail({ name, roleLabel, temporaryPassword }: TemporaryPasswordEmailArgs): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin-bottom: 16px;">Your BERSn account is ready</h2>
      <p>Hello ${name},</p>
      <p>An administrator created your BERSn account with the role <strong>${roleLabel}</strong>.</p>
      <p>Your temporary password is:</p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 0.08em;">${temporaryPassword}</p>
      <p>Please sign in and change this password immediately. Your first login requires a password reset before you can continue.</p>
      <p>If you were not expecting this account, please contact your system administrator right away.</p>
    </div>
  `.trim();
}

function buildTextEmail({ name, roleLabel, temporaryPassword }: TemporaryPasswordEmailArgs): string {
  return [
    `Hello ${name},`,
    '',
    `An administrator created your BERSn account with the role ${roleLabel}.`,
    '',
    `Temporary password: ${temporaryPassword}`,
    '',
    'Please sign in and change this password immediately. Your first login requires a password reset before you can continue.',
    '',
    'If you were not expecting this account, please contact your system administrator right away.',
  ].join('\n');
}

export async function sendTemporaryPasswordEmail(
  args: TemporaryPasswordEmailArgs,
): Promise<{ mode: EmailMode; reason: EmailModeReason }> {
  if (!authConfig.emailFrom) {
    throw new Error('AUTH_EMAIL_FROM must be configured before sending account emails.');
  }

  const emailMode = getEmailMode();

  if (process.env.NODE_ENV === 'production' && emailMode.mode !== 'smtp') {
    throw new Error('SMTP email delivery must be configured in production.');
  }

  if (emailMode.mode === 'smtp' && authConfig.smtpUser && isPlaceholderSecret(authConfig.smtpPassword)) {
    throw new Error('AUTH_SMTP_PASSWORD is still using the placeholder value. Replace it with a real Gmail App Password and restart the backend.');
  }

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: authConfig.emailFrom,
    to: args.email,
    subject: 'Your BERSn temporary password',
    text: buildTextEmail(args),
    html: buildHtmlEmail(args),
  });

  if (emailMode.mode === 'log') {
    const preview = typeof info.message === 'string' ? info.message : JSON.stringify(info, null, 2);
    console.log(`[email] Email delivery mode is "${emailMode.mode}" (${emailMode.reason}). Temporary password email payload follows.`);
    console.log(preview);
  }

  return {
    mode: emailMode.mode,
    reason: emailMode.reason,
  };
}
