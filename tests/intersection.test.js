// @ts-check
import { test } from 'node:test';
import { intersection } from '../app/intersection.js';
import { loadReference, assertClose } from './helpers.js';

const reference = loadReference();

for (const c of reference.intersection) {
    test(`intersection: ${c.name}`, () => {
        const [x, y] = intersection(c.x1, c.y1, c.x2, c.y2);
        assertClose(x, c.x, 'x');
        assertClose(y, c.y, 'y');
    });
}
