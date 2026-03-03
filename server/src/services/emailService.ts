import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const hasSmtpConfig =
  !!env.SMTP_HOST &&
  !!env.SMTP_PORT &&
  !!env.SMTP_USER &&
  !!env.SMTP_PASS;

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

export async function sendTaskAssignedEmail(options: SendEmailOptions): Promise<void> {
  if (!hasSmtpConfig || !transporter) {
    if (env.NODE_ENV !== 'production') {
      console.log('[emailService] SMTP config not set, skipping email send');
    }
    return;
  }

  const from = env.SMTP_FROM || env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (env.NODE_ENV !== 'production') {
      console.log('[emailService] Email sent to', options.to);
    }
  } catch (error) {
    console.error('[emailService] Error sending email:', error);
  }
}

