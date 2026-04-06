const { resolveIdentityClient } = require('./_identity-client');
const { derivePortalPhase, enrichClientProgress } = require('./_admin-client-progress');
const { normalizeClientStatus } = require('./_cockpit-config');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const resolution = await resolveIdentityClient({
      context,
      createIfMissing: true
    });
    const appointments = Array.isArray(resolution.appointments) ? resolution.appointments : [];
    const payments = Array.isArray(resolution.payments) ? resolution.payments : [];
    const enrichedClient = enrichClientProgress(resolution.client, appointments, payments);
    const resolvedStatus = normalizeClientStatus(
      enrichedClient.status || resolution.client.status || 'identity_created'
    ) || 'identity_created';
    const resolvedPhase = derivePortalPhase(enrichedClient, resolvedStatus);
    const client = {
      ...enrichedClient,
      phase: resolvedPhase,
      portal_phase: resolvedPhase,
      recorded_phase: resolution.client && resolution.client.phase !== undefined
        ? resolution.client.phase
        : null,
      status: resolvedStatus,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...client,
        clientId: client.id,
        nom: client.nom || client.prenom || resolution.normalizedEmail,
        status: resolvedStatus,
      }),
    };
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    console.error('resolve-client error:', error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({ error: error && error.message ? error.message : 'Erreur serveur' }),
    };
  }
};
