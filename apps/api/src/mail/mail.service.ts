import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { AppConfig } from '../config/app-config';

export interface MailContent {
  subject: string;
  /** Short paragraphs of plain text. */
  lines: string[];
  action?: { label: string; url: string };
  footer?: string;
}

/**
 * The only place that sends email. Without SMTP settings (local dev) the
 * message, including its link, is printed in the api logs instead.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;

  constructor(private readonly config: AppConfig) {
    const smtp = config.smtp;
    this.transport = smtp
      ? createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
        })
      : null;
  }

  /** Never throws: a failed email must not break the request that sent it. */
  async send(to: string, content: MailContent): Promise<void> {
    if (!this.transport) {
      this.logger.log(
        `Email to ${to} (SMTP not configured, printed instead)\n` +
          `  Subject: ${content.subject}\n` +
          content.lines.map((l) => `  ${l}`).join('\n') +
          (content.action ? `\n  ${content.action.label}: ${content.action.url}` : ''),
      );
      return;
    }
    try {
      await this.transport.sendMail({
        from: this.config.emailFrom,
        to,
        subject: content.subject,
        text: [...content.lines, content.action && `${content.action.label}: ${content.action.url}`, content.footer]
          .filter(Boolean)
          .join('\n\n'),
        html: renderHtml(content),
      });
    } catch (error) {
      this.logger.error(`Could not send "${content.subject}" to ${to}: ${(error as Error).message}`);
    }
  }
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function renderHtml({ subject, lines, action, footer }: MailContent) {
  const button = action
    ? `<p style="margin:28px 0"><a href="${escape(action.url)}" style="background:#18181b;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${escape(action.label)}</a></p>
       <p style="color:#71717a;font-size:13px">Or paste this link in your browser:<br><span style="word-break:break-all">${escape(action.url)}</span></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e4e4e7">
    <p style="font-weight:700;margin:0 0 24px">Dev Pulse</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escape(subject)}</h1>
    ${lines.map((l) => `<p style="line-height:1.6;margin:0 0 12px">${escape(l)}</p>`).join('')}
    ${button}
    ${footer ? `<p style="color:#71717a;font-size:13px;margin-top:24px">${escape(footer)}</p>` : ''}
  </div></body></html>`;
}
