/**
 * Scantorenov — Récupération des données d'un bien
 *
 * Retourne les données structurées du bien (JSON) pour enrichir
 * le contexte de Marcel. Source : fichier local ou SDK Matterport.
 */

const fs = require('fs');
const path = require('path');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  /* ID du modèle Matterport passé en query string : ?id=DKQ6zroSLKj */
  const modelId = event.queryStringParameters?.id;

  if (!modelId) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: 'Paramètre "id" manquant' })
    };
  }

  /* Cherche le fichier de données correspondant */
  const dataPath = path.join(__dirname, '..', '..', 'data', 'biens', `demo-${modelId}.json`);

  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const bien = JSON.parse(raw);
    return { statusCode: 200, headers, body: JSON.stringify(bien) };
  } catch (err) {
    /* Si le fichier n'existe pas, renvoyer un objet minimal */
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        id: modelId,
        titre: 'Bien non encore documenté',
        observations_generales: [
          'Les données de ce bien ne sont pas encore renseignées.',
          'Demandez à votre conseiller Scantorenov de compléter la fiche.'
        ],
        pieces: [],
        _meta: { source: 'non_trouvé', matterport_model_id: modelId }
      })
    };
  }
};
