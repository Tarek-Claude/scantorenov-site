const PROMO_PENDING_VALIDATION_NOTE_MARKER = '[PROMO_PENDING_VALIDATION]';

function createPromoConfigError(message) {
  const error = new Error(message);
  error.code = 'PROMO_CONFIG_ERROR';
  error.statusCode = 500;
  return error;
}

function normalizePromoCode(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function splitPromoCodes(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return [];
  }

  return rawValue
    .split(/[\n,;]+/)
    .map(normalizePromoCode)
    .filter(Boolean);
}

function getPromoEnvNames(productType) {
  if (productType === 'scan_3d') {
    return ['PROMO_SCAN_BYPASS_CODES', 'PROMO_BYPASS_CODES'];
  }

  if (productType === 'virtual_tour') {
    return ['PROMO_VISIT_BYPASS_CODES', 'PROMO_BYPASS_CODES'];
  }

  return ['PROMO_BYPASS_CODES'];
}

function getConfiguredPromoCodes(productType) {
  const codes = new Set();

  getPromoEnvNames(productType).forEach((envName) => {
    splitPromoCodes(process.env[envName]).forEach((code) => codes.add(code));
  });

  return Array.from(codes);
}

function requireValidPromoCode(productType, providedCode) {
  const normalizedCode = normalizePromoCode(providedCode);
  if (!normalizedCode) {
    const error = new Error('Code promotionnel requis');
    error.statusCode = 400;
    throw error;
  }

  const configuredCodes = getConfiguredPromoCodes(productType);
  if (!configuredCodes.length) {
    throw createPromoConfigError(`Aucun code promotionnel configure pour ${productType}`);
  }

  if (!configuredCodes.includes(normalizedCode)) {
    const error = new Error('Code promotionnel invalide');
    error.statusCode = 403;
    throw error;
  }

  return normalizedCode;
}

function maskPromoCode(value) {
  const normalizedCode = normalizePromoCode(value);
  if (!normalizedCode) {
    return 'code-inconnu';
  }

  if (normalizedCode.length <= 4) {
    return `${normalizedCode.slice(0, 1)}***`;
  }

  return `${normalizedCode.slice(0, 2)}***${normalizedCode.slice(-2)}`;
}

function buildPromoPendingValidationNote(maskedCode, label) {
  return `${PROMO_PENDING_VALIDATION_NOTE_MARKER} ${label} via code ${maskedCode}. Validation dashboard requise.`;
}

function isPromoPendingValidationAppointment(appointment) {
  if (!appointment || typeof appointment !== 'object') {
    return false;
  }

  if (appointment.type !== 'scan_3d' || appointment.status !== 'requested') {
    return false;
  }

  return String(appointment.notes || '').includes(PROMO_PENDING_VALIDATION_NOTE_MARKER);
}

module.exports = {
  PROMO_PENDING_VALIDATION_NOTE_MARKER,
  buildPromoPendingValidationNote,
  createPromoConfigError,
  getConfiguredPromoCodes,
  isPromoPendingValidationAppointment,
  maskPromoCode,
  normalizePromoCode,
  requireValidPromoCode,
};
