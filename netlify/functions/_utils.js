/**
 * _utils.js — Fonctions utilitaires partagées entre les Netlify Functions
 *
 * Centralise : formatage dates FR, validation admin-secret, emails, constantes
 */

const { createClient } = require('@supabase/supabase-js');

/* ── Constantes ──────────────────────────────────────── */

const SITE_URL = 'https://scantorenov.com';
const EMAIL_FROM = 'ScantoRenov <avant-projet@scantorenov.com>';
const ADMIN_NOTIFICATION_EMAIL = 'scantorenov@gmail.com';

/* ── Formatage dates FR ──────────────────────────────── */

function formatDateFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTimeFR(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ── Validation admin-secret ─────────────────────────── */

function validateAdminSecret(event) {
  const adminSecret = event.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return false;
  }
  return true;
}

/* ── Normalisation email ─────────────────────────────── */

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/* ── CORS headers standard ───────────────────────────── */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-secret',
    'Content-Type': 'application/json'
  };
}

/* ── Supabase admin client ───────────────────────────── */

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

/* ── Exports ─────────────────────────────────────────── */

module.exports = {
  SITE_URL,
  EMAIL_FROM,
  ADMIN_NOTIFICATION_EMAIL,
  formatDateFR,
  formatTimeFR,
  validateAdminSecret,
  normalizeEmail,
  corsHeaders,
  getSupabaseAdmin
};
