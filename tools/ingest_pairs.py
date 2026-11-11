#!/usr/bin/env python3
"""Bulk-add original/clone pairs from a text list.

Usage: python3 tools/ingest_pairs.py data/lists/batch-1.txt [--dry]

Each line: "<Original> - <Clone> - <NN>%"   (leading list numbers are ignored)
- New fragrances are added to data/fragrances.json as stubs (no notes, price "Not rated").
- The pair and its reported percentage are saved to data/pairs.json (deduped).
- Originals get a marketed gender from the GENDER rules below; clones are left blank.
No notes, prices or links are invented. Review the printed summary.
"""
import json, re, sys, unicodedata, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(ROOT, 'data', 'fragrances.json')
PR = os.path.join(ROOT, 'data', 'pairs.json')

# alias (lowercase, accent-free) -> canonical brand. Longest alias wins.
BRANDS = {
 'jpg': 'Jean Paul Gaultier', 'jean paul gaultier': 'Jean Paul Gaultier',
 'mfk': 'Maison Francis Kurkdjian', 'maison francis kurkdjian': 'Maison Francis Kurkdjian',
 'ysl': 'Yves Saint Laurent', 'yves saint laurent': 'Yves Saint Laurent',
 'parfums de marly': 'Parfums de Marly', 'pdm': 'Parfums de Marly',
 'giorgio armani': 'Giorgio Armani', 'armani': 'Giorgio Armani',
 'william penhaligons': 'Penhaligon\'s', 'penhaligons': "Penhaligon's",
 'stephane humbert lucas': 'Stéphane Humbert Lucas',
 'maison alhambra': 'Maison Alhambra', 'lattafa': 'Lattafa', 'armaf': 'Armaf', 'afnan': 'Afnan', 'zimaya': 'Zimaya',
 'fragrance world': 'Fragrance World', 'paris corner': 'Paris Corner', 'french avenue': 'French Avenue',
 'al haramain': 'Al Haramain', 'swiss arabian': 'Swiss Arabian', 'sapil': 'Sapil', 'khadlaj': 'Khadlaj',
 'rasasi': 'Rasasi', 'jo milano': 'Jo Milano', 'ministry of oud': 'Ministry of Oud', 'riiffs': 'Riiffs',
 'reyane tradition': 'Reyane Tradition', 'reyane': 'Reyane Tradition', 'volare': 'Volare', 'nusuk': 'Nusuk', 'king of kings': 'King of Kings',
 'borouj': 'Borouj', 'alexandria': 'Alexandria', 'flavia': 'Flavia', 'pendora milano': 'Pendora Milano',
 'milestone': 'Milestone', 'dossier': 'Dossier', 'zara': 'Zara', 'montblanc': 'Montblanc', 'emir': 'Emir',
 'rayhaan': 'Rayhaan', 'cuba': 'Cuba', 'mouj': 'Mouj', 'arabiyat': 'Arabiyat', 'maison asrar': 'Maison Asrar', 'the dua brand': 'The Dua Brand', 'dua brand': 'The Dua Brand', 'al wataniah': 'Al Wataniah',
 'emper': 'Emper', 'lumiere': 'Lumiere', 'bentley': 'Bentley', 'just jack': 'Just Jack', 'pink sugar': 'Aquolina',
 'gigglepuff': 'Gigglepuff', 'perry ellis': 'Perry Ellis', 'missoni': 'Missoni', 'ariana grande': 'Ariana Grande', 'paris corner': 'Paris Corner',
 'tom ford': 'Tom Ford', 'louis vuitton': 'Louis Vuitton', 'paco rabanne': 'Paco Rabanne', 'creed': 'Creed',
 'xerjoff': 'Xerjoff', 'mancera': 'Mancera', 'initio': 'Initio', 'valentino': 'Valentino', 'bond no 9': 'Bond No. 9',
 'dior': 'Dior', 'kayali': 'Kayali', 'amouage': 'Amouage', 'versace': 'Versace', 'carolina herrera': 'Carolina Herrera',
 'gucci': 'Gucci', 'nishane': 'Nishane', 'guerlain': 'Guerlain', 'dolcegabbana': 'Dolce&Gabbana', 'dolce&gabbana': 'Dolce&Gabbana',
 'mugler': 'Mugler', 'tiziana terenzi': 'Tiziana Terenzi', 'bvlgari': 'Bvlgari', 'hermes': 'Hermes', 'azzaro': 'Azzaro',
 'kilian': 'Kilian', 'bdk': 'BDK Parfums', 'clive christian': 'Clive Christian', 'hugo boss': 'Hugo Boss',
 'thameen': 'Thameen', 'kenzo': 'Kenzo', 'vilhelm parfumerie': 'Vilhelm Parfumerie', 'room 1015': 'Room 1015',
 'ex nihilo': 'Ex Nihilo', 'giardini di toscana': 'Giardini di Toscana', 'house of sillage': 'House of Sillage',
 'escentric molecules': 'Escentric Molecules', 'montale': 'Montale', 'goldfield & banks': 'Goldfield & Banks',
 'goldfield banks': 'Goldfield & Banks', 'matiere premiere': 'Matière Première', 'roja': 'Roja Parfums', 'prada': 'Prada',
 'orto parisi': 'Orto Parisi', 'shiseido': 'Shiseido', 'chanel': 'Chanel', 'burberry': 'Burberry', 'lancome': 'Lancôme',
 'sospiro': 'Sospiro', 'passion island': 'Passion Island', 'le labo': 'Le Labo', 'memo': 'Memo Paris',
 'maison margiela': 'Maison Margiela', 'majda bekkali': 'Majda Bekkali', 'ak france': 'AK France',
 'marc antoine barrois': 'Marc-Antoine Barrois', 'maison crivelli': 'Maison Crivelli', 'lacoste': 'Lacoste',
 'givenchy': 'Givenchy', 'bottega veneta': 'Bottega Veneta', 'arabian oud': 'Arabian Oud', 'penhaligon': "Penhaligon's", 'william penhaligon': "Penhaligon's",
 'azzaro': 'Azzaro', 'invictus': 'Paco Rabanne', 'aquolina': 'Aquolina',
 'acqua di gio': 'Giorgio Armani', 'bleu de chanel': 'Chanel',
}
KEEP = {'invictus', 'acqua di gio', 'bleu de chanel'}  # brand word is part of the product name
SPECIAL = {'pink sugar aquolina': ('Aquolina', 'Pink Sugar'), 'ani nishane': ('Nishane', 'Ani')}
SUFFIX_BY = re.compile(r'^(.*?)\s+by\s+(Kilian|Parfums de Marly)$', re.I)

# marketed gender for ORIGINALS (substring of normalized full name). First match wins; default Unisex.
WOMEN = ['voce viva', 'donna noir absolu', 'donna born in roma', 'libre intense', 'black opium', 'very good girl', 'good girl',
         'angel nova', 'burberry goddess', 'idylle', 'scandal absolu her', 'la belle', 'prada paradox', 'kayali', 'coeur battant',
         'valaya', 'delina exclusif', 'queen of silk', 'fame', 'a chant for the nymph', 'jour d hermes absolu', 'shiseido zen']
MEN = ['guilty pour homme', 'lndl', 'imagination', 'immensite', 'tom ford noir extreme', 'ultra male', 'scandal pour homme', 'le male', 'le beau', 'sauvage', 'dior homme', 'fahrenheit', 'one million',
       '1 million', 'invictus', 'phantom', 'the most wanted', 'stronger with you', 'versace eros', 'dylan blue', 'eau fraiche',
       'bleu de chanel', 'allure homme', 'acqua di gio', 'code profumo', 'gucci pour homme', 'bad boy', 'ch men', 'amen pure',
       'l homme', 'myself', 'yves saint laurent y ', 'bottled', 'kenzo homme', 'lacoste', 'dolce&gabbana k ', 'the one ', 'terre d hermes',
       'gentleman reserve', 'aqva pour homme', 'le gemme', 'sartorial', 'inimitable', 'aventus', 'green irish tweed', 'uomo born in roma',
       'herod', 'haltane', 'bottega veneta pour homme', 'interlude man',
       'jubilation', 'roja parfums apex', 'town & country', 
       ]

def strip(s):
    s = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in s if not unicodedata.combining(c))

def key(s):
    s = strip(s).lower().replace('’', "'").replace('‘', "'")
    s = re.sub(r"[^a-z0-9&]+", ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

BK = sorted(BRANDS.items(), key=lambda kv: -len(kv[0]))

def split(full):
    full = full.strip().replace('’', "'")
    m = SUFFIX_BY.match(full)
    if m:
        return BRANDS[key(m.group(2))], m.group(1).strip()
    m = re.match(r'^(\d+)\s+(Kayali)\s+(.*)$', full, re.I)  # "33 Kayali Yum Pistachio Gelato"
    if m:
        return 'Kayali', f'{m.group(3)} {m.group(1)}'
    k = key(full)
    if k in SPECIAL: return SPECIAL[k]
    for alias, brand in BK:
        a = alias.replace('&', ' ').strip() if '&' in alias and ' ' in alias else alias
        ak = key(alias)
        if k == ak or k.startswith(ak + ' '):
            words = len(ak.split())
            # remove the same number of words from the raw string
            raw = full.split()
            # handle aliases like "Dolce&Gabbana" (one raw word)
            n = 0 if alias in KEEP else len(alias.split())
            name = ' '.join(raw[n:]) if n <= len(raw) else ''
            if 'by' in alias: name = name
            return brand, name or full
    return None, full

def gender_for(brand, name):
    k = key(f'{brand} {name}')
    for g in WOMEN:
        if g in k: return 'Women'
    for g in MEN:
        if g in k: return 'Men'
    return 'Unisex'

def load(p, d):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else d

def main():
    src = sys.argv[1]; dry = '--dry' in sys.argv
    F = load(FR, []); P = load(PR, [])
    have = {key(f"{f['brand']} {f['name']}"): f for f in F}
    pairs = {(p['original'], p['clone']): p for p in P}
    added, fallback, newpairs = [], [], 0
    for raw in open(src, encoding='utf-8'):
        raw = re.sub(r'^\s*\d+\s+', '', raw.strip())
        if not raw: continue
        m = re.match(r'^(.*?)\s+-\s+(.*?)\s+-\s+(\d+)%$', raw)
        if not m: print('SKIP (cannot parse):', raw); continue
        o, c, pct = m.group(1), m.group(2), int(m.group(3))
        ent = []
        for role, txt in (('original', o), ('alternative', c)):
            brand, name = split(txt)
            if brand is None:
                brand, name = txt.split()[0], ' '.join(txt.split()[1:]) or txt
                fallback.append((txt, brand, name))
            k = key(f'{brand} {name}')
            if k not in have:
                f = {'name': name, 'brand': brand, 'role': role, 'year': 0, 'concentration': '',
                     'gender': gender_for(brand, name) if role == 'original' else '',
                     'size': '', 'tier': 'Not rated', 'top': [], 'heart': [], 'base': [], 'accords': [], 'season': [],
                     'notesNote': 'Published notes have not been added yet.'}
                F.append(f); have[k] = f; added.append((role, brand, name, f['gender']))
            ent.append(have[k])
        of, cf = ent
        ofull, cfull = f"{of['brand']} {of['name']}", f"{cf['brand']} {cf['name']}"
        if (ofull, cfull) not in pairs:
            pairs[(ofull, cfull)] = {'original': ofull, 'clone': cfull, 'pct': pct}; newpairs += 1
        else:
            pairs[(ofull, cfull)]['pct'] = pct
    print(f'{len(added)} new fragrances, {newpairs} new pairs, {len(pairs)} pairs total')
    if fallback:
        print('UNRECOGNIZED BRANDS (first word used as brand) -> review:')
        for t, b, n in fallback: print('  ', t, '=>', b, '|', n)
    if dry: return
    json.dump(F, open(FR, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    json.dump(list(pairs.values()), open(PR, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
