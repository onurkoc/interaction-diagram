// @ts-check
/*
Figure of the interaction diagram for Plotly
Port of legacy/draw_diagram.py.

figure() only builds the data and the layout, so it can be tested
without a browser. draw() hands them to Plotly.
*/

/** @typedef {import('./core.js').InputValues} InputValues */
/** @typedef {import('./core.js').Values} Values */
/** @typedef {import('./norms/en1992.js').Norm} Norm */
/** @typedef {import('./cult_i.js').CultIDetails} CultIDetails */

/**
 * The part of the Plotly library (vendor/plotly-basic.min.js) that is
 * used here. The library is passed as an argument, so this file can be
 * type checked without the library.
 * @typedef {Object} PlotlyLibrary
 * @property {(element: HTMLElement, data: Object[], layout: Object,
 *     config?: Object) => Promise<any>} react
 * @property {(element: HTMLElement) => void} purge
 */

/**
 * One load point of the diagram, design values.
 * @typedef {Object} LoadPoint
 * @property {number} m  moment [MNm] (the diagram shows kNm and kN)
 * @property {number} n  normal force [MN], compression negative
 * @property {number} m_mod  moment used for the check [MNm]: m, or the
 *     moment with the minimum eccentricity (EN 1992-1-1 6.1 (4))
 * @property {boolean} modified  true: m_mod is not m
 * @property {boolean} inside  the point of the check (m_mod, n) is inside
 *     of the curve with reinforcement
 * @property {CultIDetails | 'outside' | null} cult  null: not calculated
 * @property {number | null} utilization  radial utilization |S_d| / |R_d|,
 *     null: not calculated or not defined for this curve
 */

/**
 * @typedef {Object} Figure
 * @property {Object[]} data  traces
 * @property {Object} layout
 * @property {string[]} legend_lines  the legend as text, for small screens
 */

const GOVERNING_LINE = { color: '#1f4e79', dash: 'solid', width: 3.5 };
const COMPARISON_LINE = { color: '#888888', dash: 'dash', width: 1.5 };

export const EXAMPLE_TEXT = 'Beispielwerte, nicht projektbezogen';

const HOVERLABEL = {
    bordercolor: 'gray',
    bgcolor: 'lightgray',
    font: { size: 12, family: 'consolas, monospace' },
};

/**
 * Number with a fixed number of decimals, like '{:.2f}'.format(x),
 * with a decimal comma as everywhere in the output of the app.
 * @param {number} x
 * @param {number} digits
 * @returns {string}
 */
export function fmt(x, digits) {
    return x.toFixed(digits).replace('.', ',');
}

/**
 * Number as it was entered, with a decimal comma.
 * @param {number | undefined} x
 * @returns {string}
 */
export function num(x) {
    return String(x).replace('.', ',');
}

/**
 * The diagram shows kN and kNm, like the table; the calculation uses
 * MN and MNm (as legacy/core.py).
 * @param {number[]} values  [MN] or [MNm]
 * @returns {number[]} [kN] or [kNm]
 */
function kilo(values) {
    return values.map(value => value * 1000);
}

/**
 * @param {number[]} moments  [kNm]
 * @param {number[]} forces  [kN]
 * @returns {string[]}
 */
function hover_curve(moments, forces) {
    return moments.map((m, i) =>
        `M: ${fmt(m, 2)} kNm<br>N: ${fmt(forces[i], 1)} kN`);
}

/**
 * Text of CULT-I for the hover label and the table.
 * @param {CultIDetails | 'outside' | null} cult
 * @returns {string}
 */
export function cult_text(cult) {
    if (cult === null) {
        return '';
    }
    if (cult === 'outside') {
        return 'ausserhalb';
    }
    return fmt(cult.cult_I, 3);
}

/**
 * Smallest CULT-I of the load points, 'outside' if one of them is
 * outside of the curve, null if there is nothing to show.
 * @param {LoadPoint[]} points
 * @returns {number | 'outside' | null}
 */
export function min_cult_I(points) {
    /** @type {number | null} */
    let smallest = null;
    for (const point of points) {
        if (point.cult === null) {
            continue;
        }
        if (point.cult === 'outside') {
            return 'outside';
        }
        if (smallest === null || point.cult.cult_I < smallest) {
            smallest = point.cult.cult_I;
        }
    }
    return smallest;
}

/**
 * Largest radial utilization of the load points, null if there is none.
 * @param {LoadPoint[]} points
 * @returns {number | null}
 */
export function max_utilization(points) {
    /** @type {number | null} */
    let largest = null;
    for (const point of points) {
        if (point.utilization !== null &&
            (largest === null || point.utilization > largest)) {
            largest = point.utilization;
        }
    }
    return largest;
}

/**
 * Data and layout of the diagram.
 * @param {InputValues} i_val  input values from int_diagram
 * @param {Values} val  capacity curves from int_diagram
 * @param {Norm} norm
 * @param {LoadPoint[]} points  load points, may be empty
 * @param {Object} [options]
 * @param {number | null} [options.e0]  minimum eccentricity [m], null: none
 * @param {boolean} [options.narrow]  small screen: legend below the diagram
 * @param {boolean} [options.example]  the input is the example, not a project
 * @returns {Figure}
 */
export function figure(i_val, val, norm, points,
                       { e0 = null, narrow = false, example = false } = {}) {
    /** @type {Object[]} */
    const data = [];
    // the legend as text, one line for each trace (for small screens)
    /** @type {string[]} */
    const legend_lines = [];
    /**
     * @param {string} colour  how the trace looks
     * @param {Object} trace
     */
    const add = (colour, trace) => {
        data.push(trace);
        const name = /** @type {any} */ (trace).name.split('<br>').filter(
            (/** @type {string} */ part) => part !== '').join(', ');
        legend_lines.push(`${colour}: ${name}`);
    };

    // closed curve: right side, then the left side backwards
    const concrete_x = kilo(val['Moment'].concat(
        val['Moment Neg'].slice().reverse()));
    const concrete_y = kilo(val['Normal Force'].concat(
        val['Normal Force Neg'].slice().reverse()));
    const section = `h = ${num(i_val['h'])} m<br>b = ${num(i_val['b'])} m<br>` +
        `d_1 = ${num(i_val['d_1'])} m<br>d_2 = ${num(i_val['d_2'])} m<br>`;
    let name_concrete;
    if (i_val['plain']) {
        // plain concrete section: the strength is reduced (D7)
        name_concrete = 'Beton unbewehrt<br>' +
            `f_cd = ${fmt(i_val['f_cd'], 2)} N/mm² (abgemindert)<br>` + section;
    } else {
        name_concrete = 'Beton ohne Bewehrung (Vergleich)<br>' +
            `f_cd = ${fmt(i_val['f_cd'], 2)} N/mm²<br>` + section;
    }
    // The governing curve is drawn solid and strong: the curve with
    // reinforcement, or the concrete curve of a plain section. With
    // reinforcement the concrete curve is only a comparison line.
    add(i_val['plain'] ? 'blau durchgezogen' : 'grau gestrichelt, dünn', {
        type: 'scatter',
        x: concrete_x,
        y: concrete_y,
        mode: 'lines',
        name: name_concrete,
        line: i_val['plain'] ? GOVERNING_LINE : COMPARISON_LINE,
        text: hover_curve(concrete_x, concrete_y),
        hoverinfo: 'text',
        hoverlabel: HOVERLABEL,
    });

    if (!i_val['plain']) {
        const reinf_x = kilo(val['Moment Reinf'].concat(
            val['Moment Reinf Neg'].slice().reverse()));
        const reinf_y = kilo(val['Normal Force Reinf'].concat(
            val['Normal Force Reinf Neg'].slice().reverse()));
        add('blau durchgezogen', {
            type: 'scatter',
            x: reinf_x,
            y: reinf_y,
            mode: 'lines',
            name: 'Mit Bewehrung<br>' +
                `a_s1 = ${fmt(i_val['a_s1'], 2)} cm²<br>` +
                `a_s2 = ${fmt(i_val['a_s2'], 2)} cm²<br>` +
                `f_yd = ${fmt(i_val['f_yd'], 2)} N/mm²<br>`,
            line: GOVERNING_LINE,
            text: hover_curve(reinf_x, reinf_y),
            hoverinfo: 'text',
            hoverlabel: HOVERLABEL,
        });
    }

    if (e0 !== null) {
        // minimum eccentricity (EN 1992-1-1 6.1 (4), D1): rays M = +-e0 * N
        // for compression, from the largest compression force to N = 0 and back
        const n_min = Math.min(...val['Normal Force Reinf']);
        add('orange strichpunktiert', {
            type: 'scatter',
            x: kilo([-e0 * n_min, 0, e0 * n_min]),
            y: kilo([n_min, 0, n_min]),
            mode: 'lines',
            name: `Mindestausmitte M = ±e0·N<br>e0 = ${fmt(e0, 3)} m<br>`,
            line: { color: '#c06000', dash: 'dashdot', width: 1.5 },
            hoverinfo: 'skip',
        });
    }

    if (points.length > 0) {
        // Two traces: points inside and points outside of the curve, so
        // that the legend says how many there are of each.
        /**
         * @param {LoadPoint} p
         * @param {number} i  index of the point in the table
         * @returns {string}
         */
        const hover_point = (p, i) => {
            let text = `Punkt ${i + 1}<br>M: ${fmt(p.m * 1000, 2)} kNm<br>` +
                `N: ${fmt(p.n * 1000, 1)} kN`;
            if (p.modified) {
                text += '<br>M mit Mindestausmitte: ' +
                    `${fmt(p.m_mod * 1000, 2)} kNm`;
            }
            if (p.utilization !== null) {
                text += `<br>Ausnutzung radial: ${fmt(p.utilization, 3)}`;
            }
            if (!p.inside) {
                text += '<br>ausserhalb der Kurve';
            } else if (p.cult !== null) {
                text += `<br>CULT-I: ${cult_text(p.cult)}`;
            }
            return text;
        };
        const numbered = points.map((p, i) => ({ p: p, i: i }));
        const inside = numbered.filter(entry => entry.p.inside);
        const outside = numbered.filter(entry => !entry.p.inside);
        const total = points.length;

        if (inside.length > 0) {
            let name_inside = `Lastpunkte innerhalb: ${inside.length} von ` +
                `${total}<br>Bemessungswerte, γ_d = ${num(i_val['gamma_d'])}`;
            const largest = max_utilization(inside.map(entry => entry.p));
            if (largest !== null) {
                name_inside += `<br>max. Ausnutzung radial: ${fmt(largest, 3)}`;
            }
            const smallest = min_cult_I(inside.map(entry => entry.p));
            if (typeof smallest === 'number') {
                name_inside += `<br>min. CULT-I: ${fmt(smallest, 3)}`;
            }
            add('grüne Punkte', {
                type: 'scatter',
                x: kilo(inside.map(entry => entry.p.m)),
                y: kilo(inside.map(entry => entry.p.n)),
                mode: 'markers',
                name: name_inside,
                marker: {
                    color: '#2e8b57',
                    size: 8,
                    symbol: 'diamond',
                    line: { color: 'black', width: 1 },
                },
                text: inside.map(entry => hover_point(entry.p, entry.i)),
                hoverinfo: 'text',
                hoverlabel: HOVERLABEL,
            });
        }
        if (outside.length > 0) {
            let name_outside = 'Lastpunkte ausserhalb der Kurve: ' +
                `${outside.length} von ${total}<br>` +
                `Bemessungswerte, γ_d = ${num(i_val['gamma_d'])}`;
            const largest = max_utilization(outside.map(entry => entry.p));
            if (largest !== null) {
                name_outside += `<br>max. Ausnutzung radial: ${fmt(largest, 3)}`;
            }
            add('rote Punkte', {
                type: 'scatter',
                x: kilo(outside.map(entry => entry.p.m)),
                y: kilo(outside.map(entry => entry.p.n)),
                mode: 'markers',
                name: name_outside,
                marker: {
                    color: 'red',
                    size: 8,
                    symbol: 'diamond',
                    line: { color: 'black', width: 1 },
                },
                text: outside.map(entry => hover_point(entry.p, entry.i)),
                hoverinfo: 'text',
                hoverlabel: HOVERLABEL,
            });
        }

        // points moved by the minimum eccentricity
        const moved = points.filter(p => p.modified);
        if (moved.length > 0) {
            add('hohle Punkte', {
                type: 'scatter',
                x: kilo(moved.map(p => p.m_mod)),
                y: kilo(moved.map(p => p.n)),
                mode: 'markers',
                name: 'Lastpunkte mit Mindestausmitte',
                marker: {
                    color: 'rgba(0, 0, 0, 0)',
                    size: 8,
                    symbol: 'diamond',
                    line: { color: '#555', width: 1.5 },
                },
                text: moved.map(p =>
                    `M mit Mindestausmitte: ${fmt(p.m_mod * 1000, 2)} kNm<br>` +
                    `N: ${fmt(p.n * 1000, 1)} kN`),
                hoverinfo: 'text',
                hoverlabel: HOVERLABEL,
            });
        }
    }

    /** @type {any} */
    const layout = {
        title: { text: norm.label, font: { size: 16 } },
        plot_bgcolor: '#f9f7f7',
        margin: { l: 60, r: 20, b: 50, t: 50, pad: 4 },
        hovermode: 'closest',
        autosize: true,
        // decimal comma, thin space for thousands
        separators: ', ',
        xaxis: {
            tickformat: '.0f',
            title: { text: 'Moment M [kNm]', font: { size: 16 } },
            zeroline: true,
        },
        yaxis: {
            // compression (negative) at the top, as in legacy/draw_diagram.py
            autorange: 'reversed',
            tickformat: '.0f',
            title: { text: 'Normalkraft N [kN], Druck negativ',
                     font: { size: 16 } },
            zeroline: true,
        },
        legend: {
            traceorder: 'normal',
            font: { family: 'arial, sans-serif', size: 12, color: '#000' },
            bgcolor: '#E2E2E2',
            bordercolor: '#FFFFFF',
            borderwidth: 1.5,
        },
    };
    if (example) {
        // example values are named in the legend
        layout.legend.title = { text: EXAMPLE_TEXT, font: { size: 12 } };
        legend_lines.unshift(EXAMPLE_TEXT);
    }
    if (narrow) {
        // small screen: short title, no legend inside the diagram
        // (the page shows legend_lines below it)
        layout.title.text = norm.name;
        layout.showlegend = false;
    }

    return { data: data, layout: layout, legend_lines: legend_lines };
}

/**
 * Draw the figure into an element of the page.
 * @param {PlotlyLibrary} Plotly  the Plotly library
 * @param {HTMLElement} element
 * @param {Figure} fig
 * @returns {Promise<any>}
 */
export function draw(Plotly, element, fig) {
    return Plotly.react(element, fig.data, fig.layout,
                        { responsive: true, displaylogo: false });
}
