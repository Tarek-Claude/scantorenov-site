/**
 * Scantorenov — Fonction serverless Netlify
 * Proxy sécurisé vers l'API Claude (Anthropic)
 *
 * Configuration requise dans Netlify :
 *   Dashboard → Site → Environment variables → Ajouter :
 *   ANTHROPIC_API_KEY = sk-ant-api03-xxxx (votre clé API Claude)
 */

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `Tu es l'assistant IA de Scantorenov, une entreprise spécialisée en scan 3D Matterport et maîtrise d'oeuvre d'exécution pour des projets de rénovation haut de gamme.

Ton rôle est d'aider les clients de Scantorenov à :
- Imaginer et concevoir leur projet de rénovation
- Comprendre les possibilités techniques (abattage de cloisons, extensions, changements de destination...)
- Estimer des fourchettes budgétaires indicatives
- Identifier les aides financières disponibles (MaPrimeRénov', CEE, éco-PTZ, ANAH, TVA réduite...)
- Préparer leurs questions pour les échanges avec le maître d'oeuvre

Ton style est professionnel, élégant et accessible. Tu parles au client directement en tutoyant ou vouvoyant selon son style. Tu es précis, concret et bienveillant. Tu mentionnes toujours que tes estimations budgétaires sont indicatives et qu'un devis officiel sera établi par le maître d'oeuvre.

Tu ne prends pas d'engagements contractuels à la place de Scantorenov. Pour toute question sur les tarifs de prestations, tu invites le client à consulter son devis ou à contacter directement contact@scantorenov.com.

Réponds toujours en français.`;

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Clé API non configurée.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps de requête invalide' }) };
  }

  const { messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages manquants' }) };
  }

  const recentMessages = messages.slice(-20);

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: recentMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    });

    const replyText = response.content[0]?.text || "Je n'ai pas pu générer une réponse.";

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content: replyText })
    };

  } catch (err) {
    console.error('Erreur API Anthropic:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Erreur lors de la communication avec l'IA. Réessayez dans un instant." })
    };
  }
};
