// Mon Temps — point d'entrée, navigation et écrans principaux.
import * as M from './moteur.js';
import * as St from './stockage.js';
import { S, codes, sauver, aller, joursDepuisSauvegarde, appliquerAffichage } from './etat.js';
import { esc, ic, chevron, toast, navBas, enteteRetour, badgeProvisoire, emettre, mailto } from './commun.js';
import * as V from './vues2.js';
import * as Visite from './visite.js';

const racine = document.getElementById('appli');

// ---------- Démarrage ----------
async function demarrer() {
  try {
    const r = await fetch('../config/etablissement.json', { cache: 'no-cache' });
    S.cfg = await r.json();
  } catch (e) {
    racine.innerHTML = '<div class="page" style="padding-top:3rem"><h1>Hors ligne</h1><p class="texte">Ouvre l\'appli une première fois avec une connexion internet.</p></div>';
    return;
  }
  document.documentElement.style.setProperty('--rouge', S.cfg.couleur || '#E30613');
  document.querySelectorAll('[data-nom]').forEach((e) => { e.textContent = S.cfg.nom; });
  document.title = S.cfg.nom;
  S.etat = (await St.charger()) || St.etatVide();
  appliquerAffichage();
  St.protegerStockage();
  S.rendre = rendre;
  window.addEventListener('hashchange', () => rendre(true));
  if (!S.etat.profil && !location.hash.startsWith('#/bienvenue')) location.hash = '#/bienvenue';
  else rendre(true);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('../sw.js').catch(() => {});
}

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.etat && appliquerAffichage());

// ---------- Navigation ----------
const ROUTES = {
  planning: vuePlanning, remplir: vueRemplir, jour: vueJour, compteurs: vueCompteurs, preuves: vuePreuves, preuve: vuePreuve,
  syndicat: V.vueSyndicat, greve: V.vueGreve, desiderata: V.vueDesiderata, courriers: V.vueCourriers, signalement: V.vueSignalement, droits: V.vueDroits,
  reglages: V.vueReglages, code: V.vueCode, report: V.vueReport, sauvegarde: V.vueSauvegarde, releve: V.vueReleve,
  bienvenue: V.vueBienvenue, confidentialite: V.vueConfidentialite
};

let derniereRoute = '';
function rendre(nouvelle = false) {
  const parts = (location.hash.replace(/^#\/?/, '') || 'planning').split('/').map(decodeURIComponent);
  const f = ROUTES[parts[0]] || vuePlanning;
  const v = f(parts) || {};
  const bandeau = S.demo ? `<div class="essai" role="status"><span>Mode essai · rien n'est enregistré</span><button type="button" id="quitter-essai">Quitter</button></div>` : '';
  racine.className = v.nav ? '' : 'sans-nav';
  racine.innerHTML = bandeau + (v.html || '') + (v.nav ? navBas(v.nav) : '');
  const q = document.getElementById('quitter-essai');
  if (q) q.onclick = () => Visite.quitterEssai();
  if (v.apres) v.apres(racine);
  const route = parts.join('/');
  if (nouvelle && route !== derniereRoute) window.scrollTo(0, 0);
  derniereRoute = route;
  const h = racine.querySelector('h1'); if (nouvelle && h) { h.setAttribute('tabindex', '-1'); }
  Visite.apresRendu(parts);
}

// ---------- Planning du mois ----------
function grilleMois(y, m, options = {}) {
  const today = M.aujourdhui(); const C = codes();
  const premier = M.iso(y, m, 1); const nb = M.joursDansMois(y, m); const dec = M.jourSemaine(premier);
  const semaines = Math.ceil((dec + nb) / 7);
  const alertes = new Set(S.etat.reglages.controles ? M.controles(premier, M.iso(y, m, nb), S.etat, S.cfg).map((a) => a.date) : []);
  let cases = '';
  for (let i = 0; i < semaines * 7; i++) {
    const d = M.ajouterJours(premier, i - dec);
    const n = Number(d.slice(8));
    if (d.slice(0, 7) !== premier.slice(0, 7)) { cases += `<span class="case hors" aria-hidden="true"><span class="n">${n}</span></span>`; continue; }
    const j = M.journee(d, S.etat, C);
    const cls = ['case'];
    if (j && j.info) cls.push('t-' + (j.info.type === 'nuit' ? 'travail' : j.info.type)); else if (j) cls.push('t-travail'); else cls.push('vide');
    if (j && j.source === 'prevu' && d > today) cls.push('prevu');
    if (M.nomFerie(d)) cls.push('ferie');
    if (d === today) cls.push('auj');
    if (options.selection && options.selection.has(d)) cls.push('choisie');
    const lib = `${M.longue(d)}${j ? ', ' + j.code + (j.source === 'prevu' && d > today ? ' prévu' : '') : ', non saisi'}${M.nomFerie(d) ? ', férié' : ''}${alertes.has(d) ? ', alerte' : ''}`;
    const attrs = options.selection ? `role="button" tabindex="0" data-date="${d}" aria-pressed="${options.selection.has(d)}"` : `href="#/jour/${d}"`;
    const tag = options.selection ? 'span' : 'a';
    cases += `<${tag} class="${cls.join(' ')}" ${attrs} data-tour="jour-${d}" aria-label="${esc(lib)}"><span class="n">${n}</span><span class="c">${j ? esc(j.code) : ''}</span>${alertes.has(d) ? '<span class="pastille"></span>' : ''}</${tag}>`;
  }
  return `<div class="cal" data-tour="grille"><div class="cal-jours" aria-hidden="true">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<div>${x}</div>`).join('')}</div><div class="cal-grille">${cases}</div></div>`;
}

function moisDepuis(p) {
  const t = M.aujourdhui();
  const s = /^\d{4}-\d{2}$/.test(p || '') ? p : t.slice(0, 7);
  return s.split('-').map(Number);
}
const moisVoisin = (y, m, k) => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); return `${d.getUTCFullYear()}-${M.pad(d.getUTCMonth() + 1)}`; };

function vuePlanning(p) {
  const [y, m] = moisDepuis(p[1]);
  const today = M.aujourdhui(); const C = codes();
  const debut = M.iso(y, m, 1), fin = M.iso(y, m, M.joursDansMois(y, m));
  const borne = fin < today ? fin : today;
  const bilan = debut <= today ? M.bilanPeriode(debut, borne, S.etat, S.cfg) : null;
  let saisis = 0; for (let n = M.jourNum(debut); n <= M.jourNum(fin); n++) if (S.etat.jours[M.depuisNum(n)]) saisis++;
  const nbAlertes = S.etat.reglages.controles ? M.controles(debut, fin, S.etat, S.cfg).length : 0;
  const js = joursDepuisSauvegarde();
  const sauvOk = js !== null && js < 31;
  const jAuj = today.slice(0, 7) === debut.slice(0, 7) ? M.journee(today, S.etat, C) : null;
  let carteJour = '';
  if (today.slice(0, 7) === debut.slice(0, 7)) {
    const f = M.nomFerie(today);
    const horaire = jAuj && jAuj.info && jAuj.info.debut ? `${jAuj.info.debut} – ${jAuj.info.fin}` : (jAuj && jAuj.info ? esc(jAuj.info.libelle) : 'Rien de saisi pour aujourd\'hui');
    carteJour = `<section class="carte" aria-label="Aujourd'hui" style="margin:0 1rem;display:flex;flex-direction:column;gap:.5rem">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><p class="etiquette">${esc(M.JOURS[M.jourSemaine(today)].slice(0, 3))}. ${esc(M.courte(today))}${f ? ' · ' + esc(f) : ''}</p><a href="#/jour/${today}" style="font-size:.8125rem;font-weight:700;text-decoration:none;padding:.375rem 0">${jAuj ? 'Modifier' : 'Saisir'}</a></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem"><div style="display:flex;align-items:center;gap:.75rem;min-width:0">${jAuj ? `<span style="font-size:1.375rem;font-weight:800;font-stretch:80%">${esc(jAuj.code)}</span>` : ''}<span style="font-size:.9375rem;color:var(--encre2)">${horaire}</span></div>${jAuj && jAuj.effMin ? `<b>${M.formatDuree(jAuj.effMin)}</b>` : ''}</div>
      ${jAuj && f && jAuj.effMin ? '<p class="petit" style="margin:0">Compte dans tes dimanches et fériés.</p>' : ''}
    </section>`;
  }
  return {
    nav: 'planning',
    html: `<header class="haut"><div class="marque"><i></i>${esc(S.cfg.syndicat)}</div><div class="icones">
        <a class="btn-icone" href="#/sauvegarde" data-tour="sauvegarde" aria-label="${sauvOk ? 'Sauvegarde à jour' : 'Sauvegarde à faire'}" style="color:${sauvOk ? 'var(--vert)' : 'var(--ambre)'}">${ic(sauvOk ? 'bouclier' : 'bouclierAlerte')}</a>
        <a class="btn-icone" href="#/reglages" aria-label="Réglages">${ic('reglages')}</a></div></header>
      <div class="ligne-titre"><h1>${esc(M.MOIS[m - 1].replace(/^./, (c) => c.toUpperCase()))} <span class="pale">${y}</span></h1>
        <div class="fleches"><a href="#/planning/${moisVoisin(y, m, -1)}" aria-label="Mois précédent">${ic('gauche')}</a><a href="#/planning/${moisVoisin(y, m, 1)}" aria-label="Mois suivant">${ic('droite')}</a></div></div>
      <div class="bandeau-stats" style="margin-top:.875rem">
        <div><span>Solde du mois</span><b class="${bilan && bilan.solde < 0 ? 'neg' : 'pos'}">${bilan ? M.formatDuree(bilan.solde, true) : '—'}</b></div>
        <div><span>Saisis</span><b>${saisis}<span class="pale" style="font-size:1.125rem;font-weight:500;color:var(--pale)"> / ${M.joursDansMois(y, m)} j</span></b></div>
        <div><a href="#/compteurs/${y}" style="text-decoration:none;color:inherit;display:block"><span>Alertes</span><b class="${nbAlertes ? 'neg' : ''}">${nbAlertes}</b></a></div>
      </div>
      ${grilleMois(y, m)}
      <div style="padding:0 1rem;margin-top:-.25rem"><div class="legende"><span><i class="plein"></i>Fait</span><span><i class="tirets"></i>Prévu</span><span><u>11</u>Férié</span><span><i style="width:6px;height:6px;border-radius:50%;background:var(--rouge);border:0"></i>Alerte</span></div></div>
      ${carteJour}
      <div style="padding:0 1rem"><a class="btn plein" href="#/remplir/${y}-${M.pad(m)}" data-tour="remplir">${ic('calendrier')}Remplir plusieurs jours d'un coup</a></div>`
  };
}

// ---------- Remplir plusieurs jours ----------
function vueRemplir(p) {
  const [y, m] = moisDepuis(p[1]);
  const cle = `${y}-${M.pad(m)}`;
  if (!S.vue.remplir || S.vue.remplir.mois !== cle) S.vue.remplir = { mois: cle, code: null, sel: new Set() };
  const R = S.vue.remplir; const C = [...codes().values()];
  const puces = C.map((c) => `<button type="button" class="${c.debut ? 'code' : 'puce t-' + c.type}" data-code="${esc(c.code)}" aria-pressed="${R.code === c.code}">${c.debut ? `<b>${esc(c.code)}</b><span>${esc(c.debut)}–${esc(c.fin)}</span>` : esc(c.code)}</button>`);
  const travail = C.filter((c) => c.debut).length;
  return {
    html: `${enteteRetour('Remplir', `#/planning/${cle}`)}
      <div class="page"><p class="texte">Recopie ton planning du mois en deux gestes : choisis un code, puis touche tous les jours concernés. Recommence avec le code suivant.</p>
      <div class="codes-travail">${puces.slice(0, travail).join('')}</div><div class="codes-autres">${puces.slice(travail).join('')}</div></div>
      <div class="ligne-titre" style="padding-top:.5rem"><h2 style="font-size:1.25rem;font-stretch:80%">${esc(M.MOIS[m - 1].replace(/^./, (c) => c.toUpperCase()))} ${y}</h2><div class="fleches"><a href="#/remplir/${moisVoisin(y, m, -1)}" aria-label="Mois précédent">${ic('gauche')}</a><a href="#/remplir/${moisVoisin(y, m, 1)}" aria-label="Mois suivant">${ic('droite')}</a></div></div>
      <div style="margin-top:.5rem">${grilleMois(y, m, { selection: R.sel })}</div>
      <div class="page" style="margin-top:.875rem"><button class="btn principal plein" id="appliquer" ${R.code && R.sel.size ? '' : 'disabled'}>${R.code ? `Mettre ${esc(R.code)} sur ${R.sel.size} jour${R.sel.size > 1 ? 's' : ''}` : 'Choisis d\'abord un code'}</button>
      <p class="petit">Les jours remplis ici sont enregistrés comme « prévus ». Tu corriges ensuite seulement les journées qui ont changé.</p></div>`,
    apres(el) {
      el.querySelectorAll('[data-code]').forEach((b) => b.onclick = () => { R.code = b.dataset.code; S.rendre(); });
      const bascule = (c) => { const d = c.dataset.date; R.sel.has(d) ? R.sel.delete(d) : R.sel.add(d); S.rendre(); };
      el.querySelectorAll('[data-date]').forEach((c) => { c.onclick = () => bascule(c); c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bascule(c); } }; });
      el.querySelector('#appliquer').onclick = () => {
        for (const d of R.sel) { const e = S.etat.jours[d] || (S.etat.jours[d] = {}); e.prevu = { code: R.code }; }
        toast(`${R.code} posé sur ${R.sel.size} jour${R.sel.size > 1 ? 's' : ''}`);
        R.sel = new Set(); sauver(); emettre('remplir'); S.rendre();
      };
    }
  };
}

// ---------- Saisie d'une journée ----------
function chargerJour(date, mode) {
  const e = S.etat.jours[date] || {};
  const src = e[mode] || {};
  const preuveR = S.etat.preuves.find((x) => x.type === 'rappel' && x.date === date);
  const preuveC = S.etat.preuves.find((x) => x.type === 'changement' && x.date === date);
  const codeParDefaut = src.code || (mode === 'realise' && e.prevu ? e.prevu.code : null);
  return { date, mode, code: codeParDefaut || null, depassement: Number(src.depassementMin) || 0, note: src.note || '', rappel: !!preuveR, appelLe: preuveR ? preuveR.appelLe : '', change: !!preuveC, prevenuLe: preuveC ? preuveC.prevenuLe : '' };
}

function vueJour(p) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '') ? p[1] : M.aujourdhui();
  const today = M.aujourdhui();
  if (!S.vue.jour || S.vue.jour.date !== date) S.vue.jour = chargerJour(date, date <= today ? 'realise' : 'prevu');
  const J = S.vue.jour; const C = codes();
  const e = S.etat.jours[date] || {};
  const prevuCode = e.prevu && e.prevu.code;
  const info = J.code ? C.get(J.code) : null;
  const travail = [...C.values()].filter((c) => c.debut);
  const autres = [...C.values()].filter((c) => !c.debut);
  const fin = info && info.fin ? M.hm(info.fin) + J.depassement : null;
  const sortie = fin != null ? `${M.pad(Math.floor(fin / 60) % 24)}:${M.pad(fin % 60)}` : '';
  const montrerChange = J.mode === 'realise' && prevuCode && J.code && J.code !== prevuCode;
  const f = M.nomFerie(date);
  return {
    html: `<header class="retour" style="justify-content:space-between;padding-right:1rem"><div style="padding-left:.5rem"><p class="etiquette">${esc(M.JOURS[M.jourSemaine(date)])}${f ? ' · ' + esc(f) : ''}</p><h1 style="font-size:1.875rem;margin-top:2px">${Number(date.slice(8))} ${esc(M.MOIS[Number(date.slice(5, 7)) - 1])}</h1></div>
        <a class="btn-icone" href="#/planning/${date.slice(0, 7)}" aria-label="Fermer sans enregistrer" style="background:var(--filet2)">${ic('fermer')}</a></header>
      <div class="page" style="margin-top:.875rem">
        <div class="segment" role="group" aria-label="Type de saisie" data-tour="mode">
          <button type="button" data-mode="realise" aria-pressed="${J.mode === 'realise'}">Ce que j'ai fait</button>
          <button type="button" data-mode="prevu" aria-pressed="${J.mode === 'prevu'}">Ce qui était prévu</button></div>
        ${J.mode === 'realise' && prevuCode ? `<p class="petit" style="margin:-.25rem 0 0">Prévu : <b>${esc(prevuCode)}</b>. Ne change rien si la journée s'est passée comme prévu.</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:.5rem" data-tour="codes"><p class="etiquette">Horaire</p>
          <div class="codes-travail">${travail.map((c) => `<button type="button" class="code" data-code="${esc(c.code)}" aria-pressed="${J.code === c.code}"><b>${esc(c.code)}</b><span>${esc(c.debut)}–${esc(c.fin)}</span></button>`).join('')}</div>
          <div class="codes-autres">${autres.map((c) => `<button type="button" class="puce t-${esc(c.type)}" data-code="${esc(c.code)}" aria-pressed="${J.code === c.code}" title="${esc(c.libelle)}">${esc(c.code)}</button>`).join('')}</div>
          ${info ? `<p class="petit" style="margin:0">${esc(info.libelle)}${info.debut ? ` · ${M.formatDuree(M.dureeEffectiveCode(info))} comptées${info.pauseMin ? ` (pause de ${info.pauseMin} min déduite)` : ''}${badgeProvisoire(S.cfg, 'codes.pause')}` : ''}</p>` : ''}
        </div>
        ${J.mode === 'realise' && info && info.debut ? `<div style="display:flex;flex-direction:column;gap:.5rem" data-tour="depassement"><p class="etiquette">Dépassement d'horaire</p>
          <div class="compteur"><button type="button" data-dep="-5" aria-label="Retirer 5 minutes">−</button><div class="v" aria-live="polite"><b>${J.depassement ? M.formatDuree(J.depassement, true) : '0h00'}</b><span class="petit">sortie à ${sortie}</span></div><button type="button" data-dep="5" aria-label="Ajouter 5 minutes">+</button></div>
          <p class="petit" style="margin:0">Même un quart d'heure, ça se note : c'est ce cumul qui prouve le manque d'effectifs.</p></div>` : ''}
        ${J.mode === 'realise' && info && info.debut ? `<label class="case-a-cocher" data-tour="rappel"><span><b>Rappelé·e sur un repos</b><small>Ajoute la journée à « Mes preuves »</small></span><input type="checkbox" id="rappel" ${J.rappel ? 'checked' : ''}></label>
          ${J.rappel ? `<label class="champ"><span>Appelé·e le</span><input type="datetime-local" id="appelLe" value="${esc(J.appelLe)}"></label>` : ''}` : ''}
        ${montrerChange ? `<label class="case-a-cocher"><span><b>Changement de dernière minute</b><small>Prévu ${esc(prevuCode)}, fait ${esc(J.code)} : garde une trace</small></span><input type="checkbox" id="change" ${J.change ? 'checked' : ''}></label>
          ${J.change ? `<label class="champ"><span>Prévenu·e le</span><input type="datetime-local" id="prevenuLe" value="${esc(J.prevenuLe)}"></label>` : ''}` : ''}
        <label class="champ"><span>Note</span><input type="text" id="note" value="${esc(J.note)}" placeholder="Ex. : remplacement d'une collègue absente" maxlength="200"></label>
        <button class="btn principal plein" id="enregistrer" data-tour="enregistrer">Enregistrer la journée</button>
        ${e.prevu || e.realise ? `<button class="btn plein danger" id="effacer">Effacer « ${J.mode === 'realise' ? 'ce que j\'ai fait' : 'prévu'} »</button>` : ''}
      </div>`,
    apres(el) {
      const lireChamps = () => {
        const n = el.querySelector('#note'); if (n) J.note = n.value;
        const a = el.querySelector('#appelLe'); if (a) J.appelLe = a.value;
        const pl = el.querySelector('#prevenuLe'); if (pl) J.prevenuLe = pl.value;
      };
      el.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { lireChamps(); S.vue.jour = chargerJour(date, b.dataset.mode); S.rendre(); });
      el.querySelectorAll('[data-code]').forEach((b) => b.onclick = () => { lireChamps(); J.code = J.code === b.dataset.code ? null : b.dataset.code; const i = C.get(J.code); if (!i || !i.debut) J.depassement = 0; S.rendre(); emettre('code'); });
      el.querySelectorAll('[data-dep]').forEach((b) => b.onclick = () => { lireChamps(); J.depassement = Math.max(-240, Math.min(720, J.depassement + Number(b.dataset.dep))); S.rendre(); emettre('depassement'); });
      const r = el.querySelector('#rappel'); if (r) r.onchange = () => { lireChamps(); J.rappel = r.checked; if (J.rappel && !J.appelLe) J.appelLe = maintenantLocal(); S.rendre(); };
      const c = el.querySelector('#change'); if (c) c.onchange = () => { lireChamps(); J.change = c.checked; if (J.change && !J.prevenuLe) J.prevenuLe = maintenantLocal(); S.rendre(); };
      el.querySelector('#enregistrer').onclick = () => {
        lireChamps();
        const ent = S.etat.jours[date] || (S.etat.jours[date] = {});
        if (J.code) {
          const o = { code: J.code };
          if (J.mode === 'realise' && J.depassement) o.depassementMin = J.depassement;
          if (J.note.trim()) o.note = J.note.trim();
          ent[J.mode] = o;
        } else delete ent[J.mode];
        if (!ent.prevu && !ent.realise) delete S.etat.jours[date];
        if (J.mode === 'realise') {
          majPreuve('rappel', date, J.rappel && J.code ? { code: J.code, appelLe: J.appelLe, note: J.note.trim() } : null);
          majPreuve('changement', date, J.change && montrerChange ? { ancien: prevuCode, nouveau: J.code, prevenuLe: J.prevenuLe } : null);
        }
        sauver(); toast('Journée enregistrée'); S.vue.jour = null; emettre('enregistre');
        aller('#/planning/' + date.slice(0, 7));
      };
      const ef = el.querySelector('#effacer');
      if (ef) ef.onclick = () => {
        const ent = S.etat.jours[date]; if (!ent) return;
        delete ent[J.mode]; if (!ent.prevu && !ent.realise) delete S.etat.jours[date];
        if (J.mode === 'realise') { majPreuve('rappel', date, null); majPreuve('changement', date, null); }
        sauver(); toast('Saisie effacée'); S.vue.jour = null; aller('#/planning/' + date.slice(0, 7));
      };
    }
  };
}
function maintenantLocal() { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 16); }
function majPreuve(type, date, donnees) {
  const i = S.etat.preuves.findIndex((x) => x.type === type && x.date === date);
  if (!donnees) { if (i >= 0) S.etat.preuves.splice(i, 1); return; }
  const ancien = i >= 0 ? S.etat.preuves[i] : { id: `${type}-${date}`, type, date, compense: false, creeLe: new Date().toISOString() };
  const n = { ...ancien, ...donnees };
  if (i >= 0) S.etat.preuves[i] = n; else S.etat.preuves.push(n);
}

// ---------- Compteurs ----------
function vueCompteurs(p) {
  const y = /^\d{4}$/.test(p[1] || '') ? Number(p[1]) : Number(M.aujourdhui().slice(0, 4));
  const b = M.bilanAnnee(y, S.etat, S.cfg);
  const today = M.aujourdhui();
  const enCours = String(y) === today.slice(0, 4);
  const finCtrl = enCours ? M.ajouterJours(today, 60) : `${y}-12-31`;
  const alertes = S.etat.reglages.controles ? M.controles(`${y}-01-01`, finCtrl < `${y}-12-31` ? finCtrl : `${y}-12-31`, S.etat, S.cfg) : [];
  const soldes = b.mois.map((x) => (x ? x.solde : 0));
  const max = Math.max(60, ...soldes.map(Math.abs));
  const barres = soldes.map((s) => `<div><div class="h">${s > 0 ? `<i style="height:${Math.round(s / max * 100)}%"></i>` : ''}</div><div class="axe"></div><div class="b">${s < 0 ? `<i style="height:${Math.round(-s / max * 100)}%"></i>` : ''}</div></div>`).join('');
  const rttReste = b.rttDroit - b.rttPris, caDroit = b.caDroit + b.bonusHS + b.bonusFrac, caReste = caDroit - b.caPris;
  const pct = (a, t) => Math.max(0, Math.min(100, t ? Math.round(a / t * 100) : 0));
  const tuile = (l, v, u, sous, j, couleur) => `<div class="tuile"><div class="l">${l}</div><div class="v">${v}<small>${u}</small></div><div class="jauge"><i style="width:${j}%;background:${couleur}"></i></div><div class="petit" style="margin-top:.375rem">${sous}</div></div>`;
  const regles = ['Repos quotidien', 'Repos hebdomadaire', '48 heures sur 7 jours', 'Repos de la quinzaine', 'Amplitude de la journée'];
  const vues = new Set(alertes.map((a) => a.regle));
  const listeAlertes = alertes.slice().reverse().slice(0, S.vue.toutesAlertes ? 999 : 4).map((a) => `<li class="alerte grave">${ic('alerte')}<div><div class="t">${esc(a.regle)}${a.futur ? ' · à venir' : ''}</div><div class="m">${esc(a.message)} <a href="#/jour/${a.date}">Voir le jour</a></div></div></li>`).join('');
  return {
    nav: 'compteurs',
    html: `<header class="haut" style="align-items:flex-end;padding-top:calc(1.375rem + env(safe-area-inset-top))"><h1>Compteurs <span class="pale">${y}</span></h1>
        <div class="fleches"><a href="#/compteurs/${y - 1}" aria-label="Année précédente">${ic('gauche')}</a><a href="#/compteurs/${y + 1}" aria-label="Année suivante">${ic('droite')}</a></div></header>
      <div class="page" style="margin-top:1rem">
        <section class="carte sombre" data-tour="solde" aria-label="Solde de l'année">
          <p class="etiquette">Solde au ${M.courte(b.jusqua)}${b.depart && b.depart > `${y}-01-01` ? ` · suivi depuis le ${M.courte(b.depart)}` : ''}</p>
          <div style="display:flex;align-items:baseline;gap:.625rem;margin-top:.25rem;flex-wrap:wrap"><span style="font-size:2.75rem;line-height:1;font-weight:800;font-stretch:80%">${M.formatDuree(b.solde, true)}</span><span style="font-size:.875rem;color:var(--carte-sombre-texte)">${b.solde >= 0 ? 'au-dessus de ton dû' : 'en dessous de ton dû'}</span></div>
          <p class="petit" style="margin:.375rem 0 0">Fait ${M.formatDuree(b.realise)} − dû ${M.formatDuree(b.theorique)}${b.report ? ` · report ${M.formatDuree(b.report, true)}` : ''}${badgeProvisoire(S.cfg, 'regles.valeurJourneeHeures')}</p>
          <div class="barres" role="img" aria-label="Solde de chaque mois">${barres}</div>
          <div class="barres-l" aria-hidden="true">${'JFMAMJJASOND'.split('').map((l) => `<span>${l}</span>`).join('')}</div>
        </section>
        ${b.manquants.length ? `<a class="carte ambre" href="#/jour/${b.manquants[0]}" style="text-decoration:none;display:flex;gap:.625rem">${ic('horloge')}<span><b style="display:block;font-size:.875rem">${b.manquants.length} jour${b.manquants.length > 1 ? 's' : ''} de semaine sans saisie</b><span class="petit">Le solde est faussé tant qu'ils restent vides. Premier : ${M.courte(b.manquants[0])}.</span></span></a>` : ''}
        <div class="tuiles">
          ${tuile(`RTT restants${badgeProvisoire(S.cfg, 'regles.rttParAn')}`, rttReste, ` / ${b.rttDroit}`, `${b.rttPris} posé${b.rttPris > 1 ? 's' : ''} dans l'année`, pct(rttReste, b.rttDroit), 'var(--bleu)')}
          ${tuile('Congés restants', caReste, ` / ${caDroit}`, b.bonusHS || b.bonusFrac ? `dont ${b.bonusHS + b.bonusFrac} jour${b.bonusHS + b.bonusFrac > 1 ? 's' : ''} gagné${b.bonusHS + b.bonusFrac > 1 ? 's' : ''} (hors saison / fractionnement)` : `${b.caHorsSaison} posé${b.caHorsSaison > 1 ? 's' : ''} hors saison`, pct(caReste, caDroit), 'var(--vert)')}
          ${tuile('Dépassements', M.formatDuree(b.depassements), '', `${b.recupPris} jour${b.recupPris > 1 ? 's' : ''} de récup posé${b.recupPris > 1 ? 's' : ''}`, pct(b.depassements, 60 * 60), 'var(--encre)')}
          ${tuile('Dimanches & fériés', b.djfJours, ' j', `${M.formatDuree(b.djfMinutes)} travaillées`, pct(b.djfJours, 20), 'var(--encre)')}
        </div>
        <div class="carte" style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.9375rem">Heures de nuit (21h–6h)</span><b>${M.formatDuree(b.nuit)}</b></div>
        <section class="liste" data-tour="alertes" aria-label="Contrôles légaux" style="list-style:none">
          <div style="padding:.75rem .875rem .5rem;display:flex;justify-content:space-between;align-items:baseline"><h2>Contrôles légaux</h2><a class="petit" href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000398298" target="_blank" rel="noopener">Décret 2002-9</a></div>
          ${S.etat.reglages.controles ? `<ul style="list-style:none;margin:0;padding:0">${listeAlertes}
          ${alertes.length > 4 && !S.vue.toutesAlertes ? `<li><button class="lien" id="toutes" style="display:flex;padding:.75rem .875rem;width:100%;background:none;border:0;border-top:1px solid var(--filet2);font-weight:700;color:var(--rouge-texte);cursor:pointer">Voir les ${alertes.length} alertes</button></li>` : ''}
          ${regles.filter((r) => !vues.has(r)).map((r) => `<li style="display:flex;justify-content:space-between;align-items:center;padding:.625rem .875rem;border-top:1px solid var(--filet2);font-size:.875rem"><span>${r}</span><span class="ok">${ic('coche')}Respecté</span></li>`).join('')}</ul>
          <p class="petit" style="padding:.5rem .875rem .75rem;margin:0;border-top:1px solid var(--filet2)">Vérifié sur tes saisies. Une alerte répétée ? Parles-en à la CGT.</p>`
          : '<p class="petit" style="padding:0 .875rem .875rem;margin:0">Contrôles désactivés dans les réglages.</p>'}
        </section>
        <div class="rangee"><a class="btn" href="#/releve/${y}">${ic('imprimer')}Relevé annuel</a><a class="btn" href="#/report/${y}">Report ${y - 1}</a></div>
      </div>`,
    apres(el) { const t = el.querySelector('#toutes'); if (t) t.onclick = () => { S.vue.toutesAlertes = true; S.rendre(); }; }
  };
}

// ---------- Mes preuves ----------
function vuePreuves(p) {
  const onglet = ['rappels', 'changements', 'depassements'].includes(p[1]) ? p[1] : 'rappels';
  const C = codes();
  const rappels = S.etat.preuves.filter((x) => x.type === 'rappel').sort((a, b) => b.date.localeCompare(a.date));
  const changes = S.etat.preuves.filter((x) => x.type === 'changement').sort((a, b) => b.date.localeCompare(a.date));
  const deps = Object.keys(S.etat.jours).sort().reverse().map((d) => M.journee(d, S.etat, C)).filter((j) => j && j.depassementMin > 0);
  const delai = (date, quand, code) => {
    if (!quand) return '';
    const info = C.get(code); const debut = info && info.debut ? M.hm(info.debut) : 0;
    const prise = new Date(`${date}T${M.pad(Math.floor(debut / 60))}:${M.pad(debut % 60)}`);
    const h = Math.round((prise - new Date(quand)) / 36e5);
    const q = new Date(quand);
    return `Prévenu·e le ${q.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${q.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${h >= 0 ? ` · ${h} h avant` : ''}`;
  };
  const bloc = (d) => `<div class="date-bloc"><b>${Number(d.slice(8))}</b><span>${esc(M.MOIS_COURTS[Number(d.slice(5, 7)) - 1].replace('.', ''))}</span></div>`;
  let items = '';
  if (onglet === 'rappels') items = rappels.map((r) => `<li><a class="lien" href="#/preuve/${encodeURIComponent(r.id)}" style="align-items:flex-start">${bloc(r.date)}<span style="flex:1;display:flex;flex-direction:column;gap:3px"><span style="display:flex;justify-content:space-between;gap:.5rem"><b>Rappelé·e sur un repos</b><b>${esc(r.code || '')}</b></span><span style="font-size:.8125rem;color:var(--encre2)">${esc(delai(r.date, r.appelLe, r.code)) || 'Heure de l\'appel non notée'}</span><span><span class="badge ${r.compense ? 'vert' : 'rouge'}">${r.compense ? 'Compensé' : 'Non compensé'}</span></span></span></a></li>`).join('');
  if (onglet === 'changements') items = changes.map((r) => `<li><a class="lien" href="#/preuve/${encodeURIComponent(r.id)}" style="align-items:flex-start">${bloc(r.date)}<span style="flex:1;display:flex;flex-direction:column;gap:3px"><span style="display:flex;justify-content:space-between;gap:.5rem"><b>Planning changé</b><b>${esc(r.ancien)} → ${esc(r.nouveau)}</b></span><span style="font-size:.8125rem;color:var(--encre2)">${esc(delai(r.date, r.prevenuLe, r.nouveau)) || 'Date de prévenance non notée'}</span></span></a></li>`).join('');
  if (onglet === 'depassements') items = deps.map((j) => `<li><a class="lien" href="#/jour/${j.date}" style="align-items:flex-start">${bloc(j.date)}<span style="flex:1;display:flex;flex-direction:column;gap:3px"><span style="display:flex;justify-content:space-between;gap:.5rem"><b>${esc(j.code)}</b><b>${M.formatDuree(j.depassementMin, true)}</b></span>${j.note ? `<span style="font-size:.8125rem;color:var(--encre2)">${esc(j.note)}</span>` : ''}</span></a></li>`).join('');
  const vides = { rappels: 'Aucun rappel noté. Quand on te rappelle sur un repos, coche la case dans la saisie de la journée.', changements: 'Aucun changement noté. Il apparaît quand ce que tu as fait diffère de ce qui était prévu.', depassements: 'Aucun dépassement noté pour l\'instant.' };
  const resume = () => {
    const l = [`Mes preuves — ${S.cfg.nom}`, ''];
    if (rappels.length) { l.push(`RAPPELS SUR REPOS (${rappels.length})`); rappels.forEach((r) => l.push(`- ${M.longue(r.date)} : ${r.code}. ${delai(r.date, r.appelLe, r.code)}. ${r.compense ? 'Compensé.' : 'Non compensé.'}`)); l.push(''); }
    if (changes.length) { l.push(`CHANGEMENTS DE PLANNING (${changes.length})`); changes.forEach((r) => l.push(`- ${M.longue(r.date)} : ${r.ancien} → ${r.nouveau}. ${delai(r.date, r.prevenuLe, r.nouveau)}.`)); l.push(''); }
    if (deps.length) { l.push(`DÉPASSEMENTS (${deps.length}, total ${M.formatDuree(deps.reduce((s, j) => s + j.depassementMin, 0))})`); deps.forEach((j) => l.push(`- ${M.longue(j.date)} : ${j.code} ${M.formatDuree(j.depassementMin, true)}${j.note ? ' — ' + j.note : ''}`)); }
    return l.join('\n');
  };
  return {
    nav: 'preuves',
    html: `<header class="haut" style="padding-top:calc(1.375rem + env(safe-area-inset-top))"><h1>Mes preuves</h1></header>
      <div class="page" style="margin-top:.5rem">
        <p class="texte">Rappels sur repos, changements de dernière minute, dépassements : tout est daté et reste sur ton téléphone, prêt à montrer au syndicat.</p>
        <div class="onglets" role="tablist" aria-label="Type de preuve" data-tour="onglets-preuves">
          <a href="#/preuves/rappels" ${onglet === 'rappels' ? 'aria-current="page"' : ''}>Rappels · ${rappels.length}</a>
          <a href="#/preuves/changements" ${onglet === 'changements' ? 'aria-current="page"' : ''}>Changements · ${changes.length}</a>
          <a href="#/preuves/depassements" ${onglet === 'depassements' ? 'aria-current="page"' : ''}>Dépassements · ${deps.length}</a></div>
        ${items ? `<ol class="liste">${items}</ol>` : `<div class="liste"><p class="vide-etat">${vides[onglet]}</p></div>`}
        <div class="rangee"><a class="btn principal" href="#/jour/${M.aujourdhui()}">${ic('plus')}Noter une journée</a>
          <a class="btn" id="envoyer" href="${esc(mailto(S.cfg.contacts.mailGeneral, 'Mes preuves — temps de travail', resume()))}">${ic('mail')}Envoyer</a></div>
        <p class="petit" style="display:flex;gap:.5rem;margin:0">${ic('cadenas')}<span>Rien ne quitte ton téléphone tant que tu n'envoies pas toi-même.</span></p>
      </div>`
  };
}

function vuePreuve(p) {
  const id = p[1]; const r = S.etat.preuves.find((x) => x.id === id);
  if (!r) return vuePreuves(['preuves']);
  return {
    html: `${enteteRetour(r.type === 'rappel' ? 'Rappel sur repos' : 'Changement', '#/preuves/' + (r.type === 'rappel' ? 'rappels' : 'changements'))}
      <div class="page" style="margin-top:.75rem">
        <div class="carte"><p class="etiquette">${esc(M.longue(r.date))}</p><p style="margin:.25rem 0 0;font-size:1.125rem;font-weight:700">${r.type === 'rappel' ? esc(r.code) : `${esc(r.ancien)} → ${esc(r.nouveau)}`}</p></div>
        <label class="champ"><span>${r.type === 'rappel' ? 'Appelé·e le' : 'Prévenu·e le'}</span><input type="datetime-local" id="quand" value="${esc(r.type === 'rappel' ? r.appelLe || '' : r.prevenuLe || '')}"></label>
        ${r.type === 'rappel' ? `<label class="case-a-cocher"><span><b>Compensé</b><small>Récupération ou paiement obtenu</small></span><input type="checkbox" id="comp" ${r.compense ? 'checked' : ''}></label>` : ''}
        <label class="champ"><span>Note</span><textarea id="note" maxlength="500">${esc(r.note || '')}</textarea></label>
        <button class="btn principal plein" id="ok">Enregistrer</button>
        <button class="btn plein danger" id="suppr">Supprimer cette preuve</button>
      </div>`,
    apres(el) {
      el.querySelector('#ok').onclick = () => {
        const q = el.querySelector('#quand').value; if (r.type === 'rappel') r.appelLe = q; else r.prevenuLe = q;
        const c = el.querySelector('#comp'); if (c) r.compense = c.checked;
        r.note = el.querySelector('#note').value.trim();
        sauver(); toast('Enregistré'); aller('#/preuves/' + (r.type === 'rappel' ? 'rappels' : 'changements'));
      };
      el.querySelector('#suppr').onclick = () => {
        if (!confirm('Supprimer cette preuve ?')) return;
        S.etat.preuves = S.etat.preuves.filter((x) => x.id !== id); sauver(); toast('Preuve supprimée'); aller('#/preuves');
      };
    }
  };
}

demarrer();
