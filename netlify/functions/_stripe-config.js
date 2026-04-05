const Stripe = require('stripe');

function normalizeEnv(name) {
  const rawValue = process.env[name];
  return typeof rawValue === 'string' ? rawValue.trim() : '';
}

function createConfigError(message) {
  const error = new Error(message);
  error.code = 'CONFIG_ERROR';
  error.statusCode = 500;
  return error;
}

function isConfigError(error) {
  return !!(error && error.code === 'CONFIG_ERROR');
}

function requireEnv(name, predicate, message) {
  const value = normalizeEnv(name);
  if (!value) {
    throw createConfigError(`${name} non configuré`);
  }

  if (typeof predicate === 'function' && !predicate(value)) {
    throw createConfigError(message || `${name} invalide`);
  }

  return value;
}

function getStripeSecretKey() {
  return requireEnv(
    'STRIPE_SECRET_KEY',
    (value) => /^sk_(test|live)_/.test(value) || value.startsWith('sk_'),
    'STRIPE_SECRET_KEY invalide (attendu: clé secrète Stripe `sk_...`)'
  );
}

function getStripePriceScanId() {
  return requireEnv(
    'STRIPE_PRICE_SCAN_ID',
    (value) => value.startsWith('price_'),
    'STRIPE_PRICE_SCAN_ID invalide (attendu: identifiant Stripe `price_...`)'
  );
}

function getStripePriceVisitId() {
  return requireEnv(
    'STRIPE_PRICE_VISIT_ID',
    (value) => value.startsWith('price_'),
    'STRIPE_PRICE_VISIT_ID invalide (attendu: identifiant Stripe `price_...`)'
  );
}

function getStripeWebhookSecret() {
  return requireEnv(
    'STRIPE_WEBHOOK_SECRET',
    (value) => value.startsWith('whsec_'),
    'STRIPE_WEBHOOK_SECRET invalide (attendu: secret de signature Stripe `whsec_...`)'
  );
}

function getStripeClient() {
  return new Stripe(getStripeSecretKey());
}

function getSiteUrl() {
  const value = normalizeEnv('SITE_URL')
    || normalizeEnv('URL')
    || normalizeEnv('DEPLOY_PRIME_URL')
    || normalizeEnv('DEPLOY_URL')
    || 'http://localhost:8888';

  return value.replace(/\/+$/, '');
}

module.exports = {
  createConfigError,
  getSiteUrl,
  getStripeClient,
  getStripePriceScanId,
  getStripePriceVisitId,
  getStripeWebhookSecret,
  getStripeSecretKey,
  isConfigError,
};
