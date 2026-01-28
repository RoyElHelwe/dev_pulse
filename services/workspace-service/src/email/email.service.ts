import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor() {
    // Create transporter based on environment
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment) {
      // For development: Use any SMTP server or Gmail
      // You can configure this with your own SMTP credentials
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // For production: Use your production SMTP service
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(data: {
    to: string;
    workspaceName: string;
    inviterName?: string;
    inviteUrl: string;
  }) {
    const { to, workspaceName, inviterName, inviteUrl } = data;

    try {
      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"FT Transcendence" <noreply@fttranscendence.com>',
        to,
        subject: `You've been invited to join ${workspaceName}`,
        html: this.getInvitationEmailTemplate({
          workspaceName,
          inviterName,
          inviteUrl,
        }),
      });

      return result;
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't throw error - invitation should still be created even if email fails
      return null;
    }
  }

  /**
   * Get invitation email template
   */
  private getInvitationEmailTemplate(data: {
    workspaceName: string;
    inviterName?: string;
    inviteUrl: string;
  }): string {
    const { workspaceName, inviterName, inviteUrl } = data;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .logo {
              text-align: center;
              margin-bottom: 30px;
            }
            h1 {
              color: #1a1a1a;
              font-size: 24px;
              margin-bottom: 20px;
            }
            p {
              margin-bottom: 15px;
              color: #555;
            }
            .button {
              display: inline-block;
              background: #0066cc;
              color: #ffffff;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
            }
            .button:hover {
              background: #0052a3;
            }
            .workspace-name {
              font-weight: 600;
              color: #0066cc;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #999;
              text-align: center;
            }
            .link {
              color: #0066cc;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🚀 FT Transcendence</h1>
            </div>
            
            <h1>You're invited to join a workspace!</h1>
            
            <p>Hello!</p>
            
            <p>
              ${inviterName ? `<strong>${inviterName}</strong> has invited you to join` : 'You have been invited to join'}
              the <span class="workspace-name">${workspaceName}</span> workspace on FT Transcendence.
            </p>
            
            <p>
              FT Transcendence is a collaborative workspace platform where teams can work together in a virtual 2D office environment.
            </p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link in your browser:<br>
              <a href="${inviteUrl}" class="link">${inviteUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #666;">
              This invitation will expire in 7 days.
            </p>
            
            <div class="footer">
              <p>
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
              <p>
                © ${new Date().getFullYear()} FT Transcendence. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
