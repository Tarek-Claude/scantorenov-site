/**
 * Scantorenov - Generation de visuels IA.
 *
 * Providers supportes:
 * - together
 * - together-kontext (image-to-image)
 * - pollinations
 * - fal
 * - replicate
 * - huggingface
 * - openai
 */

const PROVIDER = process.env.IMAGE_PROVIDER || 'together';
const KONTEXT_PROVIDER = 'together-kontext';
const DEFAULT_KONTEXT_SIZE = 1024;
const KONTEXT_STEPS = 28;
const KONTEXT_RETRY_BACKOFF_MS = 2000;
const KONTEXT_MAX_RETRIES = 1;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

function buildImagePrompt(userPrompt, context) {
  const base = 'professional architectural interior design visualization, photorealistic, modern renovation, high quality render, natural lighting, French home';
  const style = context?.style || 'contemporary warm minimalist';
  return `${base}, ${style}, ${userPrompt}`;
}

function parseAllowlist(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function hostMatches(host, allowedHost) {
  if (!host || !allowedHost) return false;
  const hostLower = host.toLowerCase();
  const allowedLower = allowedHost.toLowerCase().replace(/^\*\./, '');
  return hostLower === allowedLower || hostLower.endsWith(`.${allowedLower}`);
}

function pathMatches(pathname, allowedPath) {
  if (!allowedPath || allowedPath === '/') return true;
  const normalized = allowedPath.startsWith('/') ? allowedPath : `/${allowedPath}`;
  return pathname.startsWith(normalized);
}

function parseAllowlistEntry(entry) {
  const trimmed = String(entry || '').trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return { host: parsed.hostname, path: parsed.pathname || '' };
    } catch {
      return null;
    }
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const slashIndex = withoutProtocol.indexOf('/');
  if (slashIndex === -1) {
    return { host: withoutProtocol, path: '' };
  }

  return {
    host: withoutProtocol.slice(0, slashIndex),
    path: withoutProtocol.slice(slashIndex)
  };
}

function isSupabaseStorageUrl(urlObj) {
  return hostMatches(urlObj.hostname, 'supabase.co') && /\/storage\//i.test(urlObj.pathname || '');
}

function isAllowedByEnvAllowlist(urlObj) {
  const entries = parseAllowlist(process.env.IMG_SOURCE_ALLOWLIST || '');
  if (!entries.length) return false;

  return entries.some((entry) => {
    const parsedEntry = parseAllowlistEntry(entry);
    if (!parsedEntry || !parsedEntry.host) return false;
    return hostMatches(urlObj.hostname, parsedEntry.host) && pathMatches(urlObj.pathname || '', parsedEntry.path || '');
  });
}

function validateImageSourceUrl(imageUrl) {
  let urlObj;
  try {
    urlObj = new URL(imageUrl);
  } catch {
    throw new HttpError(400, 'imageUrl invalide');
  }

  if (urlObj.protocol !== 'https:') {
    throw new HttpError(400, 'imageUrl doit etre en https');
  }

  if (!isSupabaseStorageUrl(urlObj) && !isAllowedByEnvAllowlist(urlObj)) {
    throw new HttpError(400, 'imageUrl non autorisee');
  }

  return urlObj.toString();
}

function toSafeSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_KONTEXT_SIZE;
  return Math.round(n);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function toHttpError(error, fallbackStatusCode, fallbackMessage) {
  if (error instanceof HttpError) return error;
  return new HttpError(fallbackStatusCode, fallbackMessage || error?.message || 'Erreur serveur');
}

async function parseProviderError(response) {
  let details = '';
  try {
    details = await response.text();
  } catch {
    details = '';
  }

  if (!details) return `Erreur provider (${response.status})`;
  return `Erreur provider (${response.status}): ${details}`;
}

async function generatePollinations(prompt) {
  const encoded = encodeURIComponent(prompt);
  const seed = Date.now();
  const params = `width=1024&height=768&nologo=true&enhance=true&seed=${seed}`;
  const url = `https://image.pollinations.ai/prompt/${encoded}?${params}`;
  return { imageUrl: url, provider: 'pollinations' };
}

async function generateTogether(prompt) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new HttpError(500, 'TOGETHER_API_KEY non configuree');

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt,
      width: 1024,
      height: 768,
      steps: 4,
      n: 1,
      response_format: 'url'
    })
  });

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }

  const data = await response.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) {
    throw new HttpError(502, 'Reponse Together invalide');
  }

  return { imageUrl, provider: 'together' };
}

async function callTogetherKontext(prompt, imageUrl, width, height) {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) throw new HttpError(500, 'TOGETHER_API_KEY non configuree');

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-kontext-dev',
      prompt,
      image_url: imageUrl,
      width,
      height,
      steps: KONTEXT_STEPS,
      n: 1,
      response_format: 'url'
    })
  });

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }

  const data = await response.json();
  const resultUrl = data?.data?.[0]?.url;
  if (!resultUrl) {
    throw new HttpError(502, 'Reponse Together kontext invalide');
  }

  return resultUrl;
}

async function generateTogetherKontext(options) {
  const startedAt = Date.now();
  const prompt = String(options?.prompt || '').trim();
  const rawImageUrl = String(options?.imageUrl || '').trim();
  const width = toSafeSize(options?.width);
  const height = toSafeSize(options?.height);

  if (!prompt) {
    throw new HttpError(400, 'Prompt manquant');
  }
  if (!rawImageUrl) {
    throw new HttpError(400, 'imageUrl manquante');
  }

  const imageUrl = validateImageSourceUrl(rawImageUrl);

  let attempt = 0;
  while (attempt <= KONTEXT_MAX_RETRIES) {
    try {
      const resultUrl = await callTogetherKontext(prompt, imageUrl, width, height);
      console.log(`[generate-image] kontext ok duration_ms=${Date.now() - startedAt}`);
      return {
        url: resultUrl,
        imageUrl: resultUrl,
        provider: KONTEXT_PROVIDER
      };
    } catch (error) {
      const httpError = toHttpError(error, 500, 'Erreur lors de la generation du rendu');
      if (httpError.statusCode === 429 && attempt < KONTEXT_MAX_RETRIES) {
        attempt += 1;
        await wait(KONTEXT_RETRY_BACKOFF_MS);
        continue;
      }
      console.error(
        `[generate-image] kontext err duration_ms=${Date.now() - startedAt} status=${httpError.statusCode} message=${httpError.message}`
      );
      throw httpError;
    }
  }

  throw new HttpError(500, 'Erreur inattendue sur together-kontext');
}

async function generateFal(prompt) {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new HttpError(500, 'FAL_API_KEY non configuree');

  const response = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1
    })
  });

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }
  const data = await response.json();
  return { imageUrl: data.images[0].url, provider: 'fal' };
}

async function generateReplicate(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new HttpError(500, 'REPLICATE_API_TOKEN non configuree');

  const response = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      version: 'black-forest-labs/flux-schnell',
      input: { prompt, aspect_ratio: '16:9' }
    })
  });

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }
  const prediction = await response.json();

  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await wait(1500);
    const poll = await fetch(result.urls.get, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    result = await poll.json();
  }

  if (result.status === 'failed') {
    throw new HttpError(502, 'Replicate generation failed');
  }
  return { imageUrl: result.output[0], provider: 'replicate' };
}

async function generateHuggingface(prompt) {
  const apiKey = process.env.HF_API_TOKEN;
  if (!apiKey) throw new HttpError(500, 'HF_API_TOKEN non configuree');

  const response = await fetch(
    'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ inputs: prompt })
    }
  );

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }
  const blob = await response.arrayBuffer();
  const base64 = Buffer.from(blob).toString('base64');
  return { imageUrl: `data:image/png;base64,${base64}`, provider: 'huggingface' };
}

async function generateOpenai(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'OPENAI_API_KEY non configuree');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard'
    })
  });

  if (!response.ok) {
    throw new HttpError(response.status, await parseProviderError(response));
  }
  const data = await response.json();
  return { imageUrl: data.data[0].url, provider: 'openai' };
}

async function generateFallback() {
  const seed = Math.floor(Math.random() * 1000);
  const url = `https://picsum.photos/seed/${seed}/1024/768`;
  return { imageUrl: url, provider: 'fallback-demo' };
}

const GENERATORS = {
  together: generateTogether,
  'together-kontext': generateTogetherKontext,
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

  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt manquant' }) };
  }

  const requestedProvider = String(body?.provider || PROVIDER).trim();
  const generator = GENERATORS[requestedProvider];
  if (!generator) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Provider inconnu: ${requestedProvider}` })
    };
  }

  const fullPrompt = requestedProvider === KONTEXT_PROVIDER
    ? prompt
    : buildImagePrompt(prompt, body?.context);

  try {
    const result = requestedProvider === KONTEXT_PROVIDER
      ? await generator({
        prompt: fullPrompt,
        imageUrl: body?.imageUrl,
        width: body?.width,
        height: body?.height
      })
      : await generator(fullPrompt);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: result.url || result.imageUrl,
        imageUrl: result.imageUrl || result.url,
        provider: result.provider,
        prompt: fullPrompt
      })
    };
  } catch (error) {
    const fallbackError = requestedProvider === KONTEXT_PROVIDER
      ? toHttpError(error, 500, 'Erreur lors de la generation du rendu')
      : toHttpError(error, 500, 'Erreur lors de la generation du visuel.');

    if (requestedProvider !== KONTEXT_PROVIDER) {
      console.error(`[generate-image] ${requestedProvider} err:`, fallbackError.message);
    }

    return {
      statusCode: fallbackError.statusCode,
      headers,
      body: JSON.stringify({
        error: fallbackError.message
      })
    };
  }
};
