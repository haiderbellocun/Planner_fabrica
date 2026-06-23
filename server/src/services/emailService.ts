import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface TaskEmailData {
  assigneeName: string;
  projectName: string;
  taskTitle: string;
  dueDate?: string | null;
  taskLink?: string;
  isReassignment?: boolean;
}

export function buildTaskAssignedHtml(data: TaskEmailData): string {
  const { assigneeName, projectName, taskTitle, dueDate, taskLink, isReassignment } = data;

  const dueDateRow = dueDate
    ? `<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">
         📅 Vence el <strong style="color:#374151;">${new Date(dueDate.slice(0,10)+'T00:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'})}</strong>
       </p>`
    : '';

  const ctaButton = taskLink
    ? `<table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
         <tr>
           <td style="background:#0DD9D0;border-radius:8px;">
             <a href="${taskLink}"
                style="display:inline-block;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;font-family:Arial,sans-serif;">
               Ver mis tareas →
             </a>
           </td>
         </tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0BBFB7;border-radius:14px 14px 0 0;padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Planner Fábrica</p>
                  <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">
                    ${isReassignment ? 'Tarea reasignada' : 'Nueva tarea asignada'}
                  </h1>
                </td>
                <td align="right">
                  <img src="https://storage.googleapis.com/it-fab-contenido-edu-1-planner-web/Logo_coordinador_de_fabrica.png"
                       alt="Planner Fábrica"
                       width="72" height="72"
                       style="display:block;border-radius:50%;background:rgba(255,255,255,0.15);" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
            <p style="margin:0 0 4px;color:#64748b;font-size:14px;">Hola,</p>
            <h2 style="margin:0 0 20px;color:#0f172a;font-size:20px;font-weight:700;">${assigneeName}</h2>

            <p style="margin:0 0 6px;color:#475569;font-size:15px;">
              Se te ha asignado una tarea en el proyecto:
            </p>
            <p style="margin:0 0 24px;color:#0BBFB7;font-size:15px;font-weight:700;">${projectName}</p>

            <!-- Task card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #0DD9D0;border-radius:0 10px 10px 0;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;">${taskTitle}</p>
                  ${dueDateRow}
                </td>
              </tr>
            </table>

            ${ctaButton}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:18px 36px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Planner Fábrica &nbsp;·&nbsp; Sealab &nbsp;·&nbsp; CUN<br>
              <span style="font-size:11px;">Este correo fue enviado automáticamente, no respondas a este mensaje.</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

