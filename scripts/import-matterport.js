#!/usr/bin/env node
/**
 * Scantorenov — Import Matterport CSV → app_metadata
 *
 * Usage :
 *   node scripts/import-matterport.js <csv_path> <client_email> [options]
 *
 * Options :
 *   --model-id <ID>       ID du modele Matterport (ex: DKQ6zroSLKj)
 *   --titre <texte>       Titre du scan (ex: "Etat des lieux")
 *   --phase <n>           Phase a definir (defaut: 5)
 *   --dry-run             Afficher le JSON sans envoyer
 *   --site-url <url>      URL du site (defaut: https://scantorenov.com)
 *   --admin-secret <key>  Cle admin (ou variable ADMIN_SECRET)
 *
 * Exemples :
 *   node scripts/import-matterport.js "chemin/vers/Dimensions.csv" client@email.com --model-id MODEL_ID --dry-run
 *   node scripts/import-matterport.js data.csv client@email.com --model-id ABC123 --admin-secret monSecret
 */

const fs = require('fs');
const path = require('path');

// ── Parse arguments ──
const args = process.argv.slice(2);
if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage: node ${path.basename(__filename)} <csv_path> <client_email> [options]

Options:
  --model-id <ID>       ID du modele Matterport
  --titre <texte>       Titre du scan
  --phase <n>           Phase a definir (defaut: 5)
  --dry-run             Afficher le JSON sans envoyer
  --site-url <url>      URL du site (defaut: https://scantorenov.com)
  --admin-secret <key>  Cle admin (ou variable env ADMIN_SECRET)
`);
  process.exit(0);
}

const csvPath = args[0];
const clientEmail = args[1];

function getOpt(name, defaultVal) {
  const idx = args.indexOf('--' + name);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}
const hasFlag = (name) => args.includes('--' + name);

const modelId = getOpt('model-id', null);
const titre = getOpt('titre', 'Etat des lieux');
const phase = parseInt(getOpt('phase', '5'));
const dryRun = hasFlag('dry-run');
const siteUrl = getOpt('site-url', process.env.URL || 'https://scantorenov.com');
const adminSecret = getOpt('admin-secret', process.env.ADMIN_SECRET || '');

// ── Lire et parser le CSV ──
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');

  // Parser l'en-tete
  const header = parseCSVLine(lines[0]);

  // Parser chaque ligne
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < header.length) continue;
    const row = {};
    header.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

// Parser une ligne CSV avec guillemets
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Convertir les lignes CSV en format matterport_data ──
function convertToMatterportData(rows) {
  // Grouper par niveau
  const niveauxMap = {};
  const annexes = [];

  rows.forEach(row => {
    const piece = row['Pièce'] || row['Pi\u00e8ce'] || '';
    const niveau = row['Niveau'] || '';
    const emplacement = row['Emplacement de la chambre'] || row['Emplacement'] || '';
    const surface = row['Zone (m2)'] || '';
    const dimensions = row['Dimensions'] || '';
    const largeur = row['Largeur'] || '';
    const longueur = row['Longueur'] || '';
    const surfaceNum = parseFloat(surface) || 0;

    const nomPiece = piece.trim();

    // Ignorer les escaliers exterieurs et les zones sans surface
    if (emplacement === 'Ext\u00e9rieur' || emplacement === 'Extérieur') {
      if (surfaceNum > 0 || nomPiece.toLowerCase().includes('garage') ||
          nomPiece.toLowerCase().includes('terrasse') || nomPiece.toLowerCase().includes('balcon')) {
        annexes.push({
          nom: nomPiece,
          dimensions: dimensions && dimensions !== '-' ? dimensions : undefined,
          emplacement: 'Ext\u00e9rieur ' + niveau
        });
      }
      return;
    }

    // Ignorer les zones sans surface interieure
    if (surfaceNum === 0 && !dimensions) return;

    if (!niveauxMap[niveau]) {
      niveauxMap[niveau] = { nom: niveau, pieces: [], surfaceTotal: 0 };
    }

    const pieceData = {
      nom: nomPiece,
      surface: surfaceNum > 0 ? surfaceNum.toFixed(1).replace('.', ',') + ' m\u00b2' : undefined
    };

    if (dimensions && dimensions !== '-') {
      pieceData.dimensions = dimensions;
    }

    niveauxMap[niveau].pieces.push(pieceData);
    niveauxMap[niveau].surfaceTotal += surfaceNum;
  });

  // Calculer la surface totale
  let surfaceTotale = 0;
  const niveaux = Object.values(niveauxMap).map(n => {
    surfaceTotale += n.surfaceTotal;
    return {
      nom: n.nom,
      surface: n.surfaceTotal.toFixed(1).replace('.', ',') + ' m\u00b2',
      pieces: n.pieces.sort((a, b) => {
        // Trier par surface decroissante
        const sa = parseFloat((a.surface || '0').replace(',', '.'));
        const sb = parseFloat((b.surface || '0').replace(',', '.'));
        return sb - sa;
      })
    };
  });

  const result = {
    surface_totale: surfaceTotale.toFixed(1).replace('.', ',') + ' m\u00b2',
    titre_scan: titre
  };

  if (niveaux.length > 0) result.niveaux = niveaux;
  if (annexes.length > 0) result.annexes = annexes;

  return result;
}

// ── Main ──
async function main() {
  // 1. Verifier le fichier CSV
  if (!fs.existsSync(csvPath)) {
    console.error('Erreur : fichier CSV introuvable :', csvPath);
    process.exit(1);
  }

  console.log('=== Import Matterport ===');
  console.log('CSV      :', csvPath);
  console.log('Client   :', clientEmail);
  console.log('Model ID :', modelId || '(non defini)');
  console.log('Phase    :', phase);
  console.log('');

  // 2. Parser le CSV
  const rows = parseCSV(csvPath);
  console.log(`${rows.length} lignes lues dans le CSV`);

  // 3. Convertir
  const matterportData = convertToMatterportData(rows);

  // Afficher un resume
  const niveaux = matterportData.niveaux || [];
  console.log(`Surface totale : ${matterportData.surface_totale}`);
  console.log(`Niveaux : ${niveaux.length}`);
  niveaux.forEach(n => {
    console.log(`  ${n.nom} (${n.surface}) — ${n.pieces.length} pieces`);
    n.pieces.forEach(p => {
      console.log(`    - ${p.nom}: ${p.surface || '?'}${p.dimensions ? ' (' + p.dimensions + ')' : ''}`);
    });
  });
  if (matterportData.annexes) {
    console.log(`Annexes : ${matterportData.annexes.length}`);
    matterportData.annexes.forEach(a => {
      console.log(`  - ${a.nom}${a.dimensions ? ' (' + a.dimensions + ')' : ''} — ${a.emplacement}`);
    });
  }

  // 4. Construire le payload
  const payload = {
    email: clientEmail,
    phase: phase,
    matterport_data: matterportData
  };

  if (modelId) payload.matterport_id = modelId;

  console.log('');

  if (dryRun) {
    console.log('=== DRY RUN — JSON genere ===');
    console.log(JSON.stringify(payload, null, 2));
    console.log('');
    console.log('Pour envoyer, relancez sans --dry-run');
    return;
  }

  // 5. Envoyer a l'API admin
  if (!adminSecret) {
    console.error('Erreur : ADMIN_SECRET requis. Utilisez --admin-secret <key> ou la variable env ADMIN_SECRET');
    process.exit(1);
  }

  const url = `${siteUrl}/.netlify/functions/admin-update-client`;
  console.log(`Envoi vers ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('');
      console.log('Succes ! Client mis a jour :');
      console.log(`  Email : ${data.email}`);
      console.log(`  Phase : ${data.phase}`);
      console.log('');
      console.log('Le client verra ses donnees Matterport a sa prochaine connexion.');
    } else {
      console.error('Erreur API :', data.error || response.statusText);
      process.exit(1);
    }
  } catch (err) {
    console.error('Erreur reseau :', err.message);
    process.exit(1);
  }
}

main();
