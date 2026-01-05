import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY!;
    this.resend = new Resend(apiKey);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: {
    to: string;
    resetUrl: string;
  }) {
    const { to, resetUrl } = data;

    try {
      const result = await this.resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: [to],
        subject: 'Reset Your Password',
        html: this.getPasswordResetEmailTemplate({ resetUrl }),
      });

      return result;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Get password reset email template
   */
  private getPasswordResetEmailTemplate(data: {
    resetUrl: string;
  }): string {
    const { resetUrl } = data;

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
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <h1>🚀 FT Transcendence</h1>
            </div>
            
            <h1>Reset Your Password</h1>
            
            <p>Hello!</p>
            
            <p>
              We received a request to reset the password for your account.
              Click the button below to create a new password:
            </p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link in your browser:<br>
              <a href="${resetUrl}" class="link">${resetUrl}</a>
            </p>
            
            <div class="warning">
              <p style="margin: 0; font-size: 14px;">
                ⚠️ This link will expire in 1 hour. If you didn't request a password reset,
                please ignore this email and your password will remain unchanged.
              </p>
            </div>
            
            <div class="footer">
              <p>
                This email was sent by FT Transcendence.<br>
                If you have any questions, please contact support.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
