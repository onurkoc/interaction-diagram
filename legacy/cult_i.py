import numpy as np
import intersection as inter


def cult_I(m, n, input_values, values):
    """
    capacity utilization of linings in tunnels (CULT-I)
    according to the paper:
    Performance indicator of tunnel linings under geotechnical uncertainty;
    Spyridis, Panagiotis; Konstantis, Spyridon; Gakis, Angelos
    cult_I = sqrt( (N_rel,i^2 + M_rel,i^2) / (N_rel,max^2 + M_rel,max^2) )
    :input:
    m = x coordinate of a point, moment, float
    n = y coordinate of a point, normal force, float
    input_values = dict of input values, dict[str:float]
    values = dict of resulting values from core function, dict[str:float]
    :return:
    cult_I: float
    """
    if input_values['a_s1'] == 0:
        limit_x_pos = values['Moment']
        limit_y = values['Normal Force']
        n_rel_max = abs(min(limit_y) - max(limit_y))
        m_rel_max = abs(max(limit_x_pos))
    else:
        limit_x_pos = values['Moment Reinf']
        limit_y = values['Normal Force Reinf']
        n_rel_max = abs(min(limit_y) - max(limit_y)) / 2  # take the half
        m_rel_max = abs(max(limit_x_pos))
    if input_values['a_s2'] == 0:
        limit_x_neg = values['Moment Neg']
    else:
        limit_x_neg = values['Moment Reinf Neg']
    limit_x_pos = np.array(limit_x_pos)
    limit_x_neg = np.array(limit_x_neg)
    limit_y = np.array(limit_y)

    horizontal_cut_x = np.array([min(limit_x_neg),
                                 max(limit_x_pos)])
    horizontal_cut_y = np.array([n, n])

    vertical_cut_x = np.array([m, m])
    vertical_cut_y = np.array([max(limit_y),
                               min(limit_y)])
    if m > 0:
        x1, _ = inter.intersection(horizontal_cut_x,
                                   horizontal_cut_y,
                                   limit_x_pos,
                                   limit_y)
        _, y2 = inter.intersection(vertical_cut_x,
                                   vertical_cut_y,
                                   limit_x_pos,
                                   limit_y)
        if len(x1) == 0 or len(y2) == 0:
            cult_I = 'outside'
            return cult_I
        m_rel_i = x1 - m
        if len(y2) > 1:
            n_rel_i = min(abs(y2[0] - n), abs(y2[1] - n))
        else:
            n_rel_i = abs(y2[0] - n)
            if n_rel_i > n_rel_max:
                n_rel_i = min(abs(min(limit_y)) - abs(n),
                              max(limit_y) - abs(n))
        if m_rel_i < 0:
            cult_I = 'outside'
            return cult_I
    elif m == 0:
        m_rel_i = m_rel_max
        n_rel_i = min(abs(min(limit_y)) - abs(n), max(limit_y) - abs(n))
        if max(limit_y) < n < min(limit_y):
            cult_I = 'outside'
            return cult_I
    else:
        x1, _ = inter.intersection(horizontal_cut_x,
                                   horizontal_cut_y,
                                   limit_x_neg,
                                   limit_y)
        _, y2 = inter.intersection(vertical_cut_x,
                                   vertical_cut_y,
                                   limit_x_neg,
                                   limit_y)
        if len(x1) == 0 or len(y2) == 0:
            cult_I = 'outside'
            return cult_I
        m_rel_i = x1 - m
        if len(y2) > 1:
            n_rel_i = min(abs(y2[0] - n), abs(y2[1] - n))
        else:
            n_rel_i = abs(y2[0] - n)
            if n_rel_i > n_rel_max:
                n_rel_i = min(abs(min(limit_y)) - abs(n),
                              max(limit_y) - abs(n))
        if m_rel_i > 0:
            cult_I = 'outside'
            return cult_I
    cult_I = np.sqrt((m_rel_i*m_rel_i + n_rel_i*n_rel_i) / (
            m_rel_max*m_rel_max + n_rel_max*n_rel_max))
    if cult_I is not str:
        if type(cult_I) is np.float64:
            cult_I = round(cult_I, 3)
        else:
            cult_I = round(cult_I[0], 3)
    return cult_I


if __name__ == '__main__':
    import core
    i_val, val = core.int_diagram()  # initiate with default
    print(cult_I(m=-0.21, n=-1, input_values=i_val, values=val))
