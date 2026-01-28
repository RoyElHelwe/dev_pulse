# Email Configuration Guide

The application now uses **Nodemailer** with SMTP for sending emails, which allows you to send emails to any email address in development (unlike Resend which restricts you to verified domains/emails).

## Quick Setup

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy the generated 16-character password

3. **Update your `.env` file**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   EMAIL_FROM=FT Transcendence <your-email@gmail.com>
   ```

### Option 2: Mailtrap (For Testing)

Mailtrap is a fake SMTP server perfect for development/testing. Emails won't actually be delivered but you can view them in Mailtrap's inbox.

1. Sign up at https://mailtrap.io (free tier available)
2. Get your SMTP credentials from the dashboard
3. Update your `.env` file:
   ```env
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_SECURE=false
   SMTP_USER=your-mailtrap-username
   SMTP_PASS=your-mailtrap-password
   EMAIL_FROM=FT Transcendence <noreply@example.com>
   ```

### Option 3: Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
EMAIL_FROM=FT Transcendence <your-email@outlook.com>
```

### Option 4: Custom SMTP Server

```env
SMTP_HOST=smtp.yourserver.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM=FT Transcendence <noreply@yourserver.com>
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` (TLS) or `465` (SSL) |
| `SMTP_SECURE` | Use SSL/TLS | `true` for port 465, `false` for 587 |
| `SMTP_USER` | SMTP username (usually email) | `your-email@gmail.com` |
| `SMTP_PASS` | SMTP password or app password | Your app password |
| `EMAIL_FROM` | Sender email address | `FT Transcendence <noreply@example.com>` |

## Applying Changes

After updating your `.env` file:

```bash
# Restart the services
docker compose down
docker compose up -d

# Or restart specific services
docker compose restart auth-service workspace-service
```

## Testing

1. Create a workspace invitation to any email address
2. Check the recipient's inbox (or Mailtrap inbox if using Mailtrap)
3. The invitation email should arrive successfully

## Common Issues

### Gmail: "Less secure app access" error
- Solution: Use App Passwords instead (requires 2FA enabled)

### Port 587 blocked by ISP
- Solution: Try port 465 with `SMTP_SECURE=true`

### Authentication failed
- Double-check your credentials
- Make sure you're using App Password for Gmail (not your regular password)
- Verify 2FA is enabled for Gmail

### Emails not arriving
- Check spam folder
- Verify SMTP credentials are correct
- Check Docker logs: `docker compose logs workspace-service`

## Production Recommendations

For production, consider using:
- **SendGrid** (12,000 free emails/month)
- **Amazon SES** (62,000 free emails/month for 12 months)
- **Mailgun** (5,000 free emails/month)
- **Postmark** (100 free emails/month)

These services provide better deliverability, analytics, and dedicated IP addresses.

## Security Notes

⚠️ **Never commit your `.env` file with real credentials to version control!**

- Keep `.env` in `.gitignore` (already configured)
- Use different credentials for development and production
- Rotate credentials regularly
- Use environment variables in production (GitHub Secrets, AWS Secrets Manager, etc.)
