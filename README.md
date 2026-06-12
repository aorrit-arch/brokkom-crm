# COVERA — Lloc web v0.4

> Primer ordenem. Després assegurem.

## Novetats v0.4

— **Logos oficials d'alta resolució** integrats al projecte tal com han estat dissenyats — sense reconstrucció ni aproximació SVG.
— **Quatre versions de logo** disponibles als assets: isotip, horitzontal, apilat, i reverse sobre fons fosc.
— **Splash usa el logo apilat oficial** directament en lloc de combinar isotip i text Montserrat aproximat.
— **Favicon refet** des de l'isotip-reverse oficial extret de la versió professional.

## Canvis v0.3

— **Logo oficial PNG**: substituïts els SVGs aproximats pels arxius PNG reals processats des dels assets del manual (isotip + wordmark + favicon amb fons cobalt versió app-icon).
— **Versió reversa generada automàticament** per al sidebar fosc: C convertida a brisa, 3 conservat en menta, antialiasing preservat.
— **Favicon real**: quadrat cobalt amb C3 invertit, 512×512 + 192×192 per a Apple touch icon.

## Canvis v0.2

— **Logo C3 refet** d'acord amb el manual oficial: proporcions, gruix de traç i geometria de l'arc revisats. SVG escalable, no PNG.
— **Wordmark COVERA** amb la "Ǝ" del mig real: `transform: scaleX(-1)` sobre la E, accessible com a "COVERA" per a screen readers i SEO.
— **Tres assets SVG** independents: `isotip.svg` (fons clar), `isotip-reverse.svg` (fons fosc), `favicon.svg` (versió app-icon amb fons cobalt segons manual).
— **Paleta amb noms oficials** del manual com a comentaris CSS (Azul cobalto, Menta suave, Brisa, Arena, Azul niebla, Gris profundo).

## Estructura

```
/
├── index.html              ← Splash inicial (porta d'entrada)
├── inici.html              ← Home amb sis carpetes i mètode
│
├── persones.html           ← Segment Persones i famílies (6 situacions)
├── autonoms.html           ← Segment Autònoms (5 situacions)
├── empreses.html           ← Segment Empreses (5 situacions)
├── activitats-entitats.html ← Segment Activitats i entitats (5 situacions)
├── socis-directius.html    ← Segment Socis i directius (5 situacions)
├── capitals-futur.html     ← Segment Capitals i futur (5 situacions)
│
├── glossari.html           ← Glossari filosòfic (19 productes)
├── estalvi-invisible.html  ← Article ancla
├── manifest.html           ← Mètode COVERA
├── diagnostic.html         ← Formulari de diagnòstic (5 preguntes)
│
├── sitemap.xml
├── robots.txt
│
└── assets/
    ├── style.css           ← Stylesheet principal (variables, components)
    ├── script.js           ← Interaccions mínimes (form, reveal, idioma)
    ├── isotip.svg          ← Logo C3 per a fons clar
    ├── isotip-reverse.svg  ← Logo C3 per a fons fosc (sidebar)
    └── favicon.svg         ← Favicon / app icon
```

## Identitat

— **Paleta:** Cobalt #0A2D56 · Menta #6FB7AE · Brisa #E6F2EF · Arena #F7F3EF · Boira #8FA3B3 · Grafit #2B2F33
— **Tipografia:** Montserrat (display) + Inter (body) + Fraunces (serif d'autor) + JetBrains Mono (tècnic)
— **Direcció estètica:** editorial-tècnic amb sabor de sistema operatiu

## Per pujar

### Opció A — Netlify / Vercel (recomanat)
1. Comprimir aquest directori en .zip
2. Arrossegar a netlify.com/drop (o equivalent Vercel)
3. Apuntar el domini covera.es als servidors

### Opció B — Hosting tradicional (FTP)
1. Pujar tot el contingut del directori a `public_html/` (o equivalent)
2. Assegurar que `index.html` és el fitxer per defecte
3. Verificar que `/assets/` queda accessible

### Opció C — GitHub Pages
1. Crear repositori, pujar tot el contingut
2. Activar Pages a Settings → Pages → main branch → root
3. Domini covera.es via CNAME

## Pendents abans de producció

Crítics (no publicar sense):
— [ ] Substituir `DGSFP J-XXXX · dades pendents` pels números reals a tots els footers
— [ ] Crear `avis-legal.html`, `politica-privacitat.html`, `cookies.html` amb dades reals de corredoria
— [ ] Activar gestió real del formulari de diagnòstic (ara la submissió és client-side)
— [ ] Triar gestor d'emails / CRM destí del formulari
— [ ] Revisar política de cookies AEPD si s'afegeix analytics

Recomanables:
— [ ] Versió castellà (`/es/...`) amb hreflang
— [ ] Dades estructurades JSON-LD (Organization, InsuranceAgency)
— [ ] Open Graph images personalitzades
— [ ] Pàgines per cada hashtag (fitxes de producte → dossiers comercials PDF)
— [ ] Cotitzador real per a /activitats-entitats/

## Funcionalitats actuals

— Splash → Inici → Sis carpetes → Diagnòstic
— Navegació esquerra fixa amb sidebar
— Hashtags clicables que porten al glossari
— Formulari diagnòstic amb validació mínima (consentiment obligatori)
— Responsive (sidebar oculta a <900px, ajusts a <600px)
— Reveal subtil en scroll
— Tipografies Google Fonts amb display=swap

## Notes tècniques

— No depèn de cap framework
— No requereix build
— No fa servir tracking ni analytics (per evitar requisits de cookies abans de producció)
— Tot el contingut és estàtic, indexable per cercadors i IA
— Compatible amb hostings més simples (incloent FTP tradicional)
