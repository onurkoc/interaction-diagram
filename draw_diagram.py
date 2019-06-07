import plotly.graph_objs as go
import numpy as np
from typing import Dict, Tuple, Any


def draw(values: Tuple[Any, Any], x: np.array, y: np.array):
    """
    input::
    val: dict of capacity curves
    x: design values, moment
    y: design values, normal force

    return:: plotly figure object
    """
    i_val: Dict[str, float]
    val: Dict[str, float]
    i_val, val = values
    ecc = i_val['eccentricity']  # eccentricity true or false

    hover_mom_pos = ['Moment: ' + '{:.2f}'.format(text_x) +
                     '<br>Normal force: ' + '{:.2f}'.format(text_y)
                     for text_x, text_y in zip(list(val['Moment']),
                                               list(val['Normal Force']))]

    hover_mom_neg = ['Moment: ' + '{:.2f}'.format(text_x) +
                     '<br>Normal force: ' + '{:.2f}'.format(text_y)
                     for text_x, text_y in zip(list(val['Moment Neg']),
                                               list(val['Normal Force']))]

    hover_reinf_pos = ['Moment: ' + '{:.2f}'.format(text_x) +
                       '<br>Normal force: ' + '{:.2f}'.format(text_y)
                       for text_x, text_y in
                       zip(list(val['Moment Reinf']),
                           list(val['Normal Force Reinf']))]

    hover_reinf_neg = ['Moment: ' + '{:.2f}'.format(text_x) +
                       '<br>Normal force: ' + '{:.2f}'.format(text_y)
                       for text_x, text_y in
                       zip(list(val['Moment Reinf Neg']),
                           list(val['Normal Force Reinf']))]
    try:
        val['cult-I']
    except Exception:
        hover_design = ['Moment: ' + '{:.2f}'.format(text_x) + ' [MN.m]' +
                        '<br>Normal force: ' + '{:.2f}'.format(text_y) +
                        ' [MN]'
                        for text_x, text_y in zip(list(x), list(y))]
        name_design_values = f'Design values'
    else:
        hover_design = ['Moment: ' + '{:.2f}'.format(text_x) + ' [MN.m]' +
                        '<br>Normal force: ' + '{:.2f}'.format(text_y) +
                        ' [MN]<br>CULT-I: {}'.format(index)
                        for text_x, text_y, index in zip(list(x),
                                                         list(y),
                                                         val['cult-I'])]
        try:
            min_cult_I = min([i for i in val['cult-I'] if type(i) != str])
        except Exception as e:
            print(e)
            name_design_values = f'Design values'
        else:
            name_design_values = f'Design values<br>min cult-I: {min_cult_I}'

    trace0 = go.Scatter(
        x=val['Moment'] + val['Moment Neg'][::-1],
        y=val['Normal Force'] + val['Normal Force'][::-1],
        mode='lines',
        name=f'Concrete<br>'
             f'f_cd = {i_val["f_ck"]/i_val["gamma_c"]:.2f} N/mm²<br>'
             f'h = {i_val["h"]} m<br>b = {i_val["b"]} m<br>'
             f'd_1 = {i_val["d_1"]} m<br>d_2 = {i_val["d_2"]} m<br>',
        line=dict(
            color='blue',
            width=3
        ),
        text=hover_mom_pos + hover_mom_neg[::-1],
        hoverinfo='text',
        hoverlabel=dict(
            bordercolor='gray',
            bgcolor='lightgray',
            font=dict(
                size=12,
                family='consolas'
            )
        )
    )

    trace1 = go.Scatter(
        x=val['Moment Reinf'] + val['Moment Reinf Neg'][::-1],
        y=val['Normal Force Reinf'] + val['Normal Force Reinf'][::-1],
        mode='lines',
        name=f'Reinforcement<br>'
             f'a_s1 = {i_val["a_s1"]:.2f} cm²<br>'
             f'a_s2 = {i_val["a_s2"]} cm²<br>'
             f'f_yd = {i_val["f_yk"]/i_val["gamma_s"]:.2f} N/mm²<br>',
        line=dict(
            color='green',
            dash='dash',
            width=3
        ),
        text=hover_reinf_pos + hover_reinf_neg[::-1],
        hoverinfo='text',
        hoverlabel=dict(
            bordercolor='gray',
            bgcolor='lightgray',
            font=dict(
                size=12,
                family='consolas'
            )
        )
    )

    trace2 = go.Scatter(
        x=x,
        y=y,
        mode='markers',
        name=name_design_values,
        showlegend=True,
        marker=dict(
            color='red',
            size=8,
            symbol='diamond',
            line=dict(
                color='black',
                width=1
            )
        ),
        text=hover_design,
        hoverinfo='text',
        hoverlabel=dict(
            bordercolor='gray',
            bgcolor='lightgray',
            font=dict(
                size=12,
                family='consolas'
            )
        )
    )

    if ecc:
        x1, y1 = val['x1_y1']
        x1 = min(x1)
        y1 = min(y1)
        x2, y2 = val['x2_y2']
        x2 = min(x2)
        y2 = min(y2)
        hover_ecc = ['Eccentricity:<br>' +
                     'Moment: ' + '{:.2f}'.format(text_x) + ' [MN.m]' +
                     '<br>Normal force: ' + '{:.2f}'.format(text_y) + ' [MN]'
                     for text_x, text_y in zip([x1, x2], [y1, y2])]
        trace3 = go.Scatter(
            x=[x1, x2],
            y=[y1, y2],
            mode='lines',
            name='eccentricity',
            showlegend=False,
            line=dict(
                color='gray',
                dash='longdashdot',
                width=1.5
            ),
            text=hover_ecc,
            hoverinfo='text',
            hoverlabel=dict(
                bordercolor='gray',
                bgcolor='lightgray',
                font=dict(
                    size=12,
                    family='consolas'
                )
            )
        )

    layout = go.Layout(
        plot_bgcolor='#f9f7f7',
        margin=dict(
            l=50,
            r=50,
            b=50,
            t=50,
            pad=4
        ),
        titlefont=dict(
            size=20,
        ),
        hovermode='closest',
        autosize=True,
        # width=1200,
        height=900,
        xaxis=dict(
            rangemode='normal',
            tickformat='.2f',
            title='Moment [MN.m]',
            titlefont=dict(
                size=18)
        ),
        yaxis=dict(
            scaleanchor='x',
            scaleratio=0.1,
            autorange='reversed',
            tickformat='.0f',
            title='Normal Force [MN]',
            titlefont=dict(
                size=18)
        ),
        legend=dict(
            x=0.82,
            y=0.98,
            traceorder='normal',
            font=dict(
                family='arial',
                size=12,
                color='#000'
            ),
            bgcolor='#E2E2E2',
            bordercolor='#FFFFFF',
            borderwidth=1.5
        )
    )

    if ecc:
        data = [trace0, trace1, trace2, trace3]
    else:
        data = [trace0, trace1, trace2]

    return go.Figure(
        data=data,
        layout=layout
    )
