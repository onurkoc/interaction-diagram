"""
Comparison values for EN 1992-1-1 from the open-source library
structuralcodes (fib), version 0.7.3. It is the only dependency:

    pip install structuralcodes==0.7.3

Usage (from the repo root):
    python -B tests/reference/structuralcodes_compare.py

Writes tests/reference/structuralcodes.json, read by
tests/structuralcodes.test.js. The values are calculated by
structuralcodes, not by this app.

Model (as in the comparison of 2026-10-29):
- design code 'ec2_2004'
- concrete: create_concrete(fck, gamma_c, alpha_cc), parabola-rectangle
- steel: create_reinforcement(fyk, Es=200000, ftk=fyk,
  epsuk=0.012/0.9, gamma_s), so eps_ud = 0.9 * epsuk = 0.012 and no
  hardening (ftd = fyd)
- RectangularGeometry b x h, each layer 10 bars of the same area
  (add_reinforcement_line), gross section (no holes for the bars)
- M_Rd with calculate_bending_strength(theta, n)

Sides: a_s1 lies at the bottom. Side + of the app (a_s1 in tension) is
theta = 0, side - of the app is theta = pi. structuralcodes gives m_y
with the opposite sign of the app, so M_app = -m_y.

40 sections with a fixed random seed. For each section 9 normal forces
between the tension end and the compression end of structuralcodes
(calculate_limit_axial_load), at 1/10 ... 9/10 of the range, both sides:
720 points. Units in the JSON: m, cm2, N/mm2, kN, kNm; compression
negative.
"""
import json
import math
import os
import random
import sys

import structuralcodes
from structuralcodes.geometry import RectangularGeometry, add_reinforcement_line
from structuralcodes.materials.concrete import create_concrete
from structuralcodes.materials.reinforcement import create_reinforcement
from structuralcodes.sections import BeamSection

VERSION = '0.7.3'
SEED = 20261029
N_SECTIONS = 40
N_LEVELS = 9
BARS_PER_LAYER = 10

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_FILE = os.path.join(HERE, 'structuralcodes.json')


def sections():
    """The 40 sections, drawn with a fixed seed."""
    rng = random.Random(SEED)
    result = []
    for _ in range(N_SECTIONS):
        if rng.random() < 0.3:
            # reinforcement on one side only
            a_s2 = 0.0
        else:
            a_s2 = round(rng.uniform(0.5, 21.0), 2)
        result.append({
            'h_': round(rng.uniform(0.25, 1.0), 2),
            'b_': 1.0,
            'd_1': round(rng.uniform(0.03, 0.07), 3),
            'd_2': round(rng.uniform(0.03, 0.07), 3),
            'a_s1': round(rng.uniform(2.0, 50.0), 2),
            'a_s2': a_s2,
            'f_ck': rng.choice([20, 25, 30, 35, 40, 45, 50]),
            'f_yk': 500,
            'gamma_c': 1.5,
            'gamma_s': 1.15,
            'alpha_cc': rng.choice([0.85, 1.0]),
        })
    return result


def layer(geometry, a_s, y, edge, b, steel):
    """Add one layer: 10 bars with the area a_s [cm2] at height y [mm]."""
    if a_s <= 0:
        return geometry
    area = a_s * 100 / BARS_PER_LAYER  # mm2 per bar
    diameter = math.sqrt(4 * area / math.pi)
    return add_reinforcement_line(
        geometry, (-b / 2 + edge, y), (b / 2 - edge, y), diameter, steel,
        n=BARS_PER_LAYER)


def calculator(p):
    """Section calculator of structuralcodes for the parameters p."""
    concrete = create_concrete(p['f_ck'], gamma_c=p['gamma_c'],
                               alpha_cc=p['alpha_cc'])
    steel = create_reinforcement(p['f_yk'], Es=200000, ftk=p['f_yk'],
                                 epsuk=0.012 / 0.9, gamma_s=p['gamma_s'])
    h = p['h_'] * 1000
    b = p['b_'] * 1000
    d_1 = p['d_1'] * 1000
    d_2 = p['d_2'] * 1000
    geometry = RectangularGeometry(b, h, concrete)
    # a_s1 at the bottom, a_s2 at the top
    geometry = layer(geometry, p['a_s1'], -(h / 2 - d_1), d_1, b, steel)
    geometry = layer(geometry, p['a_s2'], h / 2 - d_2, d_2, b, steel)
    return BeamSection(geometry).section_calculator


def points(p):
    """The points of one section, both sides, in kN and kNm."""
    calc = calculator(p)
    n_compression, n_tension = calc.calculate_limit_axial_load()  # N
    result = []
    for side, theta in (('+', 0.0), ('-', math.pi)):
        for i in range(1, N_LEVELS + 1):
            n = n_tension + i / (N_LEVELS + 1) * (n_compression - n_tension)
            res = calc.calculate_bending_strength(theta=theta, n=n)
            result.append({
                'side': side,
                'N': float(n) / 1e3,
                'M': -float(res.m_y) / 1e6,
            })
    return result


def main():
    if structuralcodes.__version__ != VERSION:
        sys.exit(f'structuralcodes {VERSION} is needed, found '
                 f'{structuralcodes.__version__}')
    structuralcodes.set_design_code('ec2_2004')
    out = {
        'generator': 'tests/reference/structuralcodes_compare.py',
        'structuralcodes': structuralcodes.__version__,
        'seed': SEED,
        'units': {'h_, b_, d_1, d_2': 'm', 'a_s1, a_s2': 'cm2',
                  'f_ck, f_yk': 'N/mm2', 'N': 'kN', 'M': 'kNm'},
        'sign': 'N < 0 compression; M > 0 tension on the side of a_s1',
        'sections': [],
    }
    for p in sections():
        out['sections'].append({'params': p, 'points': points(p)})
    with open(OUT_FILE, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    count = sum(len(s['points']) for s in out['sections'])
    print(f'{OUT_FILE}: {len(out["sections"])} sections, {count} points')


if __name__ == '__main__':
    main()
