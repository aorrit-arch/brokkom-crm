# COVERA · Revisió de disseny i estètica
*12 juny 2026 — sobre el codi de Cov3ra-main*

## Veredicte general

La web té **dos sistemes de disseny diferents conviuen sense saber-ho l'un de l'altre**, i aquesta és la decisió estètica més important que cal prendre. Tota la resta són ajustos.

## El problema central: dues webs en una

**Plantilla A — "corporativa"** (index, empreses, totes les fitxes de producte, campanyes):
Montserrat + Inter, cobalt + menta + arena, navegació clàssica, hero amb CTA, formularis. **Segueix exactament el manual de marca.** És neta, professional i transmet el que una corredoria ha de transmetre: solidesa.

**Plantilla B — "explorador de fitxers"** (persones, autonoms, socis-directius, activitats-entitats, capitals-futur, glossari, manifest, estalvi-invisible, diagnostic, inici):
Fraunces (serif editorial) + JetBrains Mono, metàfora d'IDE/explorador: ruta `INICI » SEGMENT »`, "Diagnòstic.app", "Cotitzador.app", "llegeix-me.md", "Glossari filosòfic", hashtags com a navegació. És una idea creativa **molt** original i ben executada.

**Per què és un problema:** un gerent entra per la home (plantilla A, sòlida), clica "Autònoms" al menú... i aterra en una pàgina que sembla un editor de codi, amb una altra tipografia, una altra estructura i un altre to. El viatge es trenca just al moment de la decisió. A més, la plantilla B no usa ni Montserrat ni la jerarquia del manual de marca, i la metàfora tècnica (fitxers .md, .app) parla a un públic digital/maker, no al director de RRHH d'una pime de transport ni a una família amb hipoteca.

**Recomanació:** la plantilla A és la web. La plantilla B és massa bona per llençar-la: convertiu-la en una **secció diferenciada i conscient** — "Els documents COVERA" o el "Manifest" com a peça de marca (una sola pàgina-experiència, enllaçada des de Sobre COVERA), i migreu persones/autonoms/socis-directius/activitats a la plantilla A reutilitzant l'estructura del nou empreses.html (hero → dades → mapa de solucions → mètode → FAQ → formulari). És la feina de disseny amb més impacte comercial pendent.

## El que ja està molt bé (no tocar)

- La paleta s'aplica amb disciplina a la plantilla A: cobalt per a fons d'autoritat, menta només per a accents i CTAs, arena com a fons de lectura. Contrast text/fons correcte.
- El nou empreses.html és la millor pàgina del lloc: ritme de seccions, taules comparatives reals, calculadora, FAQ. **És la plantilla de referència per a tota la resta.**
- Botons amb jerarquia clara (primari menta ple / secundari contorn).
- Formularis curts amb microcopy de confiança ("sense compromís", "24h").

## Ajustos menors recomanats (plantilla A)

1. **Emojis com a icones** (👨‍👩‍👧 💼 🏢 🤝 a la home, ⚠️ a fitxes): en B2B resten serietat i es renderitzen diferent a cada sistema. Substituir per icones SVG de línia en cobalt/menta (estil Lucide/Feather, traç 1.5px) — coherent amb la geometria del logo C3.
2. **Densitat del hero de la home:** hi ha 4 badges de confiança + 2 CTAs + 4 targetes; en mòbil queda llarg abans del primer scroll significatiu. Valorar reduir badges a 3.
3. **CSS duplicat:** cada fitxa porta el seu `<style>` inline complet (~7KB repetits per 30+ pàgines). Funciona, però qualsevol canvi de marca s'ha de fer 30 vegades. Extreure a un `covera.css` compartit quan es faci la migració de plantilles.
4. **Footer de fitxes massa nu:** només "COVERA · Corredoria... · Avís legal · Privacitat". Hi falta el que dona confiança: DGSFP (quan hi sigui), contacte, i 3-4 enllaços de navegació. El footer del nou empreses.html és el bo; replicar-lo.
5. **Microinteraccions:** les targetes del nou hub tenen hover amb elevació; les fitxes antigues no en tenen. Unificar (transform + ombra suau, 150ms).
6. **Accessibilitat:** falta `:focus-visible` als botons i enllaços (navegació per teclat); el text menta sobre arena en algunes etiquetes petites queda just de contrast (AA limit) — usar cobalt per a text petit i reservar menta per a elements grans.

## Fotografia / imatge

Ara mateix no hi ha cap fotografia humana. Per a una marca que diu "protegim persones", una sola imatge ben triada per secció (persones reals, llum natural, gens d'stock de gent donant-se la mà) al hero de cada segment marcaria la diferència. Alternativa low-cost coherent amb la identitat: il·lustracions geomètriques derivades del símbol C3 (cercles encadenats) com a patró de secció.

## Prioritat suggerida

1. Migrar persones/autonoms/socis-directius/activitats a la plantilla A (impacte comercial directe).
2. Footer complet + dades registrals a tot arreu.
3. Substituir emojis per SVG.
4. CSS compartit + focus-visible.
5. El Manifest com a peça única de marca (plantilla B, conscientment).
