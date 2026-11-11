// Tests automatiques du moteur de calcul. Lancés par GitHub Actions avant chaque publication :
// si un test échoue, le site n'est pas mis à jour (l'ancienne version reste en ligne).
import fs from 'node:fs';
import path from 'node:path';
import * as M from '../app/moteur.js';

let ok = 0, ko = 0;
const t = (nom, cond) => { if (cond) ok++; else { ko++; console.error('ÉCHEC :', nom); } };
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const lire = (f) => JSON.parse(fs.readFileSync(path.join(racine, 'config', f), 'utf8'));
const contenu = lire('contenu.json'); const { aValider, ...regles } = lire('regles.json');
const cfg = { ...contenu, regles, aValider, codes: lire('codes.json') };
t('codes : une liste', Array.isArray(cfg.codes) && cfg.codes.length > 0);
for (const k of ['valeurJourneeHeures', 'reposQuotidienMinHeures', 'reposHebdoMinHeures', 'maxSeptJoursHeures', 'amplitudeMaxHeures']) t(`règle ${k} est un nombre`, typeof regles[k] === 'number' && regles[k] > 0);

// Réglages cohérents
const vus = new Set();
for (const c of cfg.codes) {
  t(`code ${c.code} unique`, !vus.has(c.code)); vus.add(c.code);
  t(`code ${c.code} a un type connu`, ['travail', 'nuit', 'repos', 'rtt', 'conge', 'recup', 'assimile', 'greve'].includes(c.type));
  if (c.type === 'travail' || c.type === 'nuit') t(`code ${c.code} a des horaires`, /^\d\d:\d\d$/.test(c.debut) && /^\d\d:\d\d$/.test(c.fin));
}
t('nom présent', typeof cfg.nom === 'string' && cfg.nom.trim().length > 0);

// Dates et fériés
t('Pâques 2026', M.feries(2026)['2026-04-06'] === 'Lundi de Pâques');
t('Pentecôte 2027', M.feries(2027)['2027-05-17'] === 'Lundi de Pentecôte');
t('jour de semaine', M.jourSemaine('2026-11-11') === 2);

// Durées
t('durée de nuit', M.dureeEffectiveCode({ debut: '21:00', fin: '07:00', pauseMin: 0 }) === 600);
t('service coupé', M.dureeEffectiveCode({ debut: '07:00', fin: '11:00', debut2: '16:00', fin2: '20:00' }) === 480);
t('heures de nuit', M.minutesNuit([[M.jourNum('2026-01-05') * 1440 + 20 * 60, M.jourNum('2026-01-05') * 1440 + 31 * 60]], cfg) === 540);

// Semaine type sans infraction
const etat = { profil: { quotite: 100 }, jours: {}, preuves: [], codesPerso: [], departs: {} };
const code = cfg.codes.find((c) => c.type === 'travail').code;
for (let n = M.jourNum('2026-03-02'); n < M.jourNum('2026-03-30'); n++) {
  const d = M.depuisNum(n); etat.jours[d] = { prevu: { code: M.jourSemaine(d) >= 5 ? 'RH' : code } };
}
t('semaine type : aucune alerte', M.controles('2026-03-02', '2026-03-29', etat, cfg).length === 0);

// Repos quotidien trop court
etat.jours['2026-03-10'] = { realise: { code, depassementMin: 600 } };
t('repos < 12h détecté', M.controles('2026-03-02', '2026-03-29', etat, cfg).some((a) => a.regle === 'Repos quotidien'));

// Bilan : un congé ne compte pas dans le dû
const b = M.bilanPeriode('2026-03-02', '2026-03-06', { ...etat, jours: { '2026-03-02': { prevu: { code: 'CA' } } } }, cfg);
t('congé retiré du dû', b.theorique === 4 * cfg.regles.valeurJourneeHeures * 60);

// Point de départ en cours d'année et report automatique d'une année sur l'autre
const e2 = { profil: { quotite: 100 }, jours: { '2026-11-02': { prevu: { code } } }, preuves: [], codesPerso: [], departs: { 2026: { date: '2026-11-02', soldeMin: 600, rttPris: 10, caPris: 20 } } };
const b26 = M.bilanAnnee(2026, e2, cfg, '2026-11-02');
t('point de départ : solde repris', b26.report === 600 && b26.depart === '2026-11-02');
t('point de départ : RTT et CA repris', b26.rttPris === 10 && b26.caPris === 20);
const b27 = M.bilanAnnee(2027, e2, cfg, '2027-01-01');
t('report automatique au 1er janvier', b27.reportAuto === true && b27.report === M.bilanAnnee(2026, e2, cfg, '2026-12-31').solde);

console.log(`${ok} tests réussis, ${ko} en échec`);
if (ko) process.exit(1);
