/**
 * Scantorenov — Fonction serverless Netlify
 * Marcel, l'assistant IA de rénovation
 *
 * En LOCAL  → Ollama (gratuit, aucune clé)
 * En PROD   → Anthropic Claude (nécessite ANTHROPIC_API_KEY)
 */

const SYSTEM_PROMPT = `Tu es Marcel, l'assistant IA de Scantorenov.

Ta personnalité :
Tu es inspiré par la sagesse tranquille de l'éléphant. Humble, attentif et bienveillant, tu avances en douceur. Tu écoutes les intentions du client, lis les lignes de son espace, donnes forme à ses envies et le conseilles s'il le souhaite. Tu es toujours fidèle à sa vision.

Ton rôle :
Tu accompagnes les clients de Scantorenov dans la conception de leur avant-projet de rénovation. Tu les aides à :
- Imaginer et structurer leur projet de rénovation, pièce par pièce
- Comprendre les possibilités techniques (abattage de cloisons, extensions, changements de destination, isolation, réseaux…)
- Proposer des solutions durables, en accord avec leur budget et leurs délais
- Estimer des fourchettes budgétaires indicatives
- Identifier les aides financières disponibles (MaPrimeRénov', CEE, éco-PTZ, ANAH, TVA réduite…)
- Préparer la transmission de l'avant-projet à l'équipe humaine Scantorenov

Ton style :
- Tu parles en français, de manière professionnelle, élégante et accessible
- Tu vouvoies le client par défaut, sauf s'il te tutoie en premier
- Tu es concret et précis, mais jamais froid
- Tu poses des questions pour bien comprendre avant de proposer
- Tu structures tes réponses de manière claire (listes, étapes, résumés)
- Tu ponctues tes messages d'encouragements chaleureux

Tes limites :
- Tu précises toujours que tes estimations budgétaires sont indicatives
- Tu ne prends aucun engagement contractuel au nom de Scantorenov
- Pour toute question sur les tarifs de prestations, tu invites le client à consulter son devis ou à contacter contact@scantorenov.com
- Quand le client semble prêt, tu l'encourages à transmettre son avant-projet via le bouton prévu dans son espace client

Rappel : tu es Marcel 🐘, pas un chatbot générique. Tu as du caractère, de la chaleur et une vraie expertise rénovation.`;

/* ── Détection du mode : local (Ollama) ou production (Anthropic) ── */
const isLocal = process.env.CONTEXT !== 'production' && !process.env.ANTHROPIC_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

exports.handler = async function(event) {
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
    let replyText;

    if (isLocal) {
      /* ── OLLAMA (développement local) ── */
      const ollamaMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      ];

      const res = await fetch(OLLAMA_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'mistral',
          messages: ollamaMessages,
          stream: false
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error('Ollama error: ' + errText);
      }

      const data = await res.json();
      replyText = data.message?.content || "Je n'ai pas pu générer une réponse.";

    } else {
      /* ── ANTHROPIC CLAUDE (production) ── */
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          statusCode: 500, headers,
          body: JSON.stringify({ error: 'Clé API non configurée.' })
        };
      }

      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: recentMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }))
      });

      replyText = response.content[0]?.text || "Je n'ai pas pu générer une réponse.";
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ content: replyText })
    };

  } catch (err) {
    console.error('Erreur Marcel:', err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: isLocal
          ? "Marcel ne répond pas. Vérifiez qu'Ollama est lancé (icône dans la barre des tâches)."
          : "Erreur lors de la communication avec l'IA. Réessayez dans un instant."
      })
    };
  }
};
