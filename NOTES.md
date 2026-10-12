# NOTES

Fachliche Annahmen, Vereinfachungen und offene Punkte der App.
Normbezüge nur als Ziffern (EN 1992-1-1:2004 + AC:2010 + A1:2014,
SIA 262:2025, SIA 197:2023). D1–D7 sind Entscheide von Onur Koc.

## 1 Anwendungsbereich

- Querschnittsnachweis M-N von Spritzbetonschalen (Rechteckquerschnitt).
- Querschnittswiderstand ohne Effekte 2. Ordnung. Druckglieder mit
  Effekten 2. Ordnung sind nicht Gegenstand der App.
- Ausserhalb des Umfangs: Leichtbeton, Spannstahl, Umschnürung, Brand,
  Ermüdung.

## 2 Annahmen und Vereinfachungen

| Thema | Umsetzung | Beleg / Entscheid |
|---|---|---|
| Betonlinie EN | Parabel-Rechteck, n = 2, ε_c2 = 2 ‰, ε_cu2 = 3,5 ‰ | EN 3.1.7 (1), Tabelle 3.1 |
| Betonlinie SIA | Gl. (27) mit **k_σ = 2** (Parabel), ε_c1d = 2 ‰, ε_c2d = 3,5 ‰. **Bewusste Vereinfachung**: Nach Gl. (27) hängt k_σ von E_cd und f_cd ab. Mit k_σ = 2 gelten die geschlossenen Formeln, und der SIA-Modus bleibt mit dem EN-Modus vergleichbar. | SIA 262 4.2.1.5, 4.2.1.6, Figur 12, Tabelle 8 |
| f_cd EN | α_cc · f_ck / γ_c | EN 3.1.6 (1), Gl. (3.15) |
| f_cd SIA | η_fc · η_t · f_ck / γ_c, η_fc = (40 / f_ck)^(1/3) ≤ 1. η_t wird vom Benutzer gewählt (1,0 / 0,85 / 1,2), keine stille Vorgabe; Vorschlag 0,85. | SIA 262 2.4.2.3 Gl. (2), 4.2.1.2 Gl. (26), 4.2.1.3 |
| Unbewehrter Querschnitt (a_s1 = a_s2 = 0) | EN: α_cc,pl statt α_cc (Vorgabe 0,8). SIA: 0,8 · f_cd. Mit Bewehrung bleibt die Betonkurve eine Vergleichslinie mit normalem f_cd. Die Begrenzung der Lastausmitte nach EN 12.6.2 wird nicht geprüft. | EN 12.3.1 (1), 12.6.1 (2); SIA 262 0.1.8, 5.5.1.2; SIA 197 7.6.2.2; D7 |
| Betonzugfestigkeit | vernachlässigt | EN 6.1 (2)P; SIA 262 4.3.2 |
| Betonstahl | bilinear, ideal plastisch, E_s = 200 GPa, f_yd = f_yk / γ_s | EN 3.2.7 (2) b, 3.2.7 (4); SIA 262 2.4.2.5 Gl. (4), 3.2.2.4, 4.2.2.5, Figur 16 |
| Stahldehnungsgrenze | 12 ‰ in beiden Modi. **Zulässig, nicht normbegründet**: Bei horizontalem Ast verlangt keine der beiden Normen eine Grenze. | EN 3.2.7 (2) b, 6.1 (3); D3 |
| Dehnungsebenen | Drehpunkte A, B, C; C bei (1 − ε_c2/ε_cu2) · h | EN 6.1 (5), 6.1 (6), Bild 6.1; D2 |
| Drehpunkt C im SIA-Modus | **Konservative Annahme analog EN 1992-1-1 6.1 (5), nicht aus SIA 262.** SIA 262 regelt den Drehpunkt in 4.2.1 und 4.3.2 nicht. | D5 |
| Mindestausmitte | EN: e0 = h/30 ≥ 20 mm, auf die Lastpunkte angewendet. SIA: keine (die Regel 4.3.7.5 gilt nur für Druckglieder mit Effekten 2. Ordnung). | EN 6.1 (4); SIA 262 4.3.7.5; D1 |
| f_ck | höchstens 50 N/mm² (C50/60) in beiden Modi | EN Tabelle 3.1; D4 |
| Teilsicherheitsbeiwerte | γ_c = 1,5, γ_s = 1,15, editierbar | EN 2.4.2.4, Tabelle 2.1N; SIA 262 2.4.2.6 |

## 3 Hinweise

- **SIA 262 Tabelle 8, Rundung:** Die f_cd-Werte der Tabelle sind bis
  C25/30 auf 0,5 N/mm² gerundet (z. B. C25/30: Formel 16,67, Tabelle
  16,5), ab C30/37 auf 0,1 N/mm². Massgebend ist die Formel (Gl. (2)).
  Der Test vergleicht mit ±0,25 bzw. ±0,05 N/mm².

## 4 Stand der Umsetzung

Die Norm-Konfigurationen (`app/norms/`) und der Generator für die
Dehnungsebenen (`app/strain_planes.js`) sind vorhanden und getestet.
Das Rechenverhalten ist aber noch das von `legacy/core.py`:

- Dehnungsebenen: legacy-Array (Generator noch nicht Vorgabe).
- Mindestausmitte EN, α_cc < 0,85, unbewehrter Querschnitt, f_ck-Grenze:
  noch wie in `legacy/core.py` bzw. noch nicht angewendet.

Die Korrekturen folgen einzeln, je als eigener Commit. Die Liste der
Befunde (E1–E10, C1–C4, N1–N8) wird in Phase 3c hier ergänzt.
