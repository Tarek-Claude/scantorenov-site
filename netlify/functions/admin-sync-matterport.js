const { authorizeAdminRequest } = require('./_admin-session');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-session, x-admin-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const MATTERPORT_API_URL = 'https://api.matterport.com/api/models/graph';

function buildMatterportAuthHeader({ tokenId, tokenSecret, accessToken }) {
  const normalizedTokenId = String(tokenId || '').trim();
  const normalizedTokenSecret = String(tokenSecret || '').trim();
  const normalizedAccessToken = String(accessToken || '').trim();

  if (normalizedTokenId && normalizedTokenSecret) {
    const basicValue = Buffer.from(`${normalizedTokenId}:${normalizedTokenSecret}`, 'utf8').toString('base64');
    return `Basic ${basicValue}`;
  }

  if (normalizedAccessToken) {
    return `Bearer ${normalizedAccessToken}`;
  }

  throw new Error('Identifiants Matterport requis');
}

async function matterportGraphQL(query, variables, authHeader) {
  let response;

  try {
    response = await fetch(MATTERPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    throw new Error(`Connexion Matterport impossible: ${error.message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Matterport (${response.status}): ${errText}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL: ${result.errors.map((entry) => entry.message).join(', ')}`);
  }

  return result.data;
}

async function fetchMatterportModel(modelId, authHeader) {
  const sweepData = await matterportGraphQL(`
    fragment panoFragment on PanoramicImageLocation {
      id
      skybox(resolution: "2k") {
        id
        status
        format
        children
      }
    }
    query getSweeps($modelId: ID!) {
      model(id: $modelId) {
        id
        name
        description
        locations {
          id
          position { x y z }
          floor { id }
          room { id }
          panos { ...panoFragment }
        }
      }
    }
  `, { modelId }, authHeader);

  const dimData = await matterportGraphQL(`
    fragment dimensions on Dimension {
      areaCeiling
      areaFloor
      areaFloorIndoor
      areaWall
      volume
      depth
      height
      width
      units
    }
    query getDimensions($modelId: ID!) {
      model(id: $modelId) {
        name
        dimensions { ...dimensions }
        floors {
          label
          dimensions(units: metric) { ...dimensions }
        }
        rooms {
          id
          label
          tags
          dimensions { ...dimensions }
        }
      }
    }
  `, { modelId }, authHeader);

  let floorData = null;
  try {
    floorData = await matterportGraphQL(`
      query getFloorplans($modelId: ID!) {
        model(id: $modelId) {
          assets {
            floorplans(provider: "matterport", flags: [photogramy]) {
              floor { label sequence }
              format
              flags
              url
              origin { x y }
              width
              height
              resolution
            }
          }
        }
      }
    `, { modelId }, authHeader);
  } catch (error) {
    console.warn('[admin-sync-matterport] floorplans unavailable:', error.message);
  }

  return {
    modelId,
    modelName: sweepData.model?.name || '',
    description: sweepData.model?.description || '',
    locations: sweepData.model?.locations || [],
    dimensions: dimData.model?.dimensions || null,
    floors: dimData.model?.floors || [],
    rooms: dimData.model?.rooms || [],
    floorplans: floorData?.model?.assets?.floorplans || [],
  };
}

exports.handler = async function handler(event) {
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

  const auth = authorizeAdminRequest(event);
  if (!auth.authorized) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Corps invalide' }),
    };
  }

  const modelId = String(body.modelId || '').trim();
  const tokenId = String(body.tokenId || process.env.MATTERPORT_TOKEN_ID || '').trim();
  const tokenSecret = String(body.tokenSecret || process.env.MATTERPORT_TOKEN_SECRET || '').trim();
  const accessToken = String(body.token || process.env.MATTERPORT_API_TOKEN || '').trim();

  if (!modelId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'ID du modèle Matterport requis' }),
    };
  }

  if (!(tokenId && tokenSecret) && !accessToken) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Token ID + Token Secret Matterport requis (ou access token OAuth).' }),
    };
  }

  try {
    const authHeader = buildMatterportAuthHeader({ tokenId, tokenSecret, accessToken });
    const matterport = await fetchMatterportModel(modelId, authHeader);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        matterport,
      }),
    };
  } catch (error) {
    console.error('[admin-sync-matterport] error:', error.message);
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: error.message || 'Erreur Matterport' }),
    };
  }
};
