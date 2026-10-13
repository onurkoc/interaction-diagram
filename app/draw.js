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
 * @property {number} m  moment [MNm]
 * @property {number} n  normal force [MN], compression negative
 * @property {number} m_mod  moment used for the check [MNm]: m, or the
 *     moment with the minimum eccentricity (EN 1992-1-1 6.1 (4))
 * @property {boolean} modified  true: m_mod is not m
 * @property {CultIDetails | 'outside' | null} cult  null: not calculated
 */

/**
 * @typedef {Object} Figure
 * @property {Object[]} data  traces
 * @property {Object} layout
 * @property {string[]} legend_lines  the legend as text, for small screens
 */

const HOVERLABEL = {
    bordercolor: 'gray',
    bgcolor: 'lightgray',
    font: { size: 12, family: 'consolas, monospace' },
};

/**
 * Number with a fixed number of decimals, like '{:.2f}'.format(x)
 * @param {number} x
 * @param {number} digits
 * @returns {string}
 */
export function fmt(x, digits) {
    return x.toFixed(digits);
}

/**
 * @param {number[]} moments
 * @param {number[]} forces
 * @returns {string[]}
 */
function hover_curve(moments, forces) {
    return moments.map((m, i) =>
        `M: ${fmt(m, 3)} MNm<br>N: ${fmt(forces[i], 3)} MN`);
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
 * Data and layout of the diagram.
 * @param {InputValues} i_val  input values from int_diagram
 * @param {Values} val  capacity curves from int_diagram
 * @param {Norm} norm
 * @param {LoadPoint[]} points  load points, may be empty
 * @param {Object} [options]
 * @param {number | null} [options.e0]  minimum eccentricity [m], null: none
 * @param {boolean} [options.narrow]  small screen: legend below the diagram
 * @returns {Figure}
 */
export function figure(i_val, val, norm, points, { e0 = null, narrow = false } = {}) {
    /** @type {Object[]} */
    const data = [];

    // closed curve: right side, then the left side backwards
    const concrete_x = val['Moment'].concat(val['Moment Neg'].slice().reverse());
    const concrete_y = val['Normal Force'].concat(
        val['Normal Force Neg'].slice().reverse());
    const section = `h = ${i_val['h']} m<br>b = ${i_val['b']} m<br>` +
        `d_1 = ${i_val['d_1']} m<br>d_2 = ${i_val['d_2']} m<br>`;
    let name_concrete;
    if (i_val['plain']) {
        // plain concrete section: the strength is reduced (D7)
        name_concrete = 'Beton unbewehrt<br>' +
            `f_cd = ${fmt(i_val['f_cd'], 2)} N/mm² (abgemindert)<br>` + section;
    } else {
        name_concrete = 'Beton ohne Bewehrung (Vergleich)<br>' +
            `f_cd = ${fmt(i_val['f_cd'], 2)} N/mm²<br>` + section;
    }
    data.push({
        type: 'scatter',
        x: concrete_x,
        y: concrete_y,
        mode: 'lines',
        name: name_concrete,
        line: { color: 'blue', width: 3 },
        text: hover_curve(concrete_x, concrete_y),
        hoverinfo: 'text',
        hoverlabel: HOVERLABEL,
    });

    if (!i_val['plain']) {
        const reinf_x = val['Moment Reinf'].concat(
            val['Moment Reinf Neg'].slice().reverse());
        const reinf_y = val['Normal Force Reinf'].concat(
            val['Normal Force Reinf Neg'].slice().reverse());
        data.push({
            type: 'scatter',
            x: reinf_x,
            y: reinf_y,
            mode: 'lines',
            name: 'Mit Bewehrung<br>' +
                `a_s1 = ${fmt(i_val['a_s1'], 2)} cm²<br>` +
                `a_s2 = ${fmt(i_val['a_s2'], 2)} cm²<br>` +
                `f_yd = ${fmt(i_val['f_yd'], 2)} N/mm²<br>`,
            line: { color: 'green', dash: 'dash', width: 3 },
            text: hover_curve(reinf_x, reinf_y),
            hoverinfo: 'text',
            hoverlabel: HOVERLABEL,
        });
    }

    if (e0 !== null) {
        // minimum eccentricity (EN 1992-1-1 6.1 (4), D1): rays M = +-e0 * N
        // for compression, from the largest compression force to N = 0 and back
        const n_min = Math.min(...val['Normal Force Reinf']);
        data.push({
            type: 'scatter',
            x: [-e0 * n_min, 0, e0 * n_min],
            y: [n_min, 0, n_min],
            mode: 'lines',
            name: `Mindestausmitte M = ±e0·N<br>e0 = ${fmt(e0, 3)} m<br>`,
            line: { color: 'gray', dash: 'dash', width: 1.5 },
            hoverinfo: 'skip',
        });
    }

    if (points.length > 0) {
        const smallest = min_cult_I(points);
        let name_points = `Lastpunkte (Bemessungswerte, γ_d = ${i_val['gamma_d']})`;
        if (smallest === 'outside') {
            name_points += '<br>CULT-I: Punkt ausserhalb';
        } else if (smallest !== null) {
            name_points += `<br>min. CULT-I: ${fmt(smallest, 3)}`;
        }
        data.push({
            type: 'scatter',
            x: points.map(p => p.m),
            y: points.map(p => p.n),
            mode: 'markers',
            name: name_points,
            showlegend: true,
            marker: {
                color: 'red',
                size: 8,
                symbol: 'diamond',
                line: { color: 'black', width: 1 },
            },
            text: points.map((p, i) => {
                let text = `Punkt ${i + 1}<br>M: ${fmt(p.m, 3)} MNm<br>` +
                    `N: ${fmt(p.n, 3)} MN`;
                if (p.modified) {
                    text += `<br>M mit Mindestausmitte: ${fmt(p.m_mod, 3)} MNm`;
                }
                if (p.cult !== null) {
                    text += `<br>CULT-I: ${cult_text(p.cult)}`;
                }
                return text;
            }),
            hoverinfo: 'text',
            hoverlabel: HOVERLABEL,
        });

        // points moved by the minimum eccentricity
        const moved = points.filter(p => p.modified);
        if (moved.length > 0) {
            data.push({
                type: 'scatter',
                x: moved.map(p => p.m_mod),
                y: moved.map(p => p.n),
                mode: 'markers',
                name: 'Lastpunkte mit Mindestausmitte',
                marker: {
                    color: 'rgba(0, 0, 0, 0)',
                    size: 8,
                    symbol: 'diamond',
                    line: { color: 'red', width: 1.5 },
                },
                text: moved.map(p =>
                    `M mit Mindestausmitte: ${fmt(p.m_mod, 3)} MNm<br>` +
                    `N: ${fmt(p.n, 3)} MN`),
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
        xaxis: {
            tickformat: '.2f',
            title: { text: 'Moment M [MNm]', font: { size: 16 } },
            zeroline: true,
        },
        yaxis: {
            // compression (negative) at the top, as in legacy/draw_diagram.py
            autorange: 'reversed',
            tickformat: '.1f',
            title: { text: 'Normalkraft N [MN], Druck negativ',
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
    if (narrow) {
        // small screen: short title, no legend inside the diagram
        // (the page shows legend_lines below it)
        layout.title.text = norm.name;
        layout.showlegend = false;
    }

    // the legend as text, one line for each trace
    const colours = { blue: 'blau', green: 'grün gestrichelt',
                      gray: 'grau gestrichelt', red: 'rot' };
    const legend_lines = data.map(trace => {
        const t = /** @type {any} */ (trace);
        const colour = t.line ? t.line.color : t.marker.line.color === 'red' ?
            'red' : t.marker.color;
        const name = t.name.split('<br>').filter(
            (/** @type {string} */ part) => part !== '').join(', ');
        const hollow = t.marker && t.marker.line.color === 'red' ? ', hohl' : '';
        return `${/** @type {Object<string, string>} */ (colours)[colour]}` +
            `${hollow}: ${name}`;
    });

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
