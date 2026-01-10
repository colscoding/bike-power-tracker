# Security Hardening Plan

## Overview

This plan addresses security concerns identified in the codebase and proposes enhancements to strengthen the application's security posture for production environments.

## Current State Assessment

### Strengths
- Input validation with Zod schemas
- Input sanitization (null byte removal)
- Stream name pattern restriction (`/^[a-zA-Z0-9_-]+$/`)
- Rate limiting with express-rate-limit
- CORS configuration
- Helmet for security headers
- API key authentication (optional)
- Request body size limits

### Issues Identified

1. **Authentication disabled by default** - Should require explicit opt-out
2. **CORS allows wildcard origins** - Production warning but doesn't fail
3. **No HTTPS enforcement** - Application doesn't force secure connections
4. **Missing CSRF protection** - No token-based protection
5. **No request signing** - Could use HMAC for integrity
6. **Rate limiting not granular** - Same limits for all endpoints
7. **Secrets in environment variables** - No validation or rotation support

---

## Implementation Plan

### Phase 1: Authentication Hardening

**Priority: CRITICAL**

#### 1.1 Require explicit auth configuration

**File: `packages/service/src/config/security.ts`**

```typescript
export interface SecurityConfig {
  authEnabled: boolean;
  authRequired: boolean;
  apiKeys: string[];
  jwtSecret?: string;
  nodeEnv: string;
}

function validateSecurityConfig(): SecurityConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const authEnabled = process.env.AUTH_ENABLED !== 'false';
  const authRequired = nodeEnv === 'production';

  // In production, authentication MUST be explicitly configured
  if (authRequired && !authEnabled) {
    throw new Error(
      'SECURITY ERROR: Authentication is disabled in production. ' +
      'Set AUTH_ENABLED=true or explicitly set AUTH_ENABLED=false ' +
      'with ALLOW_INSECURE_PRODUCTION=true to proceed (NOT RECOMMENDED).'
    );
  }

  const allowInsecure = process.env.ALLOW_INSECURE_PRODUCTION === 'true';
  if (authRequired && !authEnabled && !allowInsecure) {
    throw new Error('Authentication required in production');
  }

  // Parse API keys
  const apiKeysRaw = process.env.API_KEYS || '';
  const apiKeys = apiKeysRaw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  // Validate API key strength
  if (authEnabled && apiKeys.length > 0) {
    for (const key of apiKeys) {
      if (key.length < 32) {
        console.warn(
          `WARNING: API key is less than 32 characters. Consider using stronger keys.`
        );
      }
    }
  }

  // JWT secret validation
  const jwtSecret = process.env.JWT_SECRET;
  if (authEnabled && jwtSecret && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  return {
    authEnabled,
    authRequired,
    apiKeys,
    jwtSecret,
    nodeEnv,
  };
}

export const securityConfig = validateSecurityConfig();
```

#### 1.2 Enhanced API key authentication

**File: `packages/service/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { securityConfig } from '../config/security.js';
import { AuthError } from '../errors.js';
import { logger } from '../logger.js';

interface AuthOptions {
  allowPublicRead?: boolean;
  requireSignature?: boolean;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validate HMAC signature for request integrity
 */
function validateSignature(
  req: Request,
  apiKey: string,
  signature: string
): boolean {
  const timestamp = req.get('X-Timestamp');
  if (!timestamp) return false;

  // Check timestamp freshness (5 minute window)
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return false;
  }

  // Create signature from request details
  const signatureBase = [
    req.method,
    req.path,
    timestamp,
    JSON.stringify(req.body || {}),
  ].join('\n');

  const expectedSignature = createHmac('sha256', apiKey)
    .update(signatureBase)
    .digest('hex');

  return secureCompare(signature, expectedSignature);
}

export function createAuthMiddleware(options: AuthOptions = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth if disabled
    if (!securityConfig.authEnabled) {
      return next();
    }

    // Allow public read if configured
    if (options.allowPublicRead && req.method === 'GET') {
      return next();
    }

    // Extract API key from header or query
    const apiKey =
      req.get('X-API-Key') ||
      req.get('Authorization')?.replace('Bearer ', '') ||
      (req.query.apiKey as string);

    if (!apiKey) {
      logger.warn({ ip: req.ip, path: req.path }, 'Missing API key');
      throw new AuthError('API key required');
    }

    // Validate API key using constant-time comparison
    const isValidKey = securityConfig.apiKeys.some((key) =>
      secureCompare(key, apiKey)
    );

    if (!isValidKey) {
      logger.warn({ ip: req.ip, path: req.path }, 'Invalid API key');
      throw new AuthError('Invalid API key');
    }

    // Validate signature if required
    if (options.requireSignature) {
      const signature = req.get('X-Signature');
      if (!signature) {
        throw new AuthError('Request signature required');
      }

      if (!validateSignature(req, apiKey, signature)) {
        logger.warn(
          { ip: req.ip, path: req.path },
          'Invalid request signature'
        );
        throw new AuthError('Invalid request signature');
      }
    }

    // Attach auth info to request
    (req as Request & { auth?: { apiKey: string } }).auth = {
      apiKey: apiKey.slice(0, 8) + '...', // Truncated for logging
    };

    next();
  };
}
```

---

### Phase 2: CORS Hardening

**Priority: HIGH**

#### 2.1 Strict CORS configuration

**File: `packages/service/src/config/cors.ts`**

```typescript
import { CorsOptions } from 'cors';
import { logger } from '../logger.js';

function parseAllowedOrigins(): string[] | '*' {
  const originsRaw = process.env.CORS_ALLOWED_ORIGINS;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!originsRaw) {
    if (nodeEnv === 'production') {
      throw new Error(
        'CORS_ALLOWED_ORIGINS must be set in production. ' +
        'Use comma-separated list of allowed origins.'
      );
    }
    // Development: allow all
    logger.warn('CORS: Allowing all origins in development mode');
    return '*';
  }

  if (originsRaw === '*') {
    if (nodeEnv === 'production') {
      throw new Error(
        'CORS_ALLOWED_ORIGINS=* is not allowed in production. ' +
        'Specify explicit origins.'
      );
    }
    return '*';
  }

  return originsRaw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

function validateOrigin(
  origin: string | undefined,
  allowedOrigins: string[] | '*'
): boolean {
  if (allowedOrigins === '*') return true;
  if (!origin) return false;

  return allowedOrigins.some((allowed) => {
    // Support wildcard subdomains: *.example.com
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(domain);
    }
    return origin === allowed;
  });
}

export function createCorsConfig(): CorsOptions {
  const allowedOrigins = parseAllowedOrigins();

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, Postman, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (validateOrigin(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS: Rejected origin');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Signature',
      'X-Timestamp',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
  };
}
```

---

### Phase 3: HTTPS Enforcement

**Priority: HIGH**

#### 3.1 Create HTTPS redirect middleware

**File: `packages/service/src/middleware/https.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';

interface HttpsOptions {
  enabled: boolean;
  trustProxy: boolean;
  excludePaths?: string[];
}

export function createHttpsEnforcement(options: HttpsOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!options.enabled) {
      return next();
    }

    // Skip for excluded paths (e.g., health checks from load balancer)
    if (options.excludePaths?.some((p) => req.path.startsWith(p))) {
      return next();
    }

    // Check if already secure
    const isSecure =
      req.secure ||
      (options.trustProxy && req.get('X-Forwarded-Proto') === 'https');

    if (isSecure) {
      // Add HSTS header
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      return next();
    }

    // Redirect to HTTPS
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    res.redirect(301, httpsUrl);
  };
}
```

#### 3.2 Enhanced Helmet configuration

**File: `packages/service/src/middleware/security.ts`**

```typescript
import helmet from 'helmet';
import { Express } from 'express';

export function applySecurityHeaders(app: Express): void {
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    })
  );

  // Additional security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()');
    next();
  });
}
```

---

### Phase 4: Granular Rate Limiting

**Priority: MEDIUM**

#### 4.1 Endpoint-specific rate limits

**File: `packages/service/src/middleware/rateLimit.ts`**

```typescript
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RedisClientType } from 'redis';
import { logger } from '../logger.js';

interface RateLimitConfig {
  redis?: RedisClientType;
  trustProxy: boolean;
}

interface EndpointLimits {
  general: number;
  auth: number;
  write: number;
  sse: number;
  burst: number;
}

const DEFAULT_LIMITS: EndpointLimits = {
  general: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
  auth: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
  write: parseInt(process.env.RATE_LIMIT_WRITE || '60', 10),
  sse: parseInt(process.env.RATE_LIMIT_SSE || '10', 10),
  burst: parseInt(process.env.RATE_LIMIT_BURST || '20', 10),
};

function createStore(redis?: RedisClientType) {
  if (redis) {
    return new RedisStore({
      sendCommand: (...args: string[]) => redis.sendCommand(args),
    });
  }
  return undefined; // Use memory store
}

export function createRateLimiters(config: RateLimitConfig) {
  const store = createStore(config.redis);

  const baseOptions = {
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req: any, res: any) => {
      logger.warn(
        { ip: req.ip, path: req.path },
        'Rate limit exceeded'
      );
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  };

  return {
    // General API rate limit
    general: rateLimit({
      ...baseOptions,
      store,
      windowMs: 60 * 1000, // 1 minute
      max: DEFAULT_LIMITS.general,
      keyGenerator: (req) => req.ip || 'unknown',
    }),

    // Strict limit for auth endpoints
    auth: rateLimit({
      ...baseOptions,
      store,
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: DEFAULT_LIMITS.auth,
      keyGenerator: (req) => req.ip || 'unknown',
      skipFailedRequests: false,
    }),

    // Write operations (POST, PUT, DELETE)
    write: rateLimit({
      ...baseOptions,
      store,
      windowMs: 60 * 1000,
      max: DEFAULT_LIMITS.write,
      keyGenerator: (req) => req.ip || 'unknown',
    }),

    // SSE connections (stricter to prevent resource exhaustion)
    sse: rateLimit({
      ...baseOptions,
      store,
      windowMs: 60 * 1000,
      max: DEFAULT_LIMITS.sse,
      keyGenerator: (req) => req.ip || 'unknown',
    }),

    // Burst protection (very short window)
    burst: rateLimit({
      ...baseOptions,
      store,
      windowMs: 1000, // 1 second
      max: DEFAULT_LIMITS.burst,
      keyGenerator: (req) => req.ip || 'unknown',
    }),
  };
}

export type RateLimiters = ReturnType<typeof createRateLimiters>;
```

#### 4.2 Apply rate limiters to routes

**File: `packages/service/src/server.ts`**

```typescript
import { createRateLimiters } from './middleware/rateLimit.js';

const rateLimiters = createRateLimiters({ redis, trustProxy: true });

// Apply burst protection to all routes
app.use(rateLimiters.burst);

// Apply general limit to most routes
app.use('/api', rateLimiters.general);

// Stricter limits for specific endpoints
app.use('/api/auth', rateLimiters.auth);
app.use('/api/streams/poll', rateLimiters.sse);
app.use('/api/streams/listen', rateLimiters.sse);

// Write operation limits
app.post('/api/*', rateLimiters.write);
app.put('/api/*', rateLimiters.write);
app.delete('/api/*', rateLimiters.write);
```

---

### Phase 5: Input Validation Hardening

**Priority: MEDIUM**

#### 5.1 Enhanced input sanitization

**File: `packages/service/src/utils/sanitize.ts`**

```typescript
/**
 * Remove potentially dangerous characters from input
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/\0/g, '') // Null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars
    .trim();
}

/**
 * Validate and sanitize stream name
 */
export function sanitizeStreamName(name: string): string {
  const sanitized = sanitizeString(name);

  // Enforce pattern
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error('Invalid stream name characters');
  }

  // Enforce length
  if (sanitized.length < 1 || sanitized.length > 255) {
    throw new Error('Stream name must be 1-255 characters');
  }

  // Prevent reserved names
  const reserved = ['__proto__', 'constructor', 'prototype'];
  if (reserved.includes(sanitized.toLowerCase())) {
    throw new Error('Reserved stream name');
  }

  return sanitized;
}

/**
 * Sanitize JSON object recursively
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      // Prevent prototype pollution
      if (sanitizedKey === '__proto__' || sanitizedKey === 'constructor') {
        continue;
      }
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate message size
 */
export function validateMessageSize(message: unknown): void {
  const size = JSON.stringify(message).length;
  const maxSize = parseInt(process.env.MAX_MESSAGE_SIZE || '102400', 10); // 100KB

  if (size > maxSize) {
    throw new Error(`Message too large: ${size} bytes (max: ${maxSize})`);
  }
}
```

#### 5.2 Request validation middleware

**File: `packages/service/src/middleware/validate.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { sanitizeObject, validateMessageSize } from '../utils/sanitize.js';

export function sanitizeRequestBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    try {
      req.body = sanitizeObject(req.body);
      validateMessageSize(req.body);
      next();
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid request body',
      });
    }
  } else {
    next();
  }
}
```

---

### Phase 6: Security Logging and Monitoring

**Priority: MEDIUM**

#### 6.1 Security event logger

**File: `packages/service/src/monitoring/securityLog.ts`**

```typescript
import { logger } from '../logger.js';

export enum SecurityEventType {
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT = 'INVALID_INPUT',
  CORS_REJECTED = 'CORS_REJECTED',
  SUSPICIOUS_REQUEST = 'SUSPICIOUS_REQUEST',
}

interface SecurityEvent {
  type: SecurityEventType;
  ip: string;
  path: string;
  method: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 10000;

  log(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log to main logger with security tag
    logger.warn({ security: true, ...fullEvent }, `Security event: ${event.type}`);
  }

  getRecentEvents(count = 100): SecurityEvent[] {
    return this.events.slice(-count);
  }

  getEventsByType(type: SecurityEventType, since?: Date): SecurityEvent[] {
    return this.events.filter(
      (e) => e.type === type && (!since || e.timestamp >= since)
    );
  }

  getEventsByIP(ip: string, since?: Date): SecurityEvent[] {
    return this.events.filter(
      (e) => e.ip === ip && (!since || e.timestamp >= since)
    );
  }

  clear(): void {
    this.events = [];
  }
}

export const securityLogger = new SecurityLogger();
```

#### 6.2 Security metrics endpoint

**File: `packages/service/src/routes/admin.ts`**

```typescript
import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.js';
import { securityLogger, SecurityEventType } from '../monitoring/securityLog.js';

const router = Router();

// Admin routes require authentication
router.use(createAuthMiddleware({ requireSignature: true }));

router.get('/security/events', (req, res) => {
  const since = req.query.since
    ? new Date(req.query.since as string)
    : undefined;
  const type = req.query.type as SecurityEventType | undefined;
  const ip = req.query.ip as string | undefined;

  let events = securityLogger.getRecentEvents(1000);

  if (type) {
    events = events.filter((e) => e.type === type);
  }
  if (ip) {
    events = events.filter((e) => e.ip === ip);
  }
  if (since) {
    events = events.filter((e) => e.timestamp >= since);
  }

  res.json({
    events,
    summary: {
      total: events.length,
      byType: Object.values(SecurityEventType).map((t) => ({
        type: t,
        count: events.filter((e) => e.type === t).length,
      })),
    },
  });
});

export { router as adminRouter };
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/service/src/config/security.ts` | Security configuration |
| `packages/service/src/config/cors.ts` | CORS configuration |
| `packages/service/src/middleware/https.ts` | HTTPS enforcement |
| `packages/service/src/middleware/security.ts` | Enhanced Helmet config |
| `packages/service/src/middleware/rateLimit.ts` | Granular rate limiting |
| `packages/service/src/middleware/validate.ts` | Request validation |
| `packages/service/src/utils/sanitize.ts` | Input sanitization |
| `packages/service/src/monitoring/securityLog.ts` | Security event logging |
| `packages/service/src/routes/admin.ts` | Admin endpoints |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/service/src/middleware/auth.ts` | Use secure comparison, add signing |
| `packages/service/src/server.ts` | Apply security middleware |

---

## Environment Variables

```bash
# Authentication
AUTH_ENABLED=true                    # Enable/disable authentication
API_KEYS=key1,key2,key3              # Comma-separated API keys
JWT_SECRET=your-32-char-min-secret   # JWT signing secret
ALLOW_INSECURE_PRODUCTION=false      # Allow auth disabled in production

# CORS
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

# HTTPS
HTTPS_ENABLED=true
TRUST_PROXY=true

# Rate Limiting
RATE_LIMIT_GENERAL=100               # Requests per minute
RATE_LIMIT_AUTH=10                   # Auth attempts per 15 min
RATE_LIMIT_WRITE=60                  # Write ops per minute
RATE_LIMIT_SSE=10                    # SSE connections per minute
RATE_LIMIT_BURST=20                  # Requests per second

# Input Validation
MAX_MESSAGE_SIZE=102400              # 100KB max message size
```

---

## Testing Requirements

### Security Tests
- API key validation with timing attack resistance
- CORS rejection for unauthorized origins
- Rate limit enforcement at correct thresholds
- Input sanitization removes dangerous chars
- Request signing validation

### Penetration Testing Checklist
- [ ] SQL injection attempts blocked
- [ ] XSS payloads sanitized
- [ ] CSRF tokens validated (if implemented)
- [ ] Rate limits prevent brute force
- [ ] Auth bypass attempts logged
- [ ] Path traversal blocked

---

## Success Metrics

1. **Zero auth bypass incidents** in production
2. **100% HTTPS** traffic in production
3. **All security events logged** with context
4. **Rate limits effective** against abuse
5. **CORS properly restricted** to allowed origins

---

## Estimated Effort

- Phase 1: 3-4 hours (auth hardening)
- Phase 2: 2-3 hours (CORS)
- Phase 3: 2-3 hours (HTTPS)
- Phase 4: 3-4 hours (rate limiting)
- Phase 5: 2-3 hours (input validation)
- Phase 6: 2-3 hours (logging/monitoring)

**Total: 14-20 hours**
