"""
Generate reference values from the original Python code in legacy/.

The JS port is tested against the JSON written by this script.
The calculation code in legacy/ is imported as it is, nothing is patched.

Usage (from the repo root):
    python -B tests/reference/make_reference.py
"""
import hashlib
import json
import math
import os
import platform
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LEGACY = os.path.join(ROOT, 'legacy')
sys.path.insert(0, LEGACY)

import core  # noqa: E402
import cult_i  # noqa: E402
import intersection as inter  # noqa: E402

OUT_FILE = os.path.join(HERE, 'reference.json')

# parameter sets for core.int_diagram
# Only sets for which core.py is correct: a_s1 = a_s2 > 0, d_1 = d_2 and
# alpha_cc >= 0.85. The sets for the known problems of core.py (E5, E10,
# N1, N2 in NOTES.md) were removed after the corrections; the corrected
# behaviour is tested in tests/corrections.test.js.
CASES = [
    {'name': 'default',
     'params': {}},
    {'name': 'default_eccentricity',
     'params': {'eccentricity': True}},
    {'name': 'thin_c25_b550_alpha085',
     'params': {'h_': 0.20, 'd_1': 0.04, 'd_2': 0.04, 'a_s1': 2.58,
                'a_s2': 2.58, 'f_ck': 25, 'f_yk': 550, 'alpha_cc': 0.85}},
    {'name': 'thick_c30_accidental_eccentricity',
     'params': {'h_': 0.60, 'b_': 0.8, 'd_1': 0.05, 'd_2': 0.05,
                'gamma_c': 1.2, 'gamma_s': 1.0, 'a_s1': 10.05,
                'a_s2': 10.05, 'f_ck': 30, 'eccentricity': True},
     # cult_i.py uses the wrong distance to the tension side for these
     # points (N9 in NOTES.md), their old results are not kept
     'cult_I_skip': [(0.05, -1.0), (-0.05, -1.0), (0.02, -5.5)]},
    # typical shotcrete lining, section for the comparison with commercial program
    {'name': 'shotcrete_h30_c30_b500',
     'params': {'h_': 0.30, 'b_': 1.0, 'd_1': 0.05, 'd_2': 0.05,
                'a_s1': 5.24, 'a_s2': 5.24, 'f_ck': 30, 'f_yk': 500}},
    {'name': 'shotcrete_h30_c30_b500_eccentricity',
     'params': {'h_': 0.30, 'b_': 1.0, 'd_1': 0.05, 'd_2': 0.05,
                'a_s1': 5.24, 'a_s2': 5.24, 'f_ck': 30, 'f_yk': 500,
                'eccentricity': True}},
    {'name': 'invalid_d_returns_none',
     'params': {'h_': 0.03, 'd_1': 0.03}},
    {'name': 'gamma_c_zero_raises',
     'params': {'gamma_c': 0}},
]

# load points (m [MNm], n [MN]) for cult_i.cult_I, used with every case.
# Points with m = 0 and compression are not included: cult_i.py uses the
# wrong distance to the tension side there (N9 in NOTES.md).
CULT_I_POINTS = [
    (0.05, -1.0),
    (-0.05, -1.0),
    (0.10, -3.0),
    (-0.21, -1.0),
    (0.0, 0.0),
    (0.01, 0.1),
    (-0.01, 0.1),
    (0.5, -1.0),
    (-0.5, -1.0),
    (0.05, -20.0),
    (0.02, -5.5),
]


def intersection_cases():
    """input curves for intersection.intersection"""
    a, b = 1, 2
    phi = np.linspace(3, 10, 100)
    return [
        {'name': 'docstring_example',
         'x1': a * phi - b * np.sin(phi), 'y1': a - b * np.cos(phi),
         'x2': phi, 'y2': np.sin(phi) + 2},
        {'name': 'simple_cross',
         'x1': np.array([0.0, 1.0]), 'y1': np.array([0.0, 1.0]),
         'x2': np.array([0.0, 1.0]), 'y2': np.array([1.0, 0.0])},
        {'name': 'no_intersection',
         'x1': np.array([0.0, 1.0]), 'y1': np.array([0.0, 1.0]),
         'x2': np.array([2.0, 3.0]), 'y2': np.array([1.0, 0.0])},
        {'name': 'vertical_and_horizontal',
         'x1': np.array([1.0, 1.0]), 'y1': np.array([0.0, 2.0]),
         'x2': np.array([0.0, 2.0]), 'y2': np.array([1.0, 1.0])},
        {'name': 'collinear_overlap_singular',
         'x1': np.array([0.0, 2.0]), 'y1': np.array([0.0, 2.0]),
         'x2': np.array([1.0, 3.0]), 'y2': np.array([1.0, 3.0])},
        {'name': 'touch_at_vertex',
         'x1': np.array([0.0, 2.0]), 'y1': np.array([1.0, 1.0]),
         'x2': np.array([0.0, 1.0, 2.0]), 'y2': np.array([0.0, 1.0, 0.0])},
        {'name': 'polyline_two_crossings',
         'x1': np.array([0.0, 4.0]), 'y1': np.array([0.5, 0.5]),
         'x2': np.array([0.0, 1.0, 2.0, 3.0, 4.0]),
         'y2': np.array([0.0, 1.0, 0.0, -1.0, 0.0])},
    ]


def to_json(obj):
    """convert numpy types to plain Python types, refuse NaN / inf"""
    if isinstance(obj, dict):
        return {key: to_json(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_json(value) for value in obj]
    if isinstance(obj, np.ndarray):
        return [to_json(value) for value in obj.tolist()]
    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        if not math.isfinite(obj):
            raise ValueError('NaN or inf in reference values')
        return float(obj)
    if obj is None or isinstance(obj, str):
        return obj
    raise TypeError('cannot convert {}'.format(type(obj)))


def error_entry(e):
    return {'error': {'type': type(e).__name__, 'message': str(e)}}


def sha256_lf(path):
    """hash of a source file, independent of CRLF / LF checkout"""
    with open(path, 'rb') as f:
        data = f.read().replace(b'\r\n', b'\n')
    return hashlib.sha256(data).hexdigest()


def run_case(case):
    entry = {'name': case['name'], 'params': case['params']}
    try:
        result = core.int_diagram(**case['params'])
    except Exception as e:
        entry.update(error_entry(e))
        return entry
    if result is None:
        entry['result'] = None
        return entry
    input_values, values = result
    entry['result'] = {'input_values': input_values, 'values': values}

    cult = []
    for m, n in CULT_I_POINTS:
        if (m, n) in case.get('cult_I_skip', []):
            continue
        point = {'m': m, 'n': n}
        try:
            point['cult_I'] = cult_i.cult_I(m=m, n=n,
                                            input_values=input_values,
                                            values=values)
        except Exception as e:
            point.update(error_entry(e))
        cult.append(point)
    entry['cult_I'] = cult
    return entry


def run_intersection(case):
    entry = dict(case)
    try:
        x, y = inter.intersection(case['x1'], case['y1'],
                                  case['x2'], case['y2'])
    except Exception as e:
        entry.update(error_entry(e))
    else:
        entry['x'] = x
        entry['y'] = y
    return entry


def main():
    reference = {
        'meta': {
            'generator': 'tests/reference/make_reference.py',
            'python': platform.python_version(),
            'numpy': np.__version__,
            'pandas': pd.__version__,
            'sha256_lf': {name: sha256_lf(os.path.join(LEGACY, name))
                          for name in ['core.py', 'cult_i.py',
                                       'intersection.py']},
        },
        'intersection': [run_intersection(c) for c in intersection_cases()],
        'cases': [run_case(c) for c in CASES],
    }
    text = json.dumps(to_json(reference), indent=1, allow_nan=False)
    with open(OUT_FILE, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text + '\n')
    print('written:', OUT_FILE)


if __name__ == '__main__':
    main()
