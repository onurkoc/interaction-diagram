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

## 4 Befunde im ursprünglichen Python-Code

Die Befunde beziehen sich auf `legacy/` (Stand 2020). Sie sind Hinweise
aus der Durchsicht, keine nachgerechneten Ergebnisse. Der Port nach
JavaScript hat sie zuerst 1:1 übernommen; die Korrekturen stehen in
Abschnitt 5.

### 4.1 core.py gegen EN 1992-1-1 (empfohlene Werte, ohne NA)

| Nr | Code-Stelle | Ziffer EN | Befund | Bewertung |
|---|---|---|---|---|
| E1 | core.py: `min_ecc = min(h_ / 30, 0.02)` | 6.1 (4) | Norm: Mindestausmitte e0 = h/30 ≥ 20 mm, also der **grössere** Wert. Code nimmt den kleineren. README schreibt es richtig. | Fehler. Korrektur: `max(h_/30, 0.02)`. |
| E2 | core.py: `n_max = f_ck * b_ * d`, `m_min = min_ecc * n_max`; draw_diagram.py: senkrechte Linie bei M = ±m_min von N = 0 bis −n_max, Schnitt mit der Widerstandskurve | 6.1 (4) | Die Mindestausmitte bezieht sich auf die einwirkende Normalkraft (M ≥ e0·N). Der Code bildet stattdessen ein konstantes Moment aus e0 und einer Hilfsnormalkraft mit f_ck (charakteristisch, nicht f_cd), d statt h und ohne Bewehrung. Die daraus abgeleitete Kappung des Diagramms entspricht damit nicht der Regel. | Braucht Attention. Entscheid D1. |
| E3 | core.py: Dehnungszustände Zeilen 1–13 (`eps_c = −0.0035`, `eps_s1` von −0.003499 bis 0) | 6.1 (5), 6.1 (6), Bild 6.1 | Norm: Dehnungsebenen drehen im Druckbereich um Punkt C bei (1 − εc2/εcu2)·h; bei zentrischem Druck ist die Stauchung auf εc2 = 2 ‰ zu begrenzen. Der Code dreht weiter um B bis fast gleichmässig 3,5 ‰. Folge: Die Druckbewehrung erreicht im fast zentrischen Bereich höhere Dehnungen als nach Norm (bei B500 liegt ε_yd über 2 ‰), der Widerstand nahe reinem Druck wird voraussichtlich überschätzt (unsichere Seite). | Braucht Attention. Entscheid D2. |
| E4 | core.py: Stahldehnung fest begrenzt auf 0,012 (Zeilen 41–52) | 3.2.7 (2) b, 6.1 (3) | Bei horizontalem oberem Ast muss die Stahldehnung nicht begrenzt werden; ε_ud gilt nur «wo anwendbar» (ansteigender Ast, empfohlen 0,9·ε_uk). 0,012 ist kein Normwert. Die zugehörigen Ebenen mit εc < εcu2 liefern voraussichtlich kleinere Widerstände, also eher auf der sicheren Seite. | Zulässig, aber nicht normbegründet. Entscheid D3. |
| E5 | core.py: `if alpha_cc < 0.85: alpha_cc = 0.85` | 3.1.6 (1) mit Anm. | Norm: α_cc zwischen 0,8 und 1,0 (NDP), empfohlen 1,0. Der Code hebt Werte < 0,85 still auf 0,85 an und hat keine Obergrenze. Ein zulässiges α_cc = 0,8 wird damit ohne Hinweis zu 0,85. | Fehler (unsichere Seite). Eingabe nur 0,8–1,0 zulassen, ausserhalb mit Meldung ablehnen statt still korrigieren. |
| E6 | core.py: Parabel mit festen Konstanten (εc2 = 2 ‰, εcu2 = 3,5 ‰, n = 2) | 3.1.7 (1), Tabelle 3.1 | Die festen Werte gelten nach Tabelle 3.1 nur bis f_ck = 50 MPa. Darüber ändern sich εc2, εcu2 und n. Der Code prüft f_ck nicht. | Entscheid D4. |
| E7 | core.py: Vorgaben γ_c = 1,50, γ_s = 1,15 | 2.4.2.4, Tabelle 2.1N | Entspricht «ständig & vorübergehend». «Aussergewöhnlich»: 1,2 / 1,0. | In Ordnung. Optional als Auswahl anbieten. |
| E8 | core.py: `e_steel = 200000`, `f_yd = f_yk / gamma_s` | 3.2.7 (4), 3.2.7 (2) b | Entspricht der Norm. | In Ordnung. |
| E9 | core.py: Annahmen ebene Querschnitte, keine Betonzugfestigkeit, Verbund | 6.1 (2)P | Entspricht der Norm. | In Ordnung. |
| E10 | core.py: Kurve des unbewehrten Querschnitts mit demselben f_cd wie die bewehrte | EN 12.3.1 (1), 12.6.1 (2); SIA 262 0.1.8, 5.5.1.2; SIA 197 7.6.2.2 | Für unbewehrten Beton gelten in beiden Normen abgeminderte Festigkeiten. Die App verwendet die unbewehrte Kurve für CULT-I, wenn keine Bewehrung eingegeben ist. EN 12.6.2 verlangt zudem eine Begrenzung der Lastausmitte (wird nicht geprüft). | Entscheid D7. |

Hinweis zu k_σ: Die Form von SIA 262 Gl. (27) gibt es in EN 1992-1-1 als
Gl. (3.14) in 3.1.5, dort aber für nichtlineare Schnittgrössenermittlung
und Verformungen. Für die Querschnittsbemessung gilt 3.1.7
(Parabel-Rechteck mit n).

### 4.2 Weitere Befunde (nicht normbezogen)

| Nr | Stelle | Befund |
|---|---|---|
| C1 | cult_i.py | CULT-I wird immer gegen die ungekappte Widerstandskurve gerechnet, auch wenn die Mindestausmitte aktiv ist. |
| C2 | cult_i.py: `if cult_I is not str:` | Bedingung ist immer wahr (Vergleich mit dem Typ `str`). Gemeint war vermutlich `isinstance`. |
| C3 | cult_i.py, Zweig `m == 0`: `if max(limit_y) < n < min(limit_y)` | Kann nie wahr sein (max < min); ein Punkt ausserhalb wird bei m = 0 nie als «outside» erkannt. |
| C4 | core.py: Dehnungsarray | Von Hand eingetippt und unregelmässig (0,0046 fehlt, 0,012 mehrfach). |
| N1 | core.py: `alpha = a_s1 / a_s2`, Druckbewehrung = `alpha * a_s1` | Druckbewehrung = a_s1²/a_s2 statt a_s2. Ergebnisse nur bei a_s1 = a_s2 richtig. Bei a_s1 = 0 wird a_s2 ganz ignoriert. **Braucht Attention für alle früheren Auswertungen mit ungleicher Bewehrung.** |
| N2 | core.py: `moment_neg`, `moment_reinf_neg` | Negative Momentenseite ist die Spiegelung `-abs(M)` der positiven. Bei a_s1 ≠ a_s2 oder d_1 ≠ d_2 falsch. |
| N3 | cult_i.py: Wahl von `limit_x_neg` | Bei a_s1 ≠ 0 und a_s2 = 0 wird die Betonkurve (`Moment Neg`) mit den Normalkräften der bewehrten Kurve gepaart. |
| N4 | cult_i.py: `if m_rel_i < 0` bzw. `> 0` | Vergleich auf einem Array: Bei zwei Schnittpunkten auf der Horizontalen wirft Python einen ValueError, den App.py nicht abfängt. |
| N5 | core.py: Parameterprüfung | Steht in der Schleife, nach der Division durch `gamma_c`. `gamma_c = 0` gibt einen Absturz statt `None`. |
| N6 | draw_diagram.py: Legende | Zeigt f_cd = f_ck/γ_c ohne α_cc. |
| N7 | draw_diagram.py: Ausmitte-Linie | `min()` auf leerem Schnittpunkt-Array stürzt ab, wenn die Linie die Kurve nicht trifft. |
| N9 | cult_i.py: `min(abs(min(limit_y)) - abs(n), max(limit_y) - abs(n))` (Zweig m = 0 und Ersatzwert bei nur einem Schnittpunkt) | Der Abstand zur Zugseite wird als N_max − \|n\| gerechnet. Für Druck (n < 0) wäre der Abstand N_max − n = N_max + \|n\|. Stimmt nur, wenn N_max = 0 ist (unbewehrt). Mit Bewehrung wird der Wert negativ und geht quadriert in CULT-I ein. |
| N10 | cult_i.py: `n_rel_max` | Bei a_s1 = 0 die ganze Spanne der Normalkraft, sonst die halbe. Das Bild im README (aus der Publikation) zeigt N_rel,max als halbe Spanne. Die Regel hängt nur an a_s1, nicht an a_s2; ein gespiegelter Querschnitt gibt deshalb für den gespiegelten Lastpunkt ein anderes CULT-I. Nach der Skizze ist N_rel,max der Abstand von der Normalkraft bei M_max bis zum Ende der Kurve auf der Druckseite, also weder halbe noch ganze Spanne und ohne Unterscheidung nach a_s1. **Am Originalaufsatz geprüft (2026-10-13; Abschnitt 4, Bild 2, Gl. (4)):** (a) N_rel,max: Der Text nennt als Bezug den Punkt in der «Mitte» der Kurve, bei der Normalkraft, die zum grössten Moment gehört. Bild 2 misst N_rel,max von dieser Normalkraft bis zum Ende der Kurve auf der Druckseite. Der Code weicht ab (halbe bzw. ganze Spanne, abhängig von a_s1). Beide sind nur gleich, wenn M_max genau in der Mitte der Spanne liegt. (b) Richtung von N_rel,i: Bild 2 zeigt einen einzigen Punkt, auf der Druckseite der Mitte, mit N_rel,i zur Druckseite hin. Für Punkte auf der Zugseite der Mitte sagt der Aufsatz nichts. Der Code nimmt den nächsten Schnittpunkt in N-Richtung; das deckt sich mit dem gezeigten Fall und hält den Index im Bereich 0 bis 1 (Gl. (4)). Nicht belegbar, bleibt Annahme. (c) M_rel,max: Bild 2 zeigt eine symmetrische Kurve. Der Code nimmt das grösste Moment der positiven Seite auch für Punkte mit negativem Moment; bei a_s1 ≠ a_s2 im Aufsatz nicht geregelt. Entscheide und Umsetzung: Abschnitt 5. |
| N11 | cult_i.py, Zweig `m == 0`: `m_rel_i = m_rel_max` | Neu, beim Vergleich mit dem Aufsatz gefunden (2026-10-13). Bei m = 0 wird M_rel,i unabhängig von der Normalkraft gleich M_rel,max gesetzt. Nach Bild 2 ist M_rel,i der Abstand des Punktes zur Kurve in M-Richtung bei seiner Normalkraft N_i, bei m = 0 also das aufnehmbare Moment bei N_i; das ist nur bei der Normalkraft von M_max gleich M_rel,max. Folge: Sprung zwischen m = 0 und einem sehr kleinen m, und bei m = 0 ein zu grosses CULT-I (unsichere Seite). Die beiden anderen Zweige rechnen den Abstand über den Schnittpunkt. |
| N12 | cult_i.js: Prüfung «innerhalb» nur gegen die Kurve der eigenen Momentenseite | Neu, bei der Umsetzung von N10 gefunden (2026-10-13), nur bei unsymmetrischer Bewehrung (a_s1 ≠ a_s2 oder d_1 ≠ d_2). Dort liegen die Enden der Kurve nicht bei M = 0; nahe den Enden hat die Kurve der einen Seite Momente mit dem Vorzeichen der anderen Seite. Ein Punkt mit kleinem \|m\| nahe einem Ende kann deshalb ausserhalb der geschlossenen Kurve liegen, wird aber als innerhalb gerechnet, weil M_rel,i nur gegen die Kurve mit dem Vorzeichen von m geprüft wird. Für m = 0 ist das seit N11 richtig («outside»), für kleines m ≠ 0 nicht. Vorschlag: «innerhalb» gegen beide Seiten prüfen (Moment des Punktes zwischen den Momenten beider Seiten bei N_i). Zweiter Punkt: 0 ≤ CULT-I ≤ 1 folgt aus der Definition nur, wenn N_rel,max mindestens die halbe Spanne der Normalkraft ist (siehe N10 (b)); beim Querschnitt a_s1 = 5, a_s2 = 0 ist das auf der negativen Seite nicht erfüllt. |
| N13 | cult_i.py / cult_i.js: Gl. (4) des Aufsatzes, √((N_rel,i² + M_rel,i²) / (N_rel,max² + M_rel,max²)) | Die Gleichung addiert Quadrate von Normalkräften und von Momenten, also Grössen mit verschiedenen Einheiten (z. B. kN² und kNm²). Das Ergebnis hängt damit von der Wahl der Einheiten ab (z. B. kNm gegen kNcm), und der Anteil mit den grösseren Zahlen (in kN und kNm meist die Normalkraft) bestimmt den Index fast allein. |
| N8 | xls_read.py: Spaltensuche | Über `'n' in name` und `'m' in name`: Ein Kopf «Moment» trifft beide. Funktioniert nur mit den Köpfen `n` und `m`. |

## 5 Entscheide und Stand der Korrekturen

| Nr | Entscheid |
|---|---|
| D1 | Mindestausmitte EN 6.1 (4) auf die Lastpunkte anwenden, nicht auf die Widerstandskurve: M_Ed,mod = sign(M_Ed) · max(\|M_Ed\|, e0 · \|N_Ed\|), e0 = max(h/30; 20 mm), nur bei Druck; bei M_Ed = 0 beide Vorzeichen prüfen. CULT-I mit den modifizierten Lastpunkten. Die alte Kappung der Kurve entfällt. Nur im EN-Modus. |
| D2 | Dehnungsebenen nach Bild 6.1 (Drehpunkte A, B, C), C bei (1 − εc2/εcu2)·h. |
| D3 | Stahldehnungsgrenze 12 ‰ bleibt, horizontaler Ast. |
| D4 | f_ck ≤ 50 MPa in beiden Modi; Eingabe darüber mit Meldung ablehnen. |
| D5 | Drehpunkt C auch im SIA-Modus, als konservative Annahme analog EN. |
| D6 | Vergleich eines Querschnitts mit commercial program nach der Umsetzung. Bestanden, siehe Abschnitt 6. |
| D7 | Abminderung für unbewehrten Beton nur bei a_s1 = a_s2 = 0 (siehe Abschnitt 2). |

Reihenfolge der Korrekturen, je ein eigener Commit:

| Befund | Stand |
|---|---|
| E5 | umgesetzt: α_cc wird nicht mehr still auf 0,85 angehoben; Bereichsprüfung mit E6 |
| E1 | umgesetzt: e0 = max(h/30; 20 mm) |
| E6 (D4) | umgesetzt: `int_diagram()` lehnt f_ck > 50, α_cc ausserhalb 0,8–1,0 und unzulässiges η_t mit Fehler ab |
| E10 (D7) | umgesetzt im Rechenkern; Hinweis und Legende folgen mit der Oberfläche |
| N1 | umgesetzt: Druckbewehrung = a_s2 |
| E2 (D1), damit C1 und N7 | umgesetzt im Rechenkern (`min_eccentricity_moments`, `cult_I_min_eccentricity`); Strahl M = ±e0·N und Tabelle folgen mit der Oberfläche |
| E3 (D2, D5) + N2, damit C4 | umgesetzt: Dehnungsebenen mit Drehpunkten A, B, C bis reiner Zug in beiden Modi; negative Seite mit vertauschten Rollen gerechnet. commercial program-Vergleich (D6) bestanden, siehe Abschnitt 6. |
| C2 | erledigt mit dem Port: In `cult_i.js` ist das Ergebnis an dieser Stelle immer eine Zahl, die Typabfrage entfällt. Keine Änderung der Rechnung. |
| C3 | umgesetzt: Bei m = 0 ist ein Punkt jenseits von reinem Zug oder zentrischem Druck «outside» |
| N3 | umgesetzt: CULT-I verwendet auf beiden Seiten die bewehrte Kurve mit ihren eigenen Normalkräften |
| N4 | umgesetzt: Bei mehreren Schnittpunkten gilt der äusserste (M-Richtung) bzw. der nächste (N-Richtung), kein Abbruch mehr |
| N9 | umgesetzt: Abstand zu den Enden der Kurve = min(n − N_min; N_max − n) |
| N10 (a) | umgesetzt (Entscheid Onur 2026-10-13): N_rel,max = Abstand von der Normalkraft bei M_max bis zum Ende der Kurve auf der Druckseite, nach dem Aufsatz. Der Sonderfall a_s1 = 0 (ganze Spanne) entfällt. Bei mehreren Punkten mit gleichem M_max gilt der erste. Damit weicht CULT-I von `legacy/cult_i.py` ab; der Vergleich mit der Python-Referenz für CULT-I ist entfernt (Abschnitt 6). |
| N10 (b) | umgesetzt (Entscheid Onur 2026-10-13). **Eigene Annahme, nicht aus dem Aufsatz:** N_rel,i ist der Abstand in N-Richtung zum nächsten Punkt der Kurve, zur Druck- oder zur Zugseite. Der Aufsatz zeigt nur einen Punkt auf der Druckseite der Mitte. Die Rückfallregel `n_rel_i > n_rel_max → Abstand zu den Enden` ist entfernt. Sie griff nur bei unsymmetrischer Bewehrung: Dort liegen die Enden der Kurve nicht bei M = 0, und der Schnitt mit der Kurve der eigenen Momentenseite gibt für kleine \|m\| nur einen Punkt (den fernen). Ohne Ersatz ergab das CULT-I bis rund 1,9. Ersatz: Der Schnitt läuft durch beide Seiten, also durch die geschlossene Kurve. Für symmetrische Querschnitte ändert sich nichts. Folge der Annahme: Liegt M_max näher am Ende der Druckseite als an der Mitte der Spanne, kann N_rel,i grösser als N_rel,max werden und CULT-I über 1 liegen. |
| N10 (c) | umgesetzt (Entscheid Onur 2026-10-13). **Erweiterung über den Aufsatz hinaus** (dort nur eine symmetrische Kurve): M_rel,max und N_rel,max werden je Momentenseite bestimmt, beide aus demselben Ast. Für m > 0 aus der positiven Seite (grösstes Moment und seine Normalkraft), für m < 0 aus der negativen Seite. Für symmetrische Querschnitte ändert sich nichts. Ein gespiegelter Querschnitt gibt für den gespiegelten Lastpunkt jetzt dasselbe CULT-I. |
| N11 | umgesetzt (Entscheid Onur 2026-10-13): Bei m = 0 ist M_rel,i das Moment der Kurve bei der Normalkraft N_i. Es werden beide Seiten gerechnet, jede mit ihrem M_rel,max und N_rel,max; das kleinere CULT-I ist massgebend (so gelesen: «kleinerer Wert» = kleineres CULT-I; bei gleichen Bezugswerten dasselbe wie das kleinere M_rel,i). N_rel,i bei m = 0: nächster Punkt der geschlossenen Kurve, dazu die Enden der Kurve (N9), weil der Schnitt die Kurve dort bei symmetrischen Querschnitten nur berührt. Kein Sprung mehr zwischen m = 0 und sehr kleinem m. Bei unsymmetrischer Bewehrung ist m = 0 an den Enden der Kurve «outside», weil die Enden dort nicht bei M = 0 liegen. |
| N12 | umgesetzt (Entscheid Onur 2026-10-13): «innerhalb» heisst für jedes m, dass bei N = n das Moment zwischen den Momenten beider Seiten liegt (horizontaler Schnitt gegen beide Äste, kleinster Wert der negativen und grösster Wert der positiven Seite). Sonst «outside». Symmetrische Querschnitte unverändert. Der zweite Punkt bleibt als Eigenschaft der Annahme N10 (b) bestehen: 0 ≤ CULT-I ≤ 1 folgt nur, wenn N_rel,max mindestens die halbe Spanne ist; ein Wert über 1 wird nicht gekappt. |
| N13 | umgesetzt (Entscheid Onur 2026-10-13). **Abweichung von Gl. (4) des Aufsatzes:** CULT-I = √((N_rel,i / N_rel,max)² + (M_rel,i / M_rel,max)²) / √2. Jeder Abstand wird zuerst durch seinen Bezugswert geteilt; der Index ist damit von den Einheiten unabhängig, und Moment und Normalkraft gehen mit gleichem Gewicht ein. M_rel,i, N_rel,i, M_rel,max und N_rel,max sind unverändert (N10 bis N12). Das Zentrum der Kurve ergibt weiterhin 1, ein Punkt auf der Kurve 0. Werte über 1 werden nicht gekappt, sondern gezeigt und markiert. Die Zahlenwerte von CULT-I sind mit früheren Auswertungen und mit Gl. (4) nicht vergleichbar. |
| Ausnutzung radial | neu (Entscheid Onur 2026-10-13), `utilization.js`: Ausnutzung = \|S_d\| / \|R_d\| auf dem Strahl vom Ursprung durch den Lastpunkt, Schnitt mit der geschlossenen Kurve mit Bewehrung. Auf der Kurve 1, ausserhalb über 1 (nicht gekappt), im Ursprung 0. **Annahme: proportionale Laststeigerung von N und M.** Mit Mindestausmitte am geprüften Punkt (M_Ed,mod); bei M_Ed = 0 werden beide Vorzeichen gerechnet, der grössere Wert gilt. Nicht definiert, wenn der Ursprung nicht im Innern der Kurve liegt: beim unbewehrten Querschnitt endet die Kurve im Ursprung, dann keine Zahl, nur ein Hinweis. In der Oberfläche ein- und ausschaltbar (Vorgabe ein), CULT-I ebenso (Vorgabe aus). Innerhalb/ausserhalb wird immer bestimmt. Gedeckt durch Regel-Tests, kein Vergleich mit einer unabhängigen Quelle. |
| Sprachen | Oberfläche in Deutsch und Englisch (Phase 6b, 2026-10-13). Alle Texte stehen in `app/i18n.js`, eine Tabelle je Sprache; der Rechenkern meldet Fehler als Schlüssel mit Parametern (`TextError` in `app/errors.js`), nicht als fertigen Text. Das Dezimalzeichen der Ausgabe folgt der Sprache (DE Komma, EN Punkt), die Eingabe nimmt immer beides. Englische Fachbegriffe nach EN 1992-1-1; Normziffern sind in beiden Sprachen gleich. Diese Datei bleibt deutsch. |
| N5, N6 | umgesetzt mit der Oberfläche: `check_inputs` in `app.js` prüft alle Eingaben vor jeder Rechnung und lehnt Unzulässiges mit Meldung ab; die Legende zeigt das verwendete f_cd (aus `input_values`, inkl. α_cc bzw. η_fc · η_t und der Abminderung bei unbewehrtem Querschnitt) |
| Oberfläche | D1 (Strahl M = ±e0·N, Spalte M_Ed,mod, CULT-I mit dem modifizierten Punkt), D7 (Hinweis und Legende), D5, D3 und k_σ = 2 als Hinweise, η_t und γ_d als Pflichteingaben ohne Vorgabe. CULT-I mit den Zwischenwerten M_rel,i, N_rel,i, M_rel,max, N_rel,max in der Tabelle; Werte über 1 werden nicht gekappt, sondern markiert. |
| N8 | umgesetzt für Excel und Plaxis 2D: Spaltenköpfe «n» und «m» werden exakt erkannt (optional mit Einheit in eckigen Klammern). Die Einheit entscheidet über die Art der Tabelle: ohne Einheit, [kN], [kNm] = Schnittgrössen des Querschnitts; [kN/m], [kNm/m] = Plaxis, pro Meter. Unbekannte oder gemischte Einheiten werden abgelehnt (vorher wurde [kN/m] still als [kN] gelesen). Entscheide Onur (2026-10-13) für Plaxis: Spalten N und M der Phase, nicht die Umhüllenden N_min/N_max/M_min/M_max; Umrechnung mit der Querschnittsbreite (Wert · b, `section_forces` in `loads.js`); Vorzeichen von M wie in der Datei, N negativ = Druck; alle Zeilen werden gelesen, auch Knoten, die zu zwei Elementen gehören. |
| E4 | bleibt (D3) |

## 6 Tests und Referenzen

- **Python-Referenz** (`tests/reference/`): Werte aus dem unveränderten
  `legacy/core.py` für Querschnitte, bei denen der alte Code richtig
  rechnet (a_s1 = a_s2 > 0, d_1 = d_2, α_cc ≥ 0,85). Der Vergleich läuft
  mit dem alten Dehnungsarray als Option. Die Parametersätze zu den
  bekannten Fehlern (E5, E10, N1, N2) sind nach den Korrekturen entfernt.
  Für CULT-I gibt es seit N10 keinen Vergleich mit der Python-Referenz
  mehr (`tests/cult_i.test.js` entfernt): `legacy/cult_i.py` rechnet
  N_rel,max anders als der Aufsatz. Die CULT-I-Werte in
  `reference.json` bleiben als Stand des alten Codes stehen und werden
  nicht mehr gelesen. CULT-I ist nur durch Regel-Tests gedeckt, ein
  Zahlenvergleich mit einer unabhängigen Quelle fehlt.
- **Regel-Tests** (`tests/corrections.test.js`): je Korrektur ein Test, der
  nur prüft, was direkt aus der Regel folgt. Keine von der App
  gerechneten Erwartungswerte.
- **commercial program-Referenz** (`tests/commercial program.test.js`), Vergleich durch Onur Koc am
  2026-10-12, bestanden:
  - Querschnitt: h = 0,30 m, b = 1,0 m, C30/37, B500,
    a_s1 = a_s2 = 5,24 cm², d_1 = d_2 = 0,05 m; SIA 262, η_t = 1,0.
  - commercial program-Einstellungen: Beton Typ 2 (Parabel-Rechteck), γ_c = 1,5,
    γ_cE = 1,0, keine Abminderung, Kriechzahl 0, f_ct = 0;
    Grenzdehnungen ε_cu,c = −2,0 ‰, ε_cu,t = −3,5 ‰, ε_s1 = 12 ‰;
    Stahl ideal plastisch, γ_s = 1,15.
  - Geprüfte Punkte (N [kN] / M [kNm]): −6419,2 / 0; 455,7 / 0;
    −2496,8 / 259,9; 0 / 59,1. Ausnutzung in commercial program je 1,00.
  - Toleranz im Test: 1 % (commercial program gibt zwei Nachkommastellen aus).

Neue Referenzwerte kommen aus einem anerkannten Programm, nicht aus
dieser App.
