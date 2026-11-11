// Mon Temps — modèles de courriers et signalements confidentiels.
import { S } from './etat.js';
import { esc, ic, toast, enteteRetour, mailto } from './commun.js';

const profil = () => S.etat.profil || {};
const signature = () => { const p = profil(); return [p.nomComplet || p.prenom, p.metier, p.service].filter(Boolean).join('\n') || '[Nom, prénom, grade, service]'; };
const ou = (v, defaut) => (v && String(v).trim()) || defaut;

// Chaque modèle : titre, à qui l'adresser, champs utiles, texte.
const MODELES = {
  releve: { titre: 'Demander mon relevé d\'heures', groupe: 'Temps de travail', champs: ['periode'],
    corps: (x) => `Bonjour,\n\nJe souhaite recevoir le relevé détaillé de mon temps de travail pour ${ou(x.periode, '[période]')} : heures effectuées, solde, heures supplémentaires, congés et RTT pris et restants.\n\nCe document me permettra de vérifier mon décompte. Merci de me le transmettre par écrit.` },
  recup: { titre: 'Récupérer des heures', groupe: 'Temps de travail', champs: ['heures', 'dates'],
    corps: (x) => `Bonjour,\n\nMon décompte fait apparaître ${ou(x.heures, '[nombre d\'heures]')} effectuées au-delà de mon temps de travail prévu. Je souhaite les récupérer ${x.dates ? 'le ' + x.dates : 'à une date à convenir ensemble'}.\n\nJe reste disponible pour en parler.` },
  paiement: { titre: 'Faire payer mes heures supplémentaires', groupe: 'Temps de travail', champs: ['heures', 'periode'],
    corps: (x) => `Bonjour,\n\nJ'ai effectué ${ou(x.heures, '[nombre d\'heures]')} supplémentaires sur ${ou(x.periode, '[période]')}, qui n'ont pas pu être récupérées. Je demande leur paiement et vous remercie de m'indiquer sur quelle paie il interviendra.` },
  rappel: { titre: 'Rappel sur un repos', groupe: 'Planning', champs: ['dates'],
    corps: (x) => `Bonjour,\n\nLe ${ou(x.dates, '[date]')}, j'ai été rappelé·e pour travailler alors que j'étais en repos. Je vous remercie de m'indiquer comment cette journée sera compensée (récupération ou rémunération) et à quelle date mon repos me sera rendu.` },
  changement: { titre: 'Changement de planning tardif', groupe: 'Planning', champs: ['dates', 'delai'],
    corps: (x) => `Bonjour,\n\nMon planning du ${ou(x.dates, '[date]')} a été modifié et je n'en ai été informé·e que ${ou(x.delai, '[délai]')} avant. Ces changements tardifs désorganisent ma vie personnelle.\n\nJe demande que les modifications me soient communiquées dans un délai raisonnable et qu'une solution soit trouvée pour cette fois.` },
  telephone: { titre: 'Ne plus être appelé·e sur mes repos', groupe: 'Planning', champs: [],
    corps: () => `Bonjour,\n\nJe suis régulièrement contacté·e sur mon téléphone personnel pendant mes repos et mes congés pour revenir travailler.\n\nMon numéro personnel n'a pas vocation à servir à l'organisation du service. Je demande qu'il ne soit plus utilisé à cette fin et qu'il soit retiré des listes de rappel. Je reste bien sûr joignable par les voies habituelles pendant mon temps de travail.` },
  effectif: { titre: 'Alerter sur un sous-effectif', groupe: 'Conditions de travail', champs: ['dates', 'precisions'],
    corps: (x) => `Bonjour,\n\nJe vous alerte sur la situation du service ${ou(profil().service, '[service]')} le ${ou(x.dates, '[date]')} : l'effectif présent ne permettait pas d'assurer la prise en charge des patients dans des conditions normales de sécurité.\n\n${ou(x.precisions, '[Effectif prévu, effectif présent, nombre de patients, conséquences constatées]')}\n\nJe vous demande de prendre les mesures nécessaires pour que cette situation ne se reproduise pas, et de conserver une trace de ce signalement.` },
  danger: { titre: 'Danger grave et imminent', groupe: 'Conditions de travail', champs: ['dates', 'precisions'],
    corps: (x) => `Bonjour,\n\nJe vous signale une situation de travail dont j'ai un motif raisonnable de penser qu'elle présente un danger grave et imminent pour ma vie ou ma santé.\n\nDate et lieu : ${ou(x.dates, '[date, lieu]')}\nSituation : ${ou(x.precisions, '[description précise du danger]')}\n\nJe vous demande de prendre immédiatement les mesures de protection nécessaires. Je me réserve la possibilité d'exercer mon droit de retrait, sans mettre en danger autrui, tant que le danger persiste. Les représentants du personnel sont informés.` },
  protection: { titre: 'Demander la protection fonctionnelle', groupe: 'Conditions de travail', champs: ['dates', 'precisions'],
    corps: (x) => `Madame la Directrice, Monsieur le Directeur,\n\nLe ${ou(x.dates, '[date]')}, dans l'exercice de mes fonctions, j'ai été victime des faits suivants :\n\n${ou(x.precisions, '[menaces, violences, injures, harcèlement… : description des faits, témoins]')}\n\nJe sollicite le bénéfice de la protection fonctionnelle due par l'administration à ses agents (articles L. 134-1 et suivants du code général de la fonction publique) : mesures de protection, prise en charge des frais de procédure et réparation du préjudice subi.` },
  partiel: { titre: 'Demander un temps partiel', groupe: 'Carrière', champs: ['quotite', 'dates', 'precisions'],
    corps: (x) => `Madame la Directrice, Monsieur le Directeur,\n\nJe sollicite l'autorisation de travailler à temps partiel à ${ou(x.quotite, '[quotité] %')} à compter du ${ou(x.dates, '[date]')}, pour une durée d'un an renouvelable.\n\n${ou(x.precisions, '[Motif : naissance ou adoption, soins à un proche, convenances personnelles… et organisation souhaitée]')}\n\nJe vous remercie de me faire connaître votre réponse par écrit.` },
  cet: { titre: 'Ouvrir ou alimenter mon CET', groupe: 'Carrière', champs: ['jours'],
    corps: (x) => `Bonjour,\n\nJe demande ${x.jours ? `le versement de ${x.jours} jour(s) sur mon compte épargne-temps` : 'l\'ouverture d\'un compte épargne-temps à mon nom'}, au titre des jours que je n'ai pas pu prendre cette année.\n\nMerci de me confirmer par écrit le nombre de jours inscrits sur mon compte après cette opération.` },
  report: { titre: 'Reporter des congés non pris', groupe: 'Carrière', champs: ['jours', 'precisions'],
    corps: (x) => `Bonjour,\n\nIl me reste ${ou(x.jours, '[nombre]')} jour(s) de congé annuel que je n'ai pas pu prendre cette année${x.precisions ? ` (${x.precisions})` : ' pour des raisons de service'}. Je demande leur report sur l'année prochaine.\n\nMerci de me confirmer votre accord par écrit.` },
  formation: { titre: 'Demander une formation', groupe: 'Carrière', champs: ['precisions', 'dates'],
    corps: (x) => `Bonjour,\n\nJe souhaite suivre la formation suivante : ${ou(x.precisions, '[intitulé, organisme]')}${x.dates ? `, prévue ${x.dates}` : ''}.\n\nElle s'inscrit dans mon projet professionnel et dans les besoins du service. Je vous remercie de l'inscrire au plan de formation et de m'indiquer la suite donnée à ma demande. En cas de refus, merci de m'en préciser le motif par écrit.` },
  entretien: { titre: 'Contester mon entretien professionnel', groupe: 'Carrière', champs: ['dates', 'precisions'],
    corps: (x) => `Madame la Directrice, Monsieur le Directeur,\n\nJ'ai reçu le ${ou(x.dates, '[date]')} le compte rendu de mon entretien professionnel. Je demande sa révision sur les points suivants :\n\n${ou(x.precisions, '[appréciations contestées et éléments qui les contredisent]')}\n\nJe vous remercie de me notifier votre réponse.` }
};
const LIBELLES = { dates: ['Date(s) concernée(s)', 'Ex. : 12 novembre 2026'], heures: ['Nombre d\'heures', 'Ex. : 7h30'], periode: ['Période', 'Ex. : l\'année 2026'], delai: ['Prévenu·e combien de temps avant ?', 'Ex. : la veille au soir'], quotite: ['Quotité souhaitée', 'Ex. : 80 %'], jours: ['Nombre de jours', 'Ex. : 3'], precisions: ['Précisions', ''] };

export function vueCourriers() {
  const K = S.vue.courrier || (S.vue.courrier = { modele: 'releve', v: {}, texte: null });
  if (!MODELES[K.modele]) K.modele = 'releve';
  const m = MODELES[K.modele];
  const texte = K.texte != null ? K.texte : `${m.corps(K.v)}\n\nCordialement,\n${signature()}`;
  const groupes = [...new Set(Object.values(MODELES).map((x) => x.groupe))];
  return {
    html: `${enteteRetour('Courriers', '#/outils')}
      <div class="page" style="margin-top:.75rem">
        <label class="champ"><span>Modèle</span><select id="modele">${groupes.map((g) => `<optgroup label="${esc(g)}">${Object.entries(MODELES).filter(([, x]) => x.groupe === g).map(([k, x]) => `<option value="${k}" ${K.modele === k ? 'selected' : ''}>${esc(x.titre)}</option>`).join('')}</optgroup>`).join('')}</select></label>
        ${m.champs.map((c) => c === 'precisions' ? `<label class="champ"><span>${LIBELLES[c][0]}</span><textarea data-c="${c}" style="min-height:4.5rem">${esc(K.v[c] || '')}</textarea></label>` : `<label class="champ"><span>${LIBELLES[c][0]}</span><input data-c="${c}" value="${esc(K.v[c] || '')}" placeholder="${esc(LIBELLES[c][1])}"></label>`).join('')}
        <label class="champ"><span>Courrier (tu peux le modifier)</span><textarea id="texte" style="min-height:16rem">${esc(texte)}</textarea></label>
        <div class="rangee"><button class="btn" id="copier">Copier</button><a class="btn principal" id="mail" href="#">${ic('mail')}Par mail</a></div>
        <p class="petit" style="margin:0">Garde toujours une copie de ce que tu envoies. Un doute sur la formulation ? Montre-le au syndicat avant.</p>
      </div>`,
    apres(el) {
      el.querySelector('#modele').onchange = (e) => { K.modele = e.target.value; K.texte = null; S.rendre(); };
      el.querySelectorAll('[data-c]').forEach((i) => { i.onchange = () => { K.v[i.dataset.c] = i.value; K.texte = null; S.rendre(); }; });
      const t = el.querySelector('#texte'); t.oninput = () => { K.texte = t.value; };
      el.querySelector('#copier').onclick = async () => { try { await navigator.clipboard.writeText(t.value); toast('Courrier copié'); } catch (e) { t.select(); toast('Sélectionné : copie-le avec ton clavier'); } };
      el.querySelector('#mail').onclick = () => { el.querySelector('#mail').href = mailto('', m.titre, t.value); };
    }
  };
}

// ---------- Signalements ----------
const SIGNALEMENTS = {
  violence: { titre: 'Violence', intro: 'Tu n\'as pas à rester seul·e.', legende: 'Violence', objet: 'une situation de violence', choix: ['De la hiérarchie', 'De collègue(s)', 'De patient(s) ou de proches', 'Autre'], aide: 'Dates, lieu, témoins éventuels.' },
  discrimination: { titre: 'Discrimination', intro: 'Tu n\'as pas à rester seul·e.', legende: 'Motif', objet: 'une discrimination', choix: ['Origine', 'Sexe ou genre', 'Âge', 'Handicap ou santé', 'Grossesse', 'Activité syndicale', 'Convictions', 'Orientation sexuelle', 'Autre'], aide: 'Dates, lieu, témoins éventuels.' },
  exposition: { titre: 'Exposition', intro: 'Une exposition à un produit ou à un agent dangereux doit laisser une trace écrite : elle peut compter des années plus tard.', legende: 'Exposition à', objet: 'une exposition à un risque', choix: ['Amiante', 'Produit chimique ou médicament dangereux', 'Fumées ou gaz', 'Sang ou liquide biologique', 'Agent infectieux', 'Rayonnements', 'Bruit, chaleur', 'Autre'], aide: 'Date, lieu, durée, produit en cause, protections disponibles ou non, personnes exposées.' }
};
export function vueSignalement(p) {
  const s = SIGNALEMENTS[p[1]] || SIGNALEMENTS.violence; const pr = profil();
  const indispo = !S.cfg.contacts || !S.cfg.contacts.mailSignalement;
  return {
    html: `${enteteRetour(s.titre, '#/syndicat')}
      <div class="page" style="margin-top:.75rem">
        <p class="texte">${esc(s.intro)} Ce message part de ta messagerie vers les délégué·es, qui te proposeront un rendez-vous en toute confidentialité.</p>
        <fieldset class="liste" style="padding:.25rem 0;margin:0"><legend class="etiquette" style="padding:0 .875rem">${esc(s.legende)}</legend>
          ${s.choix.map((t) => `<label class="ligne" style="cursor:pointer"><span>${esc(t)}</span><input type="checkbox" value="${esc(t)}" data-t style="width:1.375rem;height:1.375rem;accent-color:var(--rouge)"></label>`).join('')}</fieldset>
        <label class="champ"><span>Ce qui s'est passé, en quelques mots</span><textarea id="faits" placeholder="${esc(s.aide)} N'indique aucune information sur l'identité ou la santé d'un patient."></textarea></label>
        <label class="champ"><span>Comment te joindre ?</span><input id="joindre" placeholder="Téléphone ou créneaux (facultatif)"></label>
        <div class="rangee"><label class="champ"><span>Nom et prénom</span><input id="nom" value="${esc(pr.nomComplet || pr.prenom || '')}" autocomplete="name"></label></div>
        <div class="rangee"><label class="champ"><span>Métier</span><input id="metier" value="${esc(pr.metier || '')}"></label><label class="champ"><span>Service</span><input id="service" value="${esc(pr.service || '')}"></label></div>
        <a class="btn principal plein" id="envoyer" href="#" ${indispo ? 'aria-disabled="true" style="opacity:.5"' : ''}>${ic('mail')}Préparer le message</a>
        ${indispo ? '<p class="petit" style="margin:0">L\'adresse des délégué·es n\'est pas encore renseignée dans l\'appli.</p>' : ''}
        ${p[1] === 'exposition' ? '<p class="petit" style="margin:0">Pense aussi à faire inscrire l\'exposition dans ton dossier médical par le service de santé au travail, et à déclarer un accident de service s\'il y a eu un incident.</p>' : ''}
      </div>`,
    apres(el) {
      el.querySelector('#envoyer').onclick = (e) => {
        if (indispo) { e.preventDefault(); return; }
        const v = (id) => el.querySelector('#' + id).value.trim();
        const choix = [...el.querySelectorAll('[data-t]:checked')].map((i) => i.value);
        const corps = `Bonjour,\n\nJe souhaite signaler ${s.objet} et rencontrer un·e délégué·e.\n\n${s.legende} : ${choix.join(', ') || 'non précisé'}\n\nFaits :\n${v('faits') || '(à préciser de vive voix)'}\n\nMe joindre : ${v('joindre') || 'par retour de mail'}\n\n${[v('nom'), v('metier'), v('service')].filter(Boolean).join('\n')}\n`;
        el.querySelector('#envoyer').href = mailto(S.cfg.contacts.mailSignalement, 'Signalement confidentiel — demande de rendez-vous', corps);
      };
    }
  };
}
