import math
import numpy as np
import pandas as pd
import intersection as inter


def int_diagram(h_=0.35,
                b_=1.0,
                d_1=0.03,
                d_2=0.03,
                gamma_c=1.50,
                gamma_s=1.15,
                gamma_d=1.35,
                a_s1=5,
                a_s2=5,
                f_ck=40,
                f_yk=500,
                alpha_cc=1.00,
                eccentricity=False):

    # epsilon values of the steel and the concrete
    # a. steel strains tension side
    epsilon_s1 = np.array([
        -0.003499, -0.0032, -0.0029, -0.0026, -0.0023, -0.002, -0.0017,
        -0.0014, -0.0011, -0.0008, -0.0005, -0.0002, 0.0, 0.0004, 0.0007,
        0.001, 0.0013, 0.0016, 0.0019, 0.0022, 0.0025, 0.0028, 0.0031,
        0.0034, 0.0037, 0.004, 0.0043, 0.0049, 0.0052, 0.0055, 0.006,
        0.0065, 0.007, 0.0075, 0.008, 0.009, 0.0095, 0.01, 0.011, 0.012,
        0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012, 0.012,
        0.012, 0.012, 0.012])

    # b. concrete strains compression side
    epsilon_c = np.array([
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0035,
        -0.0035, -0.0035, -0.0035, -0.0035, -0.0035, -0.0032, -0.0029,
        -0.0026, -0.0023, -0.002, -0.0017, -0.0014, -0.0011, -0.0008,
        -0.0005, -0.0002, 0.0])

    e_steel = 200000  # N/mm2
    try:
        alpha = a_s1 / a_s2
    except ZeroDivisionError:
        # in case a_s2 defined as zero
        alpha = 0
    if alpha_cc < 0.85:
        # alpha_cc cannot be smaller than 0.85
        alpha_cc = 0.85
    f_cd = f_ck / gamma_c * alpha_cc
    f_yd = f_yk / gamma_s
    d = h_ - d_1
    a_s1_ = 0  # indicating naked concrete interaction line
    alpha_ = 1  # again for naked concrete interaction line

    min_ecc = min(h_ / 30, 0.02)
    # min eccentricity as defined in EN1992-1 6.1(4)
    n_max = f_ck * b_ * d
    m_min = min_ecc * n_max

    # mapping the epsilon values as pandas data frame
    df = pd.DataFrame({'eps_c': epsilon_c,
                       'eps_s1': epsilon_s1})

    # iterating for every epsilon value pair
    moment = []
    n_force = []
    moment_reinf = []
    n_force_reinf = []
    for i in range(len(df.eps_c)):
        # calling eps_c and eps_s1 from now on as y and x
        x = df.eps_s1[i]
        y = df.eps_c[i]

        if d <= 0 or a_s1 < 0 or a_s2 < 0 or b_ <= 0 or gamma_c < 0 or \
           gamma_d < 0 or gamma_s < 0 or d_1 < 0 or d_2 < 0 or alpha_cc <= 0:
            # parameter problems returns NoneType
            return

        # calling for rectangular part
        if (-0.002 - y) * d / (x - y) > 0:
            xi1 = min((-0.002 - y) * d / (x - y), h_)
        else:
            xi1 = 0

        # compression zone height
        xi2 = min((-y * d) / (x - y), h_)

        # factor (Hilfswert)
        h_w = (y - x) / d

        # compression force of concrete
        f_c = f_cd * b_ * \
            (-xi1 + (xi2 - xi1) * (1000 * y + 250000 * y ** 2) -
             (xi2 ** 2 - xi1 ** 2) * (500 * h_w + 250000 * h_w * y) +
             (xi2 ** 3 - xi1 ** 3) * 250000 * h_w ** 2 / 3)

        # moment concrete
        m_c = f_cd * b_ * (-0.5 * xi1 ** 2 + 0.5 *
                           (1000 * y + 250000 * y ** 2) *
                           (xi2 ** 2 - xi1 ** 2) -
                           (1000 + 500000 * y) * h_w / 3 *
                           (xi2 ** 3 - xi1 ** 3) +
                           62500 * h_w ** 2 *
                           (xi2 ** 4 - xi1 ** 4))

        # eccentricity concrete (avoid division by zero)
        if m_c == 0 or f_c == 0:
            e_ausm = h_ / 2
        else:
            e_ausm = h_ / 2 - m_c / f_c

        # steel strain on the compression side

        eps_s2 = y - (y - x) / d * d_2

        # compression force steel
        f_s2 = (math.copysign(1, eps_s2) * min((e_steel * abs(eps_s2)),
                                               f_yd) * alpha_ * a_s1_ / 1000)

        # tension force steel
        f_s1 = math.copysign(1, x) * min((e_steel * abs(x)),
                                         f_yd) * a_s1_ / 1000

        # moment
        m_r = f_s1 * (h_ / 2 - d_1) - f_s2 * (h_ / 2 - d_2) - f_c * e_ausm

        # normal force
        n_r = f_s2 + f_s1 + f_c

        # m und n for pure concrete
        moment.append(m_r)
        n_force.append(n_r)

        # compression force steel (reinforcement)
        f_s2_reinf = math.copysign(1, eps_s2) * \
            min((e_steel * abs(eps_s2)), f_yd) * alpha * a_s1 / 10000

        # tension force steel (reinforcement)
        f_s1_reinf = math.copysign(1, x) * \
            min((e_steel * abs(x)), f_yd) * a_s1 / 10000

        # moment (reinforcement)
        m_r_reinf = (f_s1_reinf * (h_ / 2 - d_1) - f_s2_reinf *
                     (h_ / 2 - d_2) - f_c * e_ausm)

        # normal force (reinforcement)
        n_r_reinf = f_s2_reinf + f_s1_reinf + f_c

        # m und n (reinforcement)
        moment_reinf.append(m_r_reinf)
        n_force_reinf.append(n_r_reinf)

    moment_neg = []
    # left side of the diagram (concrete)
    for i in range(len(moment)):
        moment_neg.append(float(abs(moment[i]) * -1))

    moment_reinf_neg = []
    # left side of the diagram (with reinforcement)
    for i in range(len(moment_reinf)):
        moment_reinf_neg.append(float(abs(moment_reinf[i]) * -1))

    if eccentricity:
        # if user wants to visualize the eccentricity line
        limit_line_pos_m = [m_min, m_min]
        limit_line_neg_m = [-m_min, -m_min]
        limit_line_n = [0, -n_max]

        if a_s1 == 0 and a_s2 == 0:
            # no reinforcements
            x1, y1 = inter.intersection(np.array(limit_line_neg_m),
                                        np.array(limit_line_n),
                                        np.array(moment_neg),
                                        np.array(n_force))
            x2, y2 = inter.intersection(np.array(limit_line_pos_m),
                                        np.array(limit_line_n),
                                        np.array(moment),
                                        np.array(n_force))
        elif a_s1 != 0:
            x1, y1 = inter.intersection(np.array(limit_line_neg_m),
                                        np.array(limit_line_n),
                                        np.array(moment_reinf_neg),
                                        np.array(n_force_reinf))
            if a_s2 == 0:
                # only a_s1 defined
                x2, y2 = inter.intersection(np.array(limit_line_pos_m),
                                            np.array(limit_line_n),
                                            np.array(moment),
                                            np.array(n_force))
            else:
                # both of them defined
                x2, y2 = inter.intersection(np.array(limit_line_pos_m),
                                            np.array(limit_line_n),
                                            np.array(moment_reinf),
                                            np.array(n_force_reinf))
        elif a_s2 != 0 and a_s1 == 0:
            x1, y1 = inter.intersection(np.array(limit_line_pos_m),
                                        np.array(limit_line_n),
                                        np.array(moment),
                                        np.array(n_force))
            x2, y2 = inter.intersection(np.array(limit_line_pos_m),
                                        np.array(limit_line_n),
                                        np.array(moment_reinf),
                                        np.array(n_force_reinf))
        else:
            raise Exception('Cannot calculate eccentricity')

    input_values = {'h': h_,
                    'b': b_,
                    'd_1': d_1,
                    'd_2': d_2,
                    'gamma_c': gamma_c,
                    'gamma_s': gamma_s,
                    'gamma_d': gamma_d,
                    'a_s1': a_s1,
                    'a_s2': a_s2,
                    'f_ck': f_ck,
                    'f_yk': f_yk,
                    'alpha_cc': alpha_cc,
                    'eccentricity': eccentricity}
    if eccentricity:
        values = {'Moment': moment,
                  'Moment Neg': moment_neg,
                  'Normal Force': n_force,
                  'Moment Reinf': moment_reinf,
                  'Moment Reinf Neg': moment_reinf_neg,
                  'Normal Force Reinf': n_force_reinf,
                  'x1_y1': [x1, y1],
                  'x2_y2': [x2, y2]}
    else:
        values = {'Moment': moment,
                  'Moment Neg': moment_neg,
                  'Normal Force': n_force,
                  'Moment Reinf': moment_reinf,
                  'Moment Reinf Neg': moment_reinf_neg,
                  'Normal Force Reinf': n_force_reinf}

    return input_values, values


if __name__ == '__main__':
    i_val, val = int_diagram(eccentricity=True)  # initiate with default values
    # i['X'] = np.array([0, 100])
    # i['Y'] = np.array([0, -1000])
    print(val['x1_y1'])
    print(val['x2_y2'])
    print(max(np.array(val['Moment'])))
    print(max(np.array(val['Moment Reinf'])))
