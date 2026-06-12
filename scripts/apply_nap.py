#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COVERA · apply_nap.py
Quan tingueu les dades registrals definitives, executeu aquest script UNA VEGADA
des de l'arrel del projecte. Injecta telèfon, email, adreça i número DGSFP a:
  1. Tots els blocs JSON-LD (InsuranceAgency) de totes les pàgines HTML (CA i ES)
  2. Els placeholders visibles del footer ("[PENDENT — ...]" / "[PENDIENTE — ...]")

Exemple:
  python3 scripts/apply_nap.py \
    --dgsfp "J-0XXXX" \
    --phone "+34 93 000 00 00" \
    --email "hola@covera.es" \
    --street "Carrer Exemple 1, 2n" \
    --city "Barcelona" \
    --postal "08001" \
    --region "Barcelona"
"""
import re, glob, json, argparse, sys

p = argparse.ArgumentParser()
for a in ['dgsfp','phone','email','street','city','postal','region']:
    p.add_argument('--'+a, required=True)
args = p.parse_args()

ADDRESS = {"@type":"PostalAddress","streetAddress":args.street,"addressLocality":args.city,
           "postalCode":args.postal,"addressRegion":args.region,"addressCountry":"ES"}

files = glob.glob('*.html') + glob.glob('es/*.html')
touched = 0
for f in files:
    t = open(f, encoding='utf-8').read(); o = t

    # 1. Enrich every InsuranceAgency org node
    def enrich(m):
        try:
            data = json.loads(m.group(1))
        except Exception:
            return m.group(0)
        nodes = data.get('@graph', [data])
        for n in nodes:
            ty = n.get('@type')
            tys = ty if isinstance(ty, list) else [ty]
            if 'InsuranceAgency' in tys or 'LocalBusiness' in tys:
                n['telephone'] = args.phone
                n['email'] = args.email
                n['address'] = ADDRESS
                n['identifier'] = {"@type":"PropertyValue","propertyID":"DGSFP","value":args.dgsfp}
        return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'

    t = re.sub(r'<script type="application/ld\+json">(.*?)</script>', enrich, t, flags=re.S)

    # 2. Visible footer placeholders
    t = t.replace('[PENDENT — publicar abans del llançament]', args.dgsfp)
    t = t.replace('[PENDIENTE — publicar antes del lanzamiento]', args.dgsfp)

    if t != o:
        open(f, 'w', encoding='utf-8').write(t)
        touched += 1

print(f"NAP aplicat a {touched} pàgines. Recordeu actualitzar també la política de privacitat i l'avís legal.")
