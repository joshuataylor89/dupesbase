// Builds data/article-plan.json: 1v1 "original vs best clone" articles, one every 30 minutes.
// Usage: node tools/plan_articles.mjs <orig.json dump> [startISO]
import fs from 'fs';
const dump = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const start = Date.parse(process.argv[3] || '2026-11-11T22:00:00Z');
const MEN = ['Dior Sauvage', 'Creed Aventus', 'Chanel Bleu De Chanel EDP', 'Dior Sauvage Elixir', 'Versace Eros', 'Giorgio Armani Acqua Di Gio', 'Paco Rabanne 1 Million', 'Paco Rabanne Invictus', 'Jean Paul Gaultier Le Male', 'Jean Paul Gaultier Ultra Male', 'Yves Saint Laurent Y EDP', 'Versace Dylan Blue Pour Homme', 'Paco Rabanne Phantom', 'Azzaro The Most Wanted', 'Valentino Uomo Born in Roma', 'Carolina Herrera Bad Boy Cobalt', 'Giorgio Armani Stronger With You Intensely', 'Giorgio Armani Stronger With You Tobacco', 'Dior Homme Intense', 'Dior Fahrenheit', "Hermes Terre d'Hermes Parfum", 'Louis Vuitton Imagination', 'Tom Ford Noir Extreme', 'Parfums de Marly Herod', 'Parfums de Marly Haltane', 'Paco Rabanne 1 Million Elixir', 'Paco Rabanne 1 Million Lucky', 'Paco Rabanne Invictus Victory', 'Paco Rabanne Invictus Platinum', 'Paco Rabanne Invictus Aqua', 'Jean Paul Gaultier Scandal Pour Homme', 'Jean Paul Gaultier Le Male Elixir', 'Jean Paul Gaultier Le Male Le Parfum', 'Yves Saint Laurent Y Elixir', 'Yves Saint Laurent Myself EDP', 'Giorgio Armani Code Profumo', 'Giorgio Armani Acqua Di Gio Profumo', 'Dolce&Gabbana K EDT', 'Gucci Guilty Pour Homme', 'Hugo Boss Boss Bottled Intense'];
const WOMEN = ['Yves Saint Laurent Libre Intense', 'Carolina Herrera Good Girl', 'Parfums de Marly Delina Exclusif', 'Burberry Goddess', 'Yves Saint Laurent Libre', 'Chanel Coco Mademoiselle', "Dior J'adore", 'Viktor & Rolf Flowerbomb', 'Lancôme La Vie Est Belle', 'Parfums de Marly Delina', 'Valentino Donna Born in Roma', 'Valentino Donna Born In Roma Intense', 'Parfums de Marly Valaya', 'Yves Saint Laurent Black Opium Over Red', 'Carolina Herrera Very Good Girl', 'Jean Paul Gaultier Scandal Absolu Her', 'Jean Paul Gaultier La Belle', 'Paco Rabanne Fame', 'Dior Miss Dior (2026 Edition)', 'Chanel Chance Eau Tendre', 'Byredo Mojave Ghost', 'Gucci Flora Gorgeous Gardenia', 'Valentino Voce Viva', 'Mugler Angel Nova', 'Guerlain Idylle', 'Prada Paradox', 'Prada Paradoxe', 'Creed Queen Of Silk', 'Louis Vuitton Coeur Battant', 'Kayali Yum Pistachio Gelato', 'Kayali Vanilla Candy Rock Sugar 42', 'Kayali Lovefest Burning Cherry 48', 'Kayali Eden Sparkling Lychee 39', 'Kayali Eden Juicy Apple 01', 'Kayali Yum Boujee Marshmallow 81', 'Lancôme La Nuit Trésor', 'Yves Saint Laurent Libre Vanille Couture', 'Tom Ford Café Rose', 'Valentino Donna Noir Absolu', 'Gucci A Chant For The Nymph'];
const UNI = ['Maison Francis Kurkdjian Baccarat Rouge 540', "Kilian Angels' Share", 'Tom Ford Tobacco Vanille', 'Le Labo Santal 33', 'Tom Ford Oud Wood', 'Tom Ford Lost Cherry', 'Parfums de Marly Layton', 'Parfums de Marly Althair', 'Tom Ford Tuscan Leather', 'Tom Ford Neroli Portofino'];
const by = Object.fromEntries(dump.map((d) => [d.full, d]));
const BRANDS = [...new Set(JSON.parse(fs.readFileSync('data/fragrances.json', 'utf8')).map((f) => f.brand))].sort((a, b) => b.length - a.length);
const brandOf = (c) => BRANDS.find((b) => c.startsWith(b + ' ')) || c.split(' ')[0];
const mk = (list) => list.map((n) => {
  const d = by[n]; if (!d) throw new Error('missing original ' + n);
  const ps = [...d.pairs].sort((x, y) => (y.main ?? -1) - (x.main ?? -1) || (y.cn ? 1 : 0) - (x.cn ? 1 : 0) || (y.cimg ? 1 : 0) - (x.cimg ? 1 : 0));
  return { o: n, c: ps[0].c, g: d.g };
});
const Q = { M: mk(MEN), W: mk(WOMEN), U: mk(UNI) };
// interleave: M, W, M, W ... with a unisex slot every 9th; avoid the same clone house twice in a row
const order = [];
const pat = [];
for (let i = 0; Q.M.length + Q.W.length + Q.U.length > 0 && i < 1000; i++) {
  const want = i % 9 === 8 ? 'U' : i % 2 === 0 ? 'M' : 'W';
  const kinds = [want, 'M', 'W', 'U'].filter((k) => Q[k].length);
  if (!kinds.length) break;
  const k = kinds[0], last = order[order.length - 1];
  let idx = Q[k].findIndex((x) => !last || brandOf(x.c) !== brandOf(last.c));
  if (idx < 0) idx = 0;
  order.push(Q[k].splice(idx, 1)[0]);
}
const plan = order.map((x, i) => ({ o: x.o, c: x.c, at: new Date(start + i * 30 * 60000).toISOString() }));
fs.writeFileSync('data/article-plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.length, 'articles;', plan[0].at, '->', plan[plan.length - 1].at);
console.log(plan.slice(0, 12).map((p) => p.at.slice(11, 16) + ' ' + p.c + ' vs ' + p.o).join('\n'));
