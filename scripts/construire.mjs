// Prépare le site à publier dans _site/ : applique le nom de l'appli (config) partout
// et donne une version unique au service worker pour que les téléphones se mettent à jour.
// Lancé automatiquement par GitHub Actions à chaque modification.
import fs from 'node:fs';
import path from 'node:path';

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sortie = path.join(racine, '_site');
const ignorer = new Set(['.git', '.github', '_site', 'scripts', 'node_modules', 'README.md', 'tests']);

const cfg = JSON.parse(fs.readFileSync(path.join(racine, 'config/etablissement.json'), 'utf8'));
const nom = String(cfg.nom || 'Mon Temps').trim();
const couleur = /^#[0-9a-fA-F]{6}$/.test(cfg.couleur || '') ? cfg.couleur : '#E30613';
const version = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 12);

fs.rmSync(sortie, { recursive: true, force: true });
fs.mkdirSync(sortie);
for (const e of fs.readdirSync(racine)) if (!ignorer.has(e)) fs.cpSync(path.join(racine, e), path.join(sortie, e), { recursive: true });

const echappe = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
for (const f of ['index.html', 'app/index.html', 'mentions-legales.html']) {
  const p = path.join(sortie, f);
  let t = fs.readFileSync(p, 'utf8');
  t = t.replace(/Mon Temps/g, echappe(nom)).replace(/#E30613/g, couleur);
  fs.writeFileSync(p, t);
}

const man = JSON.parse(fs.readFileSync(path.join(sortie, 'manifest.webmanifest'), 'utf8'));
man.name = nom; man.short_name = nom.length > 12 ? nom.slice(0, 12) : nom; man.theme_color = couleur;
fs.writeFileSync(path.join(sortie, 'manifest.webmanifest'), JSON.stringify(man, null, 2));

const sw = path.join(sortie, 'sw.js');
fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace('__VERSION__', version));
fs.writeFileSync(path.join(sortie, '.nojekyll'), '');

console.log(`Site prêt : « ${nom} », version ${version}`);
