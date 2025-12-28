# 🔐 Security Guide - ft_transcendence

This document outlines the security measures implemented in ft_transcendence and best practices for maintaining a secure application.

---

## 🛡️ Security Architecture

### Defense in Depth

We implement multiple layers of security to protect against various threats:

```
┌─────────────────────────────────────────┐
│  Layer 1: Network Security              │
│  - HTTPS/TLS                            │
│  - Rate Limiting                        │
│  - DDoS Protection                      │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 2: Application Security          │
│  - Input Validation                     │
│  - Output Encoding                      │
│  - CSRF Protection                      │
│  - Secure Headers                       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 3: Authentication & Authorization│
│  - Password Hashing                     │
│  - 2FA/OTP                             │
│  - Session Management                   │
│  - RBAC                                 │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Layer 4: Data Security                 │
│  - Encryption at Rest                   │
│  - Encryption in Transit                │
│  - Audit Logging                        │
└─────────────────────────────────────────┘
```

---

## 🔑 Authentication Security

### Password Security

**Hashing Algorithm**: bcrypt with cost factor 12

```typescript
// Password hashing
const hashedPassword = await bcrypt.hash(password, 12)

// Password verification
const isValid = await bcrypt.compare(password, hashedPassword)
```

**Password Requirements**:

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- No common passwords (checked against dictionary)

### Two-Factor Authentication (2FA)

**TOTP (Time-based One-Time Password)**:

- Uses RFC 6238 standard
- 30-second time window
- 6-digit codes
- QR code generation for easy setup

**Recovery Codes**:

- 10 single-use recovery codes
- Hashed before storage
- Can be regenerated

### OTP (One-Time Password) for Email Verification

- 6-digit random code
- 10-minute expiry
- Stored in Redis with TTL
- Rate limited (max 3 requests per 15 minutes)

### Session Management

**Cookie-based Sessions**:

```typescript
{
  httpOnly: true,      // Prevents XSS attacks
  secure: true,        // HTTPS only
  sameSite: 'strict',  // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

**Session Storage**: Redis for fast access and automatic expiry

**Device Tracking**:

- IP address
- User agent
- Device name (optional)
- Last activity timestamp

**Session Revocation**:

- Users can view all active sessions
- Revoke individual sessions
- "Logout all devices" option

---

## 🔒 Authorization (RBAC)

### Roles Hierarchy

```
Owner (5)
  └─ Full control over workspace
     └─ Admin (4)
        └─ Manage users, settings
           └─ Manager (3)
              └─ Create tasks, manage sprints
                 └─ Member (2)
                    └─ Work on tasks
                       └─ Viewer (1)
                          └─ Read-only access
```

### Permission Checks

```typescript
// Example permission check
if (userRole < REQUIRED_ROLE) {
  throw new ForbiddenException('Insufficient permissions')
}
```

---

## 🛡️ Input Validation

### Zod Schemas

All user inputs are validated using Zod schemas:

```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  name: z.string().min(2),
})
```

### SQL Injection Prevention

- **Prisma ORM**: Parameterized queries prevent SQL injection
- Never use raw SQL with user input
- If raw SQL is necessary, use parameterized queries

### XSS Prevention

- **Output Encoding**: All user-generated content is escaped
- **Content Security Policy (CSP)**: Restricts script sources
- **DOMPurify**: Sanitize HTML if rich text is needed

---

## 🚫 CSRF Protection

### Token-based Protection

```typescript
// CSRF token in forms
<input type="hidden" name="_csrf" value={csrfToken} />

// Verify on server
if (req.body._csrf !== req.session.csrfToken) {
  throw new ForbiddenException('Invalid CSRF token')
}
```

### SameSite Cookies

All cookies use `sameSite: 'strict'` to prevent CSRF attacks.

---

## 🚦 Rate Limiting

### Limits by Endpoint

| Endpoint           | Window | Max Requests |
| ------------------ | ------ | ------------ |
| Login              | 15 min | 5            |
| Register           | 1 hour | 3            |
| OTP Request        | 15 min | 3            |
| API Calls          | 15 min | 100          |
| WebSocket Messages | 1 sec  | 10           |

### Implementation

```typescript
// Redis-based rate limiting
const key = `ratelimit:${ip}:${endpoint}`
const count = await redis.incr(key)
if (count === 1) {
  await redis.expire(key, windowSeconds)
}
if (count > maxRequests) {
  throw new TooManyRequestsException()
}
```

---

## 🔐 Secure Headers

### Helmet.js Configuration

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
)
```

### Headers Set

- `Strict-Transport-Security`: Force HTTPS
- `X-Content-Type-Options`: Prevent MIME sniffing
- `X-Frame-Options`: Prevent clickjacking
- `X-XSS-Protection`: Enable XSS filter
- `Content-Security-Policy`: Restrict resource loading

---

## 📝 Audit Logging

### What We Log

```typescript
interface AuditLog {
  userId: string
  action: string // e.g., "user.login", "task.created"
  entityType: string // e.g., "user", "task"
  entityId: string
  metadata: object // Additional context
  ipAddress: string
  timestamp: Date
}
```

### Logged Actions

- Authentication events (login, logout, 2FA setup)
- Authorization failures
- Data modifications (create, update, delete)
- Permission changes
- Sensitive operations (password reset, session revocation)

### Log Retention

- **Development**: 30 days
- **Production**: 90 days minimum (compliance dependent)

---

## 🔐 Data Encryption

### At Rest

- **Database**: PostgreSQL with encryption enabled
- **Sensitive Fields**: Additional encryption for:
  - 2FA secrets
  - Recovery codes
  - OAuth tokens

### In Transit

- **TLS 1.3**: All communication over HTTPS
- **WebSocket**: WSS (WebSocket Secure)
- **Internal Services**: mTLS for service-to-service communication (production)

---

## 🚨 Threat Model

### Identified Threats

1. **Brute Force Attacks**
   - Mitigation: Rate limiting, account lockout, 2FA

2. **Session Hijacking**
   - Mitigation: Secure cookies, HTTPS only, device tracking

3. **XSS (Cross-Site Scripting)**
   - Mitigation: Output encoding, CSP, DOMPurify

4. **CSRF (Cross-Site Request Forgery)**
   - Mitigation: CSRF tokens, SameSite cookies

5. **SQL Injection**
   - Mitigation: Prisma ORM, parameterized queries

6. **Man-in-the-Middle**
   - Mitigation: HTTPS/TLS, HSTS

7. **Privilege Escalation**
   - Mitigation: RBAC, permission checks, audit logging

8. **Data Leakage**
   - Mitigation: Encryption, access controls, audit logs

---

## ✅ Security Checklist

### Development

- [ ] All user inputs validated with Zod
- [ ] No sensitive data in logs
- [ ] Secrets in environment variables, not code
- [ ] Dependencies regularly updated
- [ ] Code reviewed for security issues

### Deployment

- [ ] HTTPS enabled
- [ ] Secure headers configured
- [ ] Rate limiting enabled
- [ ] Database encryption enabled
- [ ] Secrets rotated
- [ ] Audit logging enabled
- [ ] Backups configured

### Ongoing

- [ ] Monitor audit logs for suspicious activity
- [ ] Review and rotate secrets quarterly
- [ ] Update dependencies monthly
- [ ] Security testing (penetration tests)
- [ ] Incident response plan in place

---

## 🔧 Security Configuration

### Environment Variables

**Never commit these**:

- `JWT_SECRET`
- `SESSION_SECRET`
- `DATABASE_URL`
- `OAUTH_CLIENT_SECRET`
- `SMTP_PASSWORD`

**Generate Secrets**:

```bash
# Generate strong random secrets
openssl rand -base64 32
```

### Production Checklist

1. **Enable HTTPS**: Use Let's Encrypt or cloud provider SSL
2. **Set NODE_ENV=production**: Disables debug features
3. **Rotate Secrets**: Use different secrets than development
4. **Enable Database Encryption**: Configure PostgreSQL encryption
5. **Configure Firewall**: Only allow necessary ports
6. **Set up Monitoring**: Alert on suspicious activity
7. **Regular Backups**: Automated daily backups

---

## 🐛 Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email: security@ft-transcendence.local
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours.

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Security is everyone's responsibility. Stay vigilant! 🛡️**
