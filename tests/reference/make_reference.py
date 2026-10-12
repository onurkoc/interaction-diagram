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
# 'known_wrong' marks sets whose Python results are wrong (see NOTES.md)
CASES = [
    {'name': 'default',
     'params': {}},
    {'name': 'default_eccentricity',
     'params': {'eccentricity': True}},
    {'name': 'as1_zero',
     'params': {'a_s1': 0, 'a_s2': 5}},
    {'name': 'as1_zero_eccentricity',
     'params': {'a_s1': 0, 'a_s2': 5, 'eccentricity': True}},
    {'name': 'as2_zero',
     'params': {'a_s1': 5, 'a_s2': 0}},
    {'name': 'as2_zero_eccentricity',
     'params': {'a_s1': 5, 'a_s2': 0, 'eccentricity': True}},
    {'name': 'no_reinforcement',
     'params': {'a_s1': 0, 'a_s2': 0}},
    {'name': 'no_reinforcement_eccentricity',
     'params': {'a_s1': 0, 'a_s2': 0, 'eccentricity': True}},
    {'name': 'thin_c25_b550_alpha085',
     'params': {'h_': 0.20, 'd_1': 0.04, 'd_2': 0.04, 'a_s1': 2.58,
                'a_s2': 2.58, 'f_ck': 25, 'f_yk': 550, 'alpha_cc': 0.85}},
    {'name': 'alpha_cc_080_raised_to_085',
     'params': {'f_ck': 30, 'alpha_cc': 0.80}},
    {'name': 'thick_c30_accidental_eccentricity',
     'params': {'h_': 0.60, 'b_': 0.8, 'd_1': 0.05, 'd_2': 0.05,
                'gamma_c': 1.2, 'gamma_s': 1.0, 'a_s1': 10.05,
                'a_s2': 10.05, 'f_ck': 30, 'eccentricity': True}},
    {'name': 'as1_not_equal_as2',
     'params': {'a_s1': 5, 'a_s2': 10},
     'known_wrong': ['N1', 'N2'],
     'note': 'bekannt falsch (N1/N2)'},
    {'name': 'as1_not_equal_as2_eccentricity',
     'params': {'a_s1': 10, 'a_s2': 5, 'eccentricity': True},
     'known_wrong': ['N1', 'N2'],
     'note': 'bekannt falsch (N1/N2)'},
    {'name': 'd1_not_equal_d2',
     'params': {'d_1': 0.03, 'd_2': 0.06},
     'known_wrong': ['N2'],
     'note': 'bekannt falsch (N2)'},
    {'name': 'invalid_d_returns_none',
     'params': {'h_': 0.03, 'd_1': 0.03}},
    {'name': 'gamma_c_zero_raises',
     'params': {'gamma_c': 0}},
]

# load points (m [MNm], n [MN]) for cult_i.cult_I, used with every case
CULT_I_POINTS = [
    (0.05, -1.0),
    (-0.05, -1.0),
    (0.10, -3.0),
    (-0.21, -1.0),
    (0.0, -2.0),
    (0.0, 0.0),
    (0.0, -20.0),
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
    if 'known_wrong' in case:
        entry['known_wrong'] = case['known_wrong']
        entry['note'] = case['note']
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
