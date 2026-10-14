// @ts-check
/*
Intersection of two curves
Port of legacy/intersection.py
Source: https://github.com/sukhbinder/intersection
*/

/**
 * Pairs of segments (i of curve 1, j of curve 2) whose bounding
 * rectangles overlap. Same order as np.nonzero: i first, then j.
 * @param {number[]} x1
 * @param {number[]} y1
 * @param {number[]} x2
 * @param {number[]} y2
 * @returns {[number[], number[]]} ii, jj
 */
function _rectangle_intersection_(x1, y1, x2, y2) {
    const n1 = x1.length - 1;
    const n2 = x2.length - 1;
    const ii = [];
    const jj = [];
    for (let i = 0; i < n1; i++) {
        for (let j = 0; j < n2; j++) {
            const C1 = Math.min(x1[i], x1[i + 1]) <= Math.max(x2[j], x2[j + 1]);
            const C2 = Math.max(x1[i], x1[i + 1]) >= Math.min(x2[j], x2[j + 1]);
            const C3 = Math.min(y1[i], y1[i + 1]) <= Math.max(y2[j], y2[j + 1]);
            const C4 = Math.max(y1[i], y1[i + 1]) >= Math.min(y2[j], y2[j + 1]);
            if (C1 && C2 && C3 && C4) {
                ii.push(i);
                jj.push(j);
            }
        }
    }
    return [ii, jj];
}

/**
 * Solve the 4x4 system A * t = b (replaces np.linalg.solve).
 * Gaussian elimination with partial pivoting.
 * Singular matrix: returns four NaN, like the except branch in Python.
 * @param {number[][]} A  is changed in place
 * @param {number[]} b  is changed in place
 * @returns {number[]}
 */
function solve4(A, b) {
    const n = 4;
    for (let k = 0; k < n; k++) {
        // pivot: row with the largest absolute value in column k
        let p = k;
        for (let r = k + 1; r < n; r++) {
            if (Math.abs(A[r][k]) > Math.abs(A[p][k])) {
                p = r;
            }
        }
        if (A[p][k] === 0) {
            return [NaN, NaN, NaN, NaN];
        }
        if (p !== k) {
            const row = A[k];
            A[k] = A[p];
            A[p] = row;
            const value = b[k];
            b[k] = b[p];
            b[p] = value;
        }
        for (let r = k + 1; r < n; r++) {
            const factor = A[r][k] / A[k][k];
            for (let c = k; c < n; c++) {
                A[r][c] -= factor * A[k][c];
            }
            b[r] -= factor * b[k];
        }
    }
    // back substitution
    const t = [0, 0, 0, 0];
    for (let k = n - 1; k >= 0; k--) {
        let sum = b[k];
        for (let c = k + 1; c < n; c++) {
            sum -= A[k][c] * t[c];
        }
        t[k] = sum / A[k][k];
    }
    return t;
}

/**
 * Intersections of curves.
 * Computes the (x, y) locations where two curves intersect.
 * The curves can have vertical segments.
 * @param {number[]} x1
 * @param {number[]} y1
 * @param {number[]} x2
 * @param {number[]} y2
 * @returns {[number[], number[]]} x, y of the intersection points
 */
export function intersection(x1, y1, x2, y2) {
    const [ii, jj] = _rectangle_intersection_(x1, y1, x2, y2);
    const n = ii.length;

    const x = [];
    const y = [];
    for (let k = 0; k < n; k++) {
        const i = ii[k];
        const j = jj[k];
        // unknowns T = [t1, t2, x0, y0]
        // t1, t2: position on segment i and j (0..1), x0, y0: the point
        const AA = [
            [x1[i + 1] - x1[i], 0, -1, 0],
            [0, x2[j + 1] - x2[j], -1, 0],
            [y1[i + 1] - y1[i], 0, 0, -1],
            [0, y2[j + 1] - y2[j], 0, -1],
        ];
        const BB = [-x1[i], -x2[j], -y1[i], -y2[j]];
        const T = solve4(AA, BB);

        const in_range = T[0] >= 0 && T[1] >= 0 && T[0] <= 1 && T[1] <= 1;
        if (in_range) {
            x.push(T[2]);
            y.push(T[3]);
        }
    }
    return [x, y];
}
