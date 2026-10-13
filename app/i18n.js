// @ts-check
/*
Texts of the interface, one table for each language.

A further language (e.g. French) is one more table in TEXTS with the same
keys; nothing else has to be changed. {name} in a text is replaced by a
parameter. Numbers are written with the decimal sign of the language; a
parameter [number, digits] is written with a fixed number of decimals.

English terms follow EN 1992-1-1 (design values, partial factor,
minimum eccentricity, plain concrete, Figure 6.1, ...). Clause numbers
are the same in all languages.
*/

/** @type {Object<string, Object<string, string>>} */
export const TEXTS = {
    de: {
        'decimal': ',',
        'language.name': 'Deutsch',

        // page
        'title': 'M-N-Interaktionsdiagramm',
        'landing.intro': 'Querschnittsnachweis für Stahlbeton-Rechteckquerschnitte (Spritzbetonschalen) mit Ausnutzung und CULT-I. Nicht für Druckglieder mit Effekten 2. Ordnung.',
        'landing.choose': 'Norm wählen',
        'landing.sia': 'f_cd mit η_fc und η_t, keine Mindestausmitte',
        'landing.en': 'ohne Nationalen Anhang (empfohlene Werte)',
        'norm.sia262.label': 'SIA 262:2025',
        'norm.en1992.label': 'EN 1992-1-1 ohne Nationalen Anhang (empfohlene Werte)',
        'header.change_norm': 'Norm wechseln',
        'footer.source': 'Quellcode',
        'validation.note': 'Stand der Validierung: Die Kurve mit Bewehrung ist mit commercial program verglichen, nur für SIA 262 und symmetrische Bewehrung (ein Querschnitt). EN 1992-1-1, unsymmetrische Bewehrung, unbewehrter Querschnitt, Ausnutzung radial und CULT-I sind nur durch Regel-Tests gedeckt.',

        // file
        'file.label': 'Excel-Datei mit den Lastpunkten hierher ziehen oder auswählen:',
        'file.choose': 'Datei auswählen',
        'file.remove': 'Lastpunkte entfernen',
        'file.help': 'Spalten N [kN] und M [kNm] oder Tabelle einer Platte aus Plaxis 2D mit N [kN/m] und M [kN m/m]; charakteristische oder Bemessungswerte, siehe Lastfaktor γ_d. Die Datei wird nur im Browser gelesen und nicht übertragen.',
        'file.only_xlsx': '«{name}»: Es werden nur Excel-Dateien (.xlsx) gelesen.',
        'file.read': '«{name}» gelesen: {count} Lastpunkte.',
        'file.read_plaxis': '«{name}» gelesen: {count} Lastpunkte (Plaxis, Werte pro Meter).',

        // inputs
        'section.legend': 'Querschnitt',
        'section.no_presets': 'Keine Vorgabewerte: alle Felder ausfüllen.',
        'section.sign': 'Positives Moment: Zug auf der Seite von a_s1.',
        'example.load': 'Beispiel laden',
        'example.loaded': 'Beispielwerte geladen –',
        'example.undo': 'Rückgängig',
        'example.note': 'Beispielwerte, nicht projektbezogen',
        'placeholder': 'z. B. {value}',
        'label.h_': 'Höhe h [m]',
        'label.b_': 'Breite b [m]',
        'label.a_s1': 'Bewehrung a_s1 [cm²]',
        'label.d_1': 'Achsabstand d_1 von a_s1 [m]',
        'label.a_s2': 'Bewehrung a_s2 [cm²]',
        'label.d_2': 'Achsabstand d_2 von a_s2 [m]',
        'materials.legend': 'Baustoffe',
        'materials.note': 'f_ck und f_yk ohne Vorgabe; γ_c und γ_s sind mit den Werten der Norm vorbelegt.',
        'label.f_ck': 'Beton f_ck [N/mm²] (bis 50)',
        'label.f_yk': 'Betonstahl f_yk [N/mm²]',
        // the term of each norm: SIA 262 1.2.3, EN 1992-1-1 2.4.2.4
        'label.gamma_c.sia262': 'Widerstandsbeiwert γ_c',
        'label.gamma_s.sia262': 'Widerstandsbeiwert γ_s',
        'label.gamma_c.en1992': 'Teilsicherheitsbeiwert γ_c',
        'label.gamma_s.en1992': 'Teilsicherheitsbeiwert γ_s',
        'label.alpha_cc': 'α_cc ({low} bis {high})',
        'label.alpha_cc_pl': 'α_cc,pl (nur unbewehrt, a_s1 = a_s2 = 0)',
        'label.eccentricity': 'Mindestausmitte e0 = max(h/30; 20 mm) auf die Lastpunkte anwenden (6.1 (4))',
        'eta_t.label': 'η_t (4.2.1.3), bitte wählen:',
        'eta_t.help': 'Vorschlag {suggestion}: Spritzbeton wird meist früh belastet. {impact} nur bei stossartiger Belastung.',
        'loads.legend': 'Lastpunkte',
        'label.gamma_d': 'Lastfaktor γ_d ({one}, wenn Bemessungswerte importiert werden)',
        'label.radial': 'Ausnutzung radial',
        'label.cult': 'CULT-I',

        // names of the inputs in the messages
        'name.h_': 'Höhe h',
        'name.b_': 'Breite b',
        'name.d_1': 'Achsabstand d_1',
        'name.d_2': 'Achsabstand d_2',
        'name.a_s1': 'Bewehrung a_s1',
        'name.a_s2': 'Bewehrung a_s2',
        'name.f_ck': 'f_ck',
        'name.f_yk': 'f_yk',
        'name.gamma_c': 'γ_c',
        'name.gamma_s': 'γ_s',
        'name.gamma_d': 'Lastfaktor γ_d',
        'name.alpha_cc': 'α_cc',
        'name.alpha_cc_pl': 'α_cc,pl',

        // check of the inputs
        'messages.enter_values': 'Querschnitt und Baustoffe eingeben, dann erscheint das Diagramm.',
        'check.missing': '{name} fehlt.',
        'check.gamma_d_missing': 'Lastfaktor γ_d fehlt (Pflichtfeld ohne Vorgabe; {one}, wenn Bemessungswerte importiert werden).',
        'check.eta_t_missing': 'η_t fehlt: bitte {a} / {b} / {c} wählen (SIA 262 4.2.1.3).',
        'check.not_a_number': '{name}: «{text}» ist keine Zahl.',
        'check.positive': '{name} = {value}: muss grösser als 0 sein.',
        'check.not_negative': '{name} = {value}: darf nicht negativ sein.',
        'check.below_height': '{name} = {value} m: muss kleiner als die Höhe h = {h} m sein.',
        'check.norm': '{norm}: {text}',
        'app.inputs_invalid': 'Die Eingaben sind unzulässig.',

        // norms and core
        'norm.f_ck_max': 'f_ck = {f_ck} N/mm²: nur bis {f_ck_max} N/mm² (C50/60) zulässig.',
        'norm.alpha_cc': 'alpha_cc = {alpha_cc}: zulässig ist {low} bis {high}.',
        'norm.eta_t': 'eta_t = {eta_t}: zulässig ist {a} / {b} / {c}.',
        'norm.eta_t_missing': 'SIA 262: eta_t fehlt (4.2.1.3), bitte {a} / {b} / {c} wählen.',
        'norm.note.second_order': 'Querschnittswiderstand ohne Effekte 2. Ordnung.',
        'norm.note.k_sigma': 'Betonlinie: Gl. (27) mit k_σ = 2 (Parabel), Vereinfachung.',
        'core.no_min_eccentricity': '{norm}: keine Mindestausmitte, die Option ist in diesem Modus nicht zulässig.',

        // reading the file
        'xls.unit_unknown_n': 'Spalte «{head}»: Die Einheit ist nicht bekannt. Zulässig sind [kN] und [kN/m].',
        'xls.unit_unknown_m': 'Spalte «{head}»: Die Einheit ist nicht bekannt. Zulässig sind [kNm] und [kNm/m].',
        'xls.not_a_number': 'Zeile {row}: «{cell}» ist keine Zahl. Zelle als Zahl formatieren.',
        'xls.empty_table': 'Die Tabelle ist leer.',
        'xls.column_twice': 'Die Spalte «{name}» kommt mehrfach vor.',
        'xls.column_missing': 'Die Spalte «{missing}» fehlt. Erwartet werden die Spaltenköpfe «n» und «m». Gefunden: {found}.',
        'xls.units_mixed': 'Die Einheiten passen nicht zusammen: «{n}» und «{m}». Entweder beide Spalten pro Meter oder keine.',
        'xls.value_missing': 'Zeile {row}: Ein Wert fehlt (n und m müssen beide angegeben sein).',
        'xls.no_values': 'Die Tabelle enthält keine Werte.',
        'loads.width': 'Die Breite b = {b} ist unzulässig (b > 0).',

        // diagram
        'axis.m': 'Moment M [kNm]',
        'axis.n': 'Normalkraft N [kN], Druck negativ',
        'draw.concrete_plain': 'Beton unbewehrt',
        'draw.f_cd_reduced': 'f_cd = {f_cd} N/mm² (abgemindert)',
        'draw.f_cd': 'f_cd = {f_cd} N/mm²',
        'draw.concrete_comparison': 'Beton ohne Bewehrung (Vergleich)',
        'draw.reinforced': 'Mit Bewehrung',
        'draw.min_eccentricity': 'Mindestausmitte M = ±e0·N',
        'draw.points_inside': 'Lastpunkte innerhalb: {count} von {total}',
        'draw.points_outside': 'Lastpunkte ausserhalb der Kurve: {count} von {total}',
        'draw.design_values': 'Bemessungswerte, γ_d = {gamma_d}',
        'draw.max_utilization': 'max. Ausnutzung radial: {value}',
        'draw.min_cult': 'min. CULT-I: {value}',
        'draw.points_moved': 'Lastpunkte mit Mindestausmitte',
        'draw.point': 'Punkt {number}',
        'draw.m_mod': 'M mit Mindestausmitte: {value} kNm',
        'draw.utilization': 'Ausnutzung radial: {value}',
        'draw.outside': 'ausserhalb der Kurve',
        'draw.cult': 'CULT-I: {value}',
        'cult.outside': 'ausserhalb',
        'colour.governing': 'blau durchgezogen',
        'colour.comparison': 'grau gestrichelt, dünn',
        'colour.ray': 'orange strichpunktiert',
        'colour.inside': 'grüne Punkte',
        'colour.outside': 'rote Punkte',
        'colour.moved': 'hohle Punkte',

        // table
        'table.nr': 'Nr.',
        'table.n': 'N_Ed [kN]',
        'table.m': 'M_Ed [kNm]',
        'table.m_mod': 'M_Ed,mod [kNm]',
        'table.utilization': 'Ausnutzung radial',
        'table.m_rel_i': 'M_rel,i [kNm]',
        'table.n_rel_i': 'N_rel,i [kN]',
        'table.m_rel_max': 'M_rel,max [kNm]',
        'table.n_rel_max': 'N_rel,max [kN]',
        'table.m_ratio': 'M_rel,i / M_rel,max',
        'table.n_ratio': 'N_rel,i / N_rel,max',
        'table.cult': 'CULT-I',
        'table.hint': 'Hinweis',
        'table.outside': 'Punkt ausserhalb der Kurve',
        'table.above': 'CULT-I > 1, siehe Hinweis',
        'table.sort': 'Sortieren',

        // summary
        'summary.points': '{total} Lastpunkte (Bemessungswerte): {inside} innerhalb, {outside} ausserhalb der Kurve.',
        'summary.max_inside': 'Grösste Ausnutzung radial der Punkte innerhalb: {value}.',
        'summary.max_all': 'Grösste Ausnutzung radial aller Punkte: {value}.',
        'summary.min_cult': 'Kleinstes CULT-I der Punkte innerhalb: {value}.',

        // hints below the diagram
        'hint.f_cd_sia': 'f_cd = η_fc · η_t · f_ck / γ_c = {eta_fc} · {eta_t} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.f_cd_sia_plain': 'f_cd = η_fc · η_t · f_ck / γ_c · {factor} = {eta_fc} · {eta_t} · {f_ck} / {gamma_c} · {factor} = {f_cd} N/mm²',
        'hint.f_cd_en': 'f_cd = α_cc · f_ck / γ_c = {alpha} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.f_cd_en_plain': 'f_cd = α_cc,pl · f_ck / γ_c = {alpha} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.plain_sia': 'Unbewehrter Querschnitt: f_cd abgemindert (SIA 197 7.6.2.2).',
        'hint.plain_en': 'Unbewehrter Querschnitt: f_cd abgemindert; Begrenzung der Lastausmitte (EN 12.6.2) wird nicht geprüft.',
        'hint.pivot_c': 'Drehpunkt C der Dehnungsebenen: konservative Annahme analog EN 1992-1-1 6.1 (5), nicht aus SIA 262.',
        'hint.steel': 'Betonstahl ideal plastisch, Stahldehnung auf {limit} ‰ begrenzt (zulässig, nicht normbegründet).',
        'hint.min_eccentricity': 'Mindestausmitte e0 = max(h/30; 20 mm) = {e0} mm (EN 1992-1-1 6.1 (4)): Lastpunkte mit Druck werden mit M_Ed,mod = max(|M_Ed|; e0·|N_Ed|) geprüft, bei M_Ed = 0 beide Vorzeichen. Die Widerstandskurve bleibt unverändert.',
        'hint.loads': 'Lastpunkte aus «{name}»: {count} Punkte, mit γ_d = {gamma_d} multipliziert.',
        'hint.per_metre': 'Plaxis-Tabelle mit Werten pro Meter [kN/m, kNm/m]: mit der Breite b = {b} m multipliziert.',
        'hint.sign': 'Vorzeichen: N negativ = Druck. Das Vorzeichen von M wird wie in der Datei übernommen, nichts wird umgekehrt. Positives M: Zug auf der Seite von a_s1 (Achsabstand d_1); negatives M: Zug auf der Seite von a_s2. Bei Plaxis hängt das Vorzeichen von M von der lokalen Achse der Platte ab; bei a_s1 ≠ a_s2 oder d_1 ≠ d_2 die Zuordnung prüfen.',
        'hint.radial_undefined': 'Ausnutzung radial bei unbewehrtem Querschnitt nicht definiert.',
        'hint.radial': 'Ausnutzung radial = |S_d| / |R_d| auf dem Strahl vom Ursprung durch den Lastpunkt: 1 = Punkt auf der Kurve, über 1 = ausserhalb (nicht gekappt).',
        'hint.radial_min_eccentricity': 'Ausnutzung radial mit Mindestausmitte: am geprüften Punkt (M_Ed,mod).',
        'hint.radial_assumption': 'Ausnutzung radial setzt proportionale Laststeigerung von N und M voraus.',
        'hint.cult': 'CULT-I ist ein Reserve-Index, keine Ausnutzung: 0 = Punkt auf der Kurve (Grenzzustand), grosse Werte = grosse Reserve; 1 entspricht dem Zentrum der Kurve (M = 0, Normalkraft des grössten Moments).',
        'hint.cult_above': 'CULT-I > 1 bei mindestens einem Punkt: N_rel,i ist grösser als N_rel,max. Der Wert wird nicht gekappt.',
    },

    en: {
        'decimal': '.',
        'language.name': 'English',

        // page
        'title': 'M-N interaction diagram',
        'landing.intro': 'Cross-section check of rectangular reinforced concrete sections (shotcrete linings) with utilization and CULT-I. Not for compression members with second order effects.',
        'landing.choose': 'Choose the code',
        'landing.sia': 'f_cd with η_fc and η_t, no minimum eccentricity',
        'landing.en': 'without National Annex (recommended values)',
        'norm.sia262.label': 'SIA 262:2025',
        'norm.en1992.label': 'EN 1992-1-1 without National Annex (recommended values)',
        'header.change_norm': 'Change code',
        'footer.source': 'Source code',
        'validation.note': 'Validation status: the curve with reinforcement was compared with commercial program, for SIA 262 and symmetric reinforcement only (one cross-section). EN 1992-1-1, asymmetric reinforcement, plain concrete, radial utilization and CULT-I are covered by rule tests only.',

        // file
        'file.label': 'Drop the Excel file with the load points here or choose it:',
        'file.choose': 'Choose file',
        'file.remove': 'Remove load points',
        'file.help': 'Columns N [kN] and M [kNm], or the table of a plate from Plaxis 2D with N [kN/m] and M [kN m/m]; characteristic or design values, see load factor γ_d. The file is read in the browser only and is not uploaded.',
        'file.only_xlsx': '«{name}»: only Excel files (.xlsx) are read.',
        'file.read': '«{name}» read: {count} load points.',
        'file.read_plaxis': '«{name}» read: {count} load points (Plaxis, values per metre).',

        // inputs
        'section.legend': 'Cross-section',
        'section.no_presets': 'No preset values: fill in all fields.',
        'section.sign': 'Positive moment: tension on the side of a_s1.',
        'example.load': 'Load example',
        'example.loaded': 'Example values loaded –',
        'example.undo': 'Undo',
        'example.note': 'Example values, not from a project',
        'placeholder': 'e.g. {value}',
        'label.h_': 'Height h [m]',
        'label.b_': 'Width b [m]',
        'label.a_s1': 'Reinforcement a_s1 [cm²]',
        'label.d_1': 'Axis distance d_1 of a_s1 [m]',
        'label.a_s2': 'Reinforcement a_s2 [cm²]',
        'label.d_2': 'Axis distance d_2 of a_s2 [m]',
        'materials.legend': 'Materials',
        'materials.note': 'f_ck and f_yk have no preset; γ_c and γ_s are preset with the values of the code.',
        'label.f_ck': 'Concrete f_ck [N/mm²] (up to 50)',
        'label.f_yk': 'Reinforcing steel f_yk [N/mm²]',
        // one English term for both norms (EN 1992-1-1 2.4.2.4)
        'label.gamma_c.sia262': 'Partial factor γ_c',
        'label.gamma_s.sia262': 'Partial factor γ_s',
        'label.gamma_c.en1992': 'Partial factor γ_c',
        'label.gamma_s.en1992': 'Partial factor γ_s',
        'label.alpha_cc': 'α_cc ({low} to {high})',
        'label.alpha_cc_pl': 'α_cc,pl (plain concrete only, a_s1 = a_s2 = 0)',
        'label.eccentricity': 'Apply the minimum eccentricity e0 = max(h/30; 20 mm) to the load points (6.1 (4))',
        'eta_t.label': 'η_t (4.2.1.3), please choose:',
        'eta_t.help': 'Suggestion {suggestion}: shotcrete is usually loaded early. {impact} for impact loading only.',
        'loads.legend': 'Load points',
        'label.gamma_d': 'Load factor γ_d ({one} if design values are imported)',
        'label.radial': 'Radial utilization',
        'label.cult': 'CULT-I',

        // names of the inputs in the messages
        'name.h_': 'Height h',
        'name.b_': 'Width b',
        'name.d_1': 'Axis distance d_1',
        'name.d_2': 'Axis distance d_2',
        'name.a_s1': 'Reinforcement a_s1',
        'name.a_s2': 'Reinforcement a_s2',
        'name.f_ck': 'f_ck',
        'name.f_yk': 'f_yk',
        'name.gamma_c': 'γ_c',
        'name.gamma_s': 'γ_s',
        'name.gamma_d': 'Load factor γ_d',
        'name.alpha_cc': 'α_cc',
        'name.alpha_cc_pl': 'α_cc,pl',

        // check of the inputs
        'messages.enter_values': 'Enter the cross-section and the materials, then the diagram appears.',
        'check.missing': '{name} is missing.',
        'check.gamma_d_missing': 'Load factor γ_d is missing (required, no preset; {one} if design values are imported).',
        'check.eta_t_missing': 'η_t is missing: please choose {a} / {b} / {c} (SIA 262 4.2.1.3).',
        'check.not_a_number': '{name}: «{text}» is not a number.',
        'check.positive': '{name} = {value}: has to be greater than 0.',
        'check.not_negative': '{name} = {value}: must not be negative.',
        'check.below_height': '{name} = {value} m: has to be smaller than the height h = {h} m.',
        'check.norm': '{norm}: {text}',
        'app.inputs_invalid': 'The input is not permitted.',

        // norms and core
        'norm.f_ck_max': 'f_ck = {f_ck} N/mm²: only up to {f_ck_max} N/mm² (C50/60) is permitted.',
        'norm.alpha_cc': 'alpha_cc = {alpha_cc}: {low} to {high} is permitted.',
        'norm.eta_t': 'eta_t = {eta_t}: {a} / {b} / {c} is permitted.',
        'norm.eta_t_missing': 'SIA 262: eta_t is missing (4.2.1.3), please choose {a} / {b} / {c}.',
        'norm.note.second_order': 'Cross-section resistance; second order effects not included.',
        'norm.note.k_sigma': 'Stress-strain relation of concrete: eq. (27) with k_σ = 2 (parabola), a simplification.',
        'core.no_min_eccentricity': '{norm}: no minimum eccentricity, the option is not permitted in this mode.',

        // reading the file
        'xls.unit_unknown_n': 'Column «{head}»: the unit is not known. Permitted are [kN] and [kN/m].',
        'xls.unit_unknown_m': 'Column «{head}»: the unit is not known. Permitted are [kNm] and [kNm/m].',
        'xls.not_a_number': 'Row {row}: «{cell}» is not a number. Format the cell as a number.',
        'xls.empty_table': 'The table is empty.',
        'xls.column_twice': 'The column «{name}» exists more than once.',
        'xls.column_missing': 'The column «{missing}» is missing. The column heads «n» and «m» are expected. Found: {found}.',
        'xls.units_mixed': 'The units do not fit together: «{n}» and «{m}». Either both columns per metre or none.',
        'xls.value_missing': 'Row {row}: a value is missing (n and m both have to be given).',
        'xls.no_values': 'The table has no values.',
        'loads.width': 'The width b = {b} is not permitted (b > 0).',

        // diagram
        'axis.m': 'Moment M [kNm]',
        'axis.n': 'Normal force N [kN], compression negative',
        'draw.concrete_plain': 'Plain concrete',
        'draw.f_cd_reduced': 'f_cd = {f_cd} N/mm² (reduced)',
        'draw.f_cd': 'f_cd = {f_cd} N/mm²',
        'draw.concrete_comparison': 'Concrete without reinforcement (comparison)',
        'draw.reinforced': 'With reinforcement',
        'draw.min_eccentricity': 'Minimum eccentricity M = ±e0·N',
        'draw.points_inside': 'Load points inside: {count} of {total}',
        'draw.points_outside': 'Load points outside of the curve: {count} of {total}',
        'draw.design_values': 'Design values, γ_d = {gamma_d}',
        'draw.max_utilization': 'max. radial utilization: {value}',
        'draw.min_cult': 'min. CULT-I: {value}',
        'draw.points_moved': 'Load points with minimum eccentricity',
        'draw.point': 'Point {number}',
        'draw.m_mod': 'M with minimum eccentricity: {value} kNm',
        'draw.utilization': 'Radial utilization: {value}',
        'draw.outside': 'outside of the curve',
        'draw.cult': 'CULT-I: {value}',
        'cult.outside': 'outside',
        'colour.governing': 'blue solid',
        'colour.comparison': 'grey dashed, thin',
        'colour.ray': 'orange dash-dotted',
        'colour.inside': 'green points',
        'colour.outside': 'red points',
        'colour.moved': 'hollow points',

        // table
        'table.nr': 'No.',
        'table.n': 'N_Ed [kN]',
        'table.m': 'M_Ed [kNm]',
        'table.m_mod': 'M_Ed,mod [kNm]',
        'table.utilization': 'Radial utilization',
        'table.m_rel_i': 'M_rel,i [kNm]',
        'table.n_rel_i': 'N_rel,i [kN]',
        'table.m_rel_max': 'M_rel,max [kNm]',
        'table.n_rel_max': 'N_rel,max [kN]',
        'table.m_ratio': 'M_rel,i / M_rel,max',
        'table.n_ratio': 'N_rel,i / N_rel,max',
        'table.cult': 'CULT-I',
        'table.hint': 'Note',
        'table.outside': 'Point outside of the curve',
        'table.above': 'CULT-I > 1, see note',
        'table.sort': 'Sort',

        // summary
        'summary.points': '{total} load points (design values): {inside} inside, {outside} outside of the curve.',
        'summary.max_inside': 'Largest radial utilization of the points inside: {value}.',
        'summary.max_all': 'Largest radial utilization of all points: {value}.',
        'summary.min_cult': 'Smallest CULT-I of the points inside: {value}.',

        // hints below the diagram
        'hint.f_cd_sia': 'f_cd = η_fc · η_t · f_ck / γ_c = {eta_fc} · {eta_t} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.f_cd_sia_plain': 'f_cd = η_fc · η_t · f_ck / γ_c · {factor} = {eta_fc} · {eta_t} · {f_ck} / {gamma_c} · {factor} = {f_cd} N/mm²',
        'hint.f_cd_en': 'f_cd = α_cc · f_ck / γ_c = {alpha} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.f_cd_en_plain': 'f_cd = α_cc,pl · f_ck / γ_c = {alpha} · {f_ck} / {gamma_c} = {f_cd} N/mm²',
        'hint.plain_sia': 'Plain concrete section: f_cd reduced (SIA 197 7.6.2.2).',
        'hint.plain_en': 'Plain concrete section: f_cd reduced; the limit of the eccentricity of the load (EN 12.6.2) is not checked.',
        'hint.pivot_c': 'Pivot point C of the strain distributions: conservative assumption by analogy with EN 1992-1-1 6.1 (5), not from SIA 262.',
        'hint.steel': 'Reinforcing steel ideal plastic, steel strain limited to {limit} ‰ (permitted, not required by the code).',
        'hint.min_eccentricity': 'Minimum eccentricity e0 = max(h/30; 20 mm) = {e0} mm (EN 1992-1-1 6.1 (4)): load points with compression are checked with M_Ed,mod = max(|M_Ed|; e0·|N_Ed|), for M_Ed = 0 with both signs. The resistance curve is not changed.',
        'hint.loads': 'Load points from «{name}»: {count} points, multiplied by γ_d = {gamma_d}.',
        'hint.per_metre': 'Plaxis table with values per metre [kN/m, kNm/m]: multiplied by the width b = {b} m.',
        'hint.sign': 'Signs: N negative = compression. The sign of M is taken from the file as it is, nothing is reversed. Positive M: tension on the side of a_s1 (axis distance d_1); negative M: tension on the side of a_s2. In Plaxis the sign of M depends on the local axis of the plate; with a_s1 ≠ a_s2 or d_1 ≠ d_2 check the assignment.',
        'hint.radial_undefined': 'Radial utilization is not defined for a plain concrete section.',
        'hint.radial': 'Radial utilization = |S_d| / |R_d| on the ray from the origin through the load point: 1 = point on the curve, above 1 = outside (not capped).',
        'hint.radial_min_eccentricity': 'Radial utilization with the minimum eccentricity: at the checked point (M_Ed,mod).',
        'hint.radial_assumption': 'The radial utilization assumes that N and M increase proportionally.',
        'hint.cult': 'CULT-I is a reserve index, not a utilization: 0 = point on the curve (limit state), large values = large reserve; 1 corresponds to the centre of the curve (M = 0, normal force of the largest moment).',
        'hint.cult_above': 'CULT-I > 1 for at least one point: N_rel,i is larger than N_rel,max. The value is not capped.',
    },
};

/** The languages of the interface, in the order of the switch. */
export const LANGUAGES = Object.keys(TEXTS);

/**
 * Language for a new visitor, from the language of the browser:
 * German for de, de-CH, ..., English for everything else.
 * @param {string | undefined | null} browser_language  navigator.language
 * @returns {string}
 */
export function default_language(browser_language) {
    return /^de\b/i.test(browser_language || '') ? 'de' : 'en';
}

/**
 * Function that gives the text of a key in one language, with helpers
 * for numbers.
 * @typedef {((key: string, params?: Object<string, any>) => string) & {
 *     lang: string,
 *     decimal: string,
 *     num: (x: number | undefined) => string,
 *     fmt: (x: number, digits: number) => string,
 * }} Translator
 */

/**
 * @param {string} lang  a key of TEXTS
 * @returns {Translator}
 */
export function translator(lang) {
    const table = TEXTS[lang];
    if (table === undefined) {
        throw new Error(`i18n: no table for the language «${lang}»`);
    }
    const decimal = table['decimal'];
    /**
     * Number as it was entered, with the decimal sign of the language.
     * @param {number | undefined} x
     * @returns {string}
     */
    const num = (x) => String(x).replace('.', decimal);
    /**
     * Number with a fixed number of decimals, like '{:.2f}'.format(x).
     * @param {number} x
     * @param {number} digits
     * @returns {string}
     */
    const fmt = (x, digits) => x.toFixed(digits).replace('.', decimal);
    /**
     * @param {string} key
     * @param {Object<string, any>} [params]
     * @returns {string}
     */
    const text = (key, params = {}) => {
        const template = table[key];
        if (template === undefined) {
            throw new Error(`i18n: no text for «${key}» (${lang})`);
        }
        return template.replace(/\{(\w+)\}/g, (_, name) => {
            const value = params[name];
            if (Array.isArray(value)) {
                // [number, digits]: with a fixed number of decimals
                return fmt(value[0], value[1]);
            }
            return (typeof value === 'number') ? num(value) : String(value);
        });
    };
    return Object.assign(text, { lang: lang, decimal: decimal, num: num, fmt: fmt });
}
