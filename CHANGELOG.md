# CHANGELOG — Actualització SEO/GEO + versió ES · 12 juny 2026

## 1. Domini unificat
- **Problema:** els canonical, Open Graph i Schema apuntaven a `covera.com`, però el sitemap.xml, el robots.txt i l'app.js usaven `covera.es`. Aquest conflicte confon Google.
- **Fet:** tot unificat a **https://covera.es** (44 pàgines). Si finalment el domini és covera.com, un cerca-i-substitueix global ho reverteix.

## 2. Imatge Open Graph
- **Problema:** `assets/og-covera.jpg` estava referenciada 43 vegades però **no existia** → previsualització trencada a LinkedIn, WhatsApp i Twitter.
- **Fet:** generada (1200×630, identitat de marca: cobalt + menta, Montserrat, logo reverse, claim). El logo del Schema (`logo.svg`, inexistent) ara apunta a `assets/logo-horitzontal.png`.

## 3. Versió en castellà (clúster B2B prioritari)
Pàgines noves a `/es/`:
- `es/index.html` — landing ES amb entrades al clúster d'empreses
- `es/empresas.html` — hub complet (dades Espanya vs Europa, taula PPE/PPSE, RF vs benefici social, LTI, calculadora, FAQ, col·laboradors, formulari)
- `es/compromisos-pensiones.html` · `es/retribucion-flexible.html` · `es/beneficio-social.html` · `es/salud-colectiva.html` · `es/accidentes-convenio.html`

Cada pàgina ES té: `lang="es"`, canonical propi, OG/Twitter en castellà, JSON-LD `inLanguage:es`, i enllaços interns resolts (a la versió ES si existeix; a la CA amb `../` si encara no).

## 4. hreflang real i selector d'idioma funcional
- Trio `ca / es / x-default` afegit a les 6 pàgines CA del clúster i a totes les ES (la home i empreses ja en tenien; ara són recíprocs i amb el domini correcte).
- El botó **CA/ES de les fitxes era cosmètic** (només traduïa 2 etiquetes per JavaScript). Ara és un **enllaç real** a la versió de l'altre idioma → indexable i funcional. El codi JS mort (`setLang`) s'ha eliminat de 12 pàgines.
- La home manté el seu sistema de traducció client-side (que ja era complet) i ara el seu hreflang `es` apunta a una pàgina real.

## 5. GEO (optimització per a motors generatius)
- **Definicions directes** afegides a la primera frase del subtítol de 4 fitxes B2B ("Un compromís per pensions és...", "La retribució flexible és...", etc.). La de salut ja en tenia.
- **FAQPage JSON-LD + secció FAQ visible** (3 preguntes, accordion natiu `<details>`, sense JS) a les 5 fitxes B2B, en català i en castellà. Inclou les preguntes que la gent fa als LLMs: "diferència PPE vs PPSE", "RF vs benefici social", "l'assegurança de conveni és obligatòria?".

## 6. Afirmació "cost 0" del PPE matisada (home + campanya)
- **27 ocurrències** corregides a index.html (HTML, diccionaris JS català i castellà, i FAQ JSON-LD):
  - "PPE cost 0" → "PPE empreses" (xips i targetes)
  - "pot tenir cost zero" → "pot tenir un cost net mínim"
  - "Deducció fiscal que compensa pràcticament tota l'aportació" → "Deducció fiscal i estalvi en cotitzacions que poden compensar gran part de l'aportació"
  - Resposta FAQ: "Sí." → "Depèn del cas."
- Motiu: prometre avantatge fiscal absolut és l'Error 3 del vostre propi document d'estratègia i un risc davant la DGSFP. La pàgina d'empreses ja tenia la redacció prudent correcta; ara la home hi és coherent.

## 7. Sitemap regenerat
49 URLs (totes les CA + les 6 ES + landing ES), domini covera.es, `lastmod` 2026-06-12 i prioritats per tipus de pàgina.

## 8. Eina per a les dades registrals — `scripts/apply_nap.py`
Quan tingueu el número DGSFP, telèfon, email i adreça definitius, una sola ordre els injecta a tots els JSON-LD (camp `telephone`, `email`, `address`, `identifier` DGSFP) i substitueix els placeholders visibles del footer. Instruccions dins del fitxer.

## Pendent (per ordre de prioritat)
1. **Dades registrals reals** (executar apply_nap.py) — és el forat de credibilitat núm. 1.
2. Pàgina "Qui som" amb persones reals.
3. Versió ES de la resta de pàgines (ppe.html, autonoms, persones, productes...).
4. Unificació de plantilla de les pàgines "explorer" (vegeu REVISIO_DISSENY.md).
5. Connectar els formularis a un backend real (ara només mostren confirmació visual).

---

# v2 — Reforma estètica · 12 juny 2026 (tarda)

## 1. Logos reals a tota la web
- **Home:** el nav i el footer portaven el logo **incrustat en base64** (un JPEG mal declarat com a PNG, ~70KB). Substituït pels fitxers oficials (`logo-horitzontal.png` al nav blanc, `logo-reverse.png` al footer fosc). La home passa de 105KB a ~58KB.
- **34 pàgines** (fitxes CA i ES): el "C3" fals fet amb text SVG substituït per `logo-reverse.png` al nav i `isotip-reverse.png` al footer.

## 2. Secció "Altres opcions vs COVERA" (el ratllat)
El text ratllat amb opacitat 70% a 13px era il·legible. Ara: columna esquerra en gris amb prefix ✕, fletxa menta al mig, columna COVERA en cobalt negreta amb prefix ✓, a 14px. Mateix HTML i mateixos ids (el sistema d'idiomes no es toca).

## 3. Protecció 360° (nou component visual)
Roda SVG interactiva a la home: 5 eixos (Salut · Ingressos · Família · Futur · Equip), cada segment és un enllaç a la seva secció, hover en menta, isotip C3 al centre. Bilingüe (s'integra amb el selector CA/ES existent amb un sol canvi d'una línia al setLang). Versió ES estàtica afegida a `es/index.html`. Sense JavaScript propi: tot CSS + SVG.

## 4. Estètica unificada: adeu a les "dues webs"
Les 6 pàgines amb plantilla "explorador de fitxers" (Fraunces + JetBrains Mono) reconstruïdes sobre la plantilla corporativa del manual de marca (Montserrat + Inter, cobalt/menta/arena):
- `persones.html` (6 situacions amb enllaços a fitxes)
- `autonoms.html` (5 situacions)
- `socis-directius.html` (5 situacions)
- `capitals-futur.html` (5 situacions, amb la frase de prudència fiscal)
- `activitats-entitats.html` (5 situacions + **cotitzador propi**: activitat, dates, participants, menors, RC — sense demanar dades de menors)
- `diagnostic.html` (les 5 preguntes originals en formulari corporatiu d'una pàgina, RGPD conservat)

Totes amb: hero cobalt, targetes amb hover, xips d'enllaç a producte, banda CTA, footer complet amb placeholder DGSFP, `focus-visible` per a teclat, i SEO complet (canonical, OG, JSON-LD).

Les pàgines "document" (manifest, glossari, estalvi-invisible, inici) es mantenen amb el seu estil propi com a secció de marca conscient, segons REVISIO_DISSENY.md.

## 5. Emojis → icones SVG
Els 4 emojis de segment de la home (👨‍👩‍👧 💼 🏢 🤝) i el ⚠️ d'accidents de conveni (CA i ES) substituïts per icones de línia SVG en cobalt amb detall menta, coherents amb la geometria del logo.
