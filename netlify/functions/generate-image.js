/**
 * Scantorenov — Génération de visuels IA
 *
 * Architecture multi-provider :
 *   Changer de fournisseur = changer 1 variable (PROVIDER)
 *   Le front-end ne change JAMAIS
 *
 * Providers supportés :
 *   - together      (payant, ~0.003€/img)   ← TEST actuel
 *   - pollinations  (gratuit, sans clé)
 *   - fal           (payant, ~0.003€/img)   ← PROD recommandé
 *   - replicate     (payant, ~0.003€/img)
 *   - huggingface   (payant, ~0.001€/img)
 *   - openai        (payant, ~0.02€/img)
 */

// ══════════════════════════════════════════════════
//  CHANGER DE FOURNISSEUR = CHANGER CETTE LIGNE
// ══════════════════════════════════════════════════
const PROVIDER = process.env.IMAGE_PROVIDER || 'together';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// ── Prompt enrichissement architectural ──
function buildImagePrompt(userPrompt, context) {
  const base = `professional architectural interior design visualization, photorealistic, modern renovation, high quality render, natural lighting, French home`;
  const style = context?.style || 'contemporary warm minimalist';
  return `${base}, ${style}, ${userPrompt}`;
}

// ══════════════════════════════════════════════════
//  PROVIDERS
// ══════════════════════════════════════════════════

async function generatePollinations(prompt) {
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now();
  const params = `width=1024&height=768&nologo=true&enhance=true&seed=${seed}`;
  const url = `https://image.pollinations.ai/prompt/${encoded}?${params}`;

  // Pollinations génère l'image à la volée — on retourne l'URL directement
  // Le navigateur chargera l'image (peut prendre 10-30s la première fois)
  return { imageUrl: url, provider: 'pollinations' };
}

async function generateTogether(prompt) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new Error('TOGETHER_API_KEY non configurée');

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt: prompt,
      width: 1024,
      height: 768,
      steps: 4,
      n: 1,
      response_format: 'url'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Together.ai error ${response.status}: ${err}`);
  }
  const data = await response.json();
  return { imageUrl: data.data[0].url, provider: 'together' };
}

async function generateFal(prompt) {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('FAL_API_KEY non configurée');

  const response = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt,
      image_size: 'landscape_16_9',
      num_images: 1
    })
  });

  if (!response.ok) throw new Error(`Fal.ai error: ${response.status}`);
  const data = await response.json();
  return { imageUrl: data.images[0].url, provider: 'fal' };
}

async function generateReplicate(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN non configurée');

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: 'black-forest-labs/flux-schnell',
      input: { prompt: prompt, aspect_ratio: '16:9' }
    })
  });

  if (!response.ok) throw new Error(`Replicate error: ${response.status}`);
  const prediction = await response.json();

  // Replicate est asynchrone — on attend le résultat
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await fetch(result.urls.get, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    result = await poll.json();
  }

  if (result.status === 'failed') throw new Error('Replicate generation failed');
  return { imageUrl: result.output[0], provider: 'replicate' };
}

async function generateHuggingface(prompt) {
  const apiKey = process.env.HF_API_TOKEN;
  if (!apiKey) throw new Error('HF_API_TOKEN non configurée');

  const response = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ inputs: prompt })
    }
  );

  if (!response.ok) throw new Error(`HuggingFace error: ${response.status}`);
  const blob = await response.arrayBuffer();
  const base64 = Buffer.from(blob).toString('base64');
  return { imageUrl: `data:image/png;base64,${base64}`, provider: 'huggingface' };
}

async function generateOpenai(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY non configurée');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard'
    })
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return { imageUrl: data.data[0].url, provider: 'openai' };
}

// ══════════════════════════════════════════════════
//  HANDLER
// ══════════════════════════════════════════════════

/**
 * Fallback temporaire — photo d'architecture via picsum
 * À retirer quand Pollinations/Fal.ai sera configuré
 */
async function generateFallback(prompt) {
  const seed = Math.floor(Math.random() * 1000);
  const url = `https://picsum.photos/seed/${seed}/1024/768`;
  return { imageUrl: url, provider: 'fallback-demo' };
}

const GENERATORS = {
  together: generateTogether,
  pollinations: generatePollinations,
  fal: generateFal,
  replicate: generateReplicate,
  huggingface: generateHuggingface,
  openai: generateOpenai,
  fallback: generateFallback
};

exports.handler = async function(event) {
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
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps invalide' }) };
  }

  const { prompt, context } = body;
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt manquant' }) };
  }

  const fullPrompt = buildImagePrompt(prompt, context);
  const generator = GENERATORS[PROVIDER];

  if (!generator) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: `Provider inconnu: ${PROVIDER}` })
    };
  }

  try {
    const result = await generator(fullPrompt);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        imageUrl: result.imageUrl,
        provider: result.provider,
        prompt: fullPrompt
      })
    };
  } catch (err) {
    console.error(`Erreur génération image (${PROVIDER}):`, err.message);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({
        error: 'Erreur lors de la génération du visuel.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      })
    };
  }
};
