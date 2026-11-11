# Mon Temps

Appli web gratuite de suivi du temps de travail pour les agents du CH d'Albi, proposée par la CGT.
Tout reste sur le téléphone de l'agent : pas de compte, pas de serveur, aucune collecte.

Écrite de zéro (aucun code repris d'une autre appli), à partir des textes officiels :
décret n° 2002-9 du 4 janvier 2002 (temps de travail dans la fonction publique hospitalière).

---

## Tout se fait depuis le site GitHub, sans rien installer

### Mettre le site en ligne (une seule fois)

1. Dans le dépôt, onglet **Settings** › **Pages** (menu de gauche).
2. Sous *Build and deployment* › *Source*, choisis **GitHub Actions**.
3. Onglet **Actions** › **Publier le site** › bouton **Run workflow** › **Run workflow**.
4. Au bout de 1 à 2 minutes, le site est en ligne à l'adresse affichée dans *Settings › Pages*.

Ensuite, chaque modification du dépôt republie le site toute seule.

### Changer le nom de l'appli (ou tout autre réglage)

Tout ce qui est propre à l'établissement est dans **un seul fichier** : `config/etablissement.json`.

1. Ouvre `config` › `etablissement.json`, puis clique sur le crayon (**Edit this file**).
2. Modifie la ligne `"nom": "Mon Temps",` en gardant les guillemets et la virgule.
3. Clique sur **Commit changes…** puis encore **Commit changes**.
4. Attends 2 minutes : le nouveau nom apparaît partout (page d'accueil, appli, icône installée*).

\* Sur un téléphone où l'appli est déjà installée, le nom sous l'icône peut mettre quelques jours à changer : c'est le téléphone qui décide.

Si une faute de frappe casse le fichier (une virgule oubliée par exemple), la publication s'arrête
et **l'ancienne version reste en ligne** : rien n'est cassé pour les agents. L'onglet **Actions**
affiche alors une croix rouge ; il suffit de corriger le fichier.

### Ce qu'on peut régler dans `etablissement.json`

| Clé | À quoi ça sert |
|---|---|
| `nom`, `slogan`, `syndicat`, `etablissement`, `couleur` | Textes et couleur affichés partout |
| `regles.valeurJourneeHeures` | Valeur d'une journée pour calculer le dû (7 h par défaut) |
| `regles.rttParAn`, `regles.caParAn` | Droits annuels à temps plein |
| `regles.reposQuotidienMinHeures` | 12 h, ou 11 h si un accord local le prévoit |
| `codes` | Les codes horaires : `code`, `libelle`, `type`, `debut`, `fin`, `pauseMin` (et `debut2`/`fin2` pour un service coupé) |
| `metiers` | La liste proposée aux agents |
| `contacts` | Adresses mail (général, grève, signalements, adhésion), téléphone, local, réseaux |
| `agenda` | Rendez-vous affichés dans l'onglet Syndicat, ex. `{ "date": "2026-12-03", "titre": "AG", "lieu": "Salle B" }` |
| `aValider` | Valeurs encore provisoires : un badge « provisoire » s'affiche à côté. Vider la liste quand tout est confirmé |

Types de codes possibles : `travail`, `nuit`, `repos`, `rtt`, `conge`, `recup`, `assimile` (maladie, formation…), `greve`.

### Republier à la main

Onglet **Actions** › **Publier le site** › **Run workflow**.

---

## Organisation du dépôt

- `index.html`, `accueil.*` : page d'accueil
- `app/` : l'appli (planning, compteurs, preuves, syndicat, réglages, sauvegarde, visite guidée)
- `app/moteur.js` : calculs et contrôles légaux, testés automatiquement à chaque publication (`scripts/tester.mjs`)
- `config/etablissement.json` : tous les réglages de l'établissement
- `sw.js` : fonctionnement hors ligne

Licence MIT. Police Archivo sous licence SIL OFL 1.1.
