const crypto = require('crypto');

const SESSION_TTL_SECONDS = 60 * 60 * 12;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function normalizeAdminLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function getConfiguredAdminLogin() {
  return (process.env.ADMIN_LOGIN || process.env.ADMIN_USERNAME || '').trim();
}

function verifyConfiguredPassword(password) {
  const plainPassword = process.env.ADMIN_PASSWORD;
  const hash = (process.env.ADMIN_PASSWORD_SHA256 || process.env.ADMIN_PASSWORD_HASH || '')
    .trim()
    .toLowerCase();

  const verifiers = [];
  if (plainPassword) {
    verifiers.push(() => safeEqual(password, plainPassword));
  }

  if (hash) {
    const expectedHash = hash.startsWith('sha256:') ? hash.slice('sha256:'.length) : hash;
    verifiers.push(() => safeEqual(sha256Hex(password), expectedHash));
  }

  if (verifiers.length === 0) {
    return false;
  }

  return verifiers.some((verify) => verify());
}

function hasConfiguredAdminCredentials() {
  return !!(getConfiguredAdminLogin() && (
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD_SHA256 ||
    process.env.ADMIN_PASSWORD_HASH
  ));
}

function getSessionSecret() {
  return (process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || '').trim();
}

function signTokenPayload(encodedHeader, encodedPayload) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET ou ADMIN_SECRET requis');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function issueAdminSessionToken(login) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: login,
    role: 'admin',
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  }));
  const signature = signTokenPayload(header, payload);
  return `${header}.${payload}.${signature}`;
}

function parseBearerToken(event) {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }
  return event.headers['x-admin-session'] || '';
}

function verifyAdminSessionToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = signTokenPayload(encodedHeader, encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (error) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload || payload.role !== 'admin' || !payload.sub || payload.exp <= nowSeconds) {
    return null;
  }

  const configuredLogin = getConfiguredAdminLogin();
  if (!configuredLogin || normalizeAdminLogin(payload.sub) !== normalizeAdminLogin(configuredLogin)) {
    return null;
  }

  return payload;
}

function verifyAdminCredentials(login, password) {
  const configuredLogin = getConfiguredAdminLogin();
  if (!configuredLogin || !hasConfiguredAdminCredentials()) {
    return false;
  }

  return normalizeAdminLogin(login) === normalizeAdminLogin(configuredLogin)
    && verifyConfiguredPassword(password);
}

function hasValidLegacyAdminSecret(event) {
  const expectedSecret = process.env.ADMIN_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const headerSecret = event.headers['x-admin-secret'] || '';
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const bearerSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  return safeEqual(headerSecret, expectedSecret) || safeEqual(bearerSecret, expectedSecret);
}

function authorizeAdminRequest(event) {
  if (hasValidLegacyAdminSecret(event)) {
    return { authorized: true, mode: 'legacy-secret' };
  }

  const token = parseBearerToken(event);
  const payload = verifyAdminSessionToken(token);
  if (!payload) {
    return { authorized: false };
  }

  return {
    authorized: true,
    mode: 'session',
    login: payload.sub,
    payload,
  };
}

module.exports = {
  authorizeAdminRequest,
  getConfiguredAdminLogin,
  hasConfiguredAdminCredentials,
  issueAdminSessionToken,
  verifyAdminCredentials,
  verifyAdminSessionToken,
};
