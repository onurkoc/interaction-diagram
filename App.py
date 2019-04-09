# -*- coding: utf-8 -*-
import dash
import dash_core_components as dcc
import dash_html_components as html
from dash.dependencies import Input, Output, State
from draw_diagram import draw
import dash_table
import core
import csv_read
import xls_read
import base64
import io
import pandas as pd
import cult_i
from textwrap import dedent

# external_stylesheets = ['https://codepen.io/chriddyp/pen/bWLwgP.css']


def Header(title):
    return html.Div(
        style={'borderBottom': 'thin lightgrey solid', 'marginRight': 20},
        children=[html.Div(title, style={'fontSize': 25})]
    )


def Row(children=None, **kwargs):
    return html.Div(
        children,
        className="row",
        **kwargs
    )


def Column(children=None, width=1, **kwargs):
    number_mapping = {
        1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six',
        7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven',
        12: 'twelve'
    }
    return html.Section(
        children,
        className="{} columns".format(number_mapping[width]),
        **kwargs
    )


def NamedDropdown(myId, name, **kwargs):
    return html.Div(
        style={'margin': '10px 0px'},
        children=[
            html.P(
                children=f'{name}',
                style={'margin-left': '3px'}
            ),
            dcc.Dropdown(id=myId, **kwargs)
        ]
    )


def NamedInput(myId, name, **kwargs):
    return html.Div(
        style={'margin': '10px 0px'},
        children=[
            html.P(
                children=f'{name}',
                style={'margin-left': '3px'}
            ),
            dcc.Input(id=myId, **kwargs)
        ]
    )


def NamedRadioItems(myId, name, **kwargs):
    return html.Div(
        style={'margin': '10px 0px'},
        children=[
            html.P(
                children=f'{name}',
                style={'margin-left': '3px'}
            ),
            dcc.RadioItems(id=myId, **kwargs)
        ]
    )


app = dash.Dash(__name__,
                # external_scripts=external_js,
                # external_stylesheets=external_stylesheets
                )

server = app.server


app.layout = html.Div([
    Header('Design of Reinforced Concrete Sections acc. to Eurocode 2 (EN '
           '1992-1-1)'),
    Row([
        dcc.Upload(
            id='upload-data',
            children=html.Div([
                'Drag and Drop File: ',
                html.I('"N-M.xlsx"'), ' or ',
                html.I('"ZSoil.csv"')
            ]),
            style={
                'width': '80%',
                'height': '40px',
                'lineHeight': '40px',
                'borderWidth': '1px',
                'borderStyle': 'dashed',
                'borderRadius': '5px',
                'textAlign': 'center',
                'margin': '10px'
            },
            multiple=False
        ),
    ]),
    Row([
        Column(width=2,
               style={'width': '10%',
                      'display': 'inline-block',
                      'marginBottom': 0,
                      'marginTop': 0,
                      'marginLeft': 0,
                      'marginRight': 0,
                      'padding': 0},
               children=[
                    html.Div([
                        NamedInput(
                            myId='height',
                            name='Height',
                            type='number',
                            value=0.35,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='width',
                            name='Width',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=1.0,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='concrete_cover_top',
                            name='Concrete Cover, Top',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=0.03,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='concrete_cover_bottom',
                            name='Concrete Cover, Bottom',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=0.03,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedDropdown(
                            myId='gamma_concrete',
                            name='Gamma Concrete',
                            options=[
                                {'label': '1.50', 'value': 1.50},
                                {'label': '1.20', 'value': 1.20},
                                {'label': '1.00', 'value': 1.00},
                                {'label': '0.85', 'value': 0.85},
                            ],
                            style={'width': 150},
                            multi=False,
                            value=1.50
                        )
                    ]),
                    html.Div([
                        NamedDropdown(
                            myId='gamma_steel',
                            name='Gamma Steel',
                            options=[
                                {'label': '1.15', 'value': 1.15},
                                {'label': '1.00', 'value': 1.00}
                            ],
                            style={'width': 150},
                            multi=False,
                            value=1.15
                        )
                    ]),
                    html.Div([
                        NamedDropdown(
                            myId='concrete_quality',
                            name='Concrete quality',
                            options=[
                                {'label': 'C20/25', 'value': 20},
                                {'label': 'C25/30', 'value': 25},
                                {'label': 'C30/37', 'value': 30},
                                {'label': 'C40/50', 'value': 40},
                            ],
                            style={'width': 150},
                            multi=False,
                            value=20
                        )
                    ]),
                    html.Div([
                        NamedDropdown(
                            myId='steel_quality',
                            name='Steel quality',
                            options=[
                                {'label': 'B420', 'value': 420},
                                {'label': 'B500', 'value': 500},
                                {'label': 'B550', 'value': 550},
                            ],
                            style={'width': 150},
                            multi=False,
                            value=550
                        )
                    ]),
                    html.Div([
                        NamedDropdown(
                            myId='load_factor',
                            name='Load factor',
                            options=[
                                {'label': '1.35', 'value': 1.35},
                                {'label': '1.40', 'value': 1.40},
                                {'label': '1.00', 'value': 1.00},
                            ],
                            style={'width': 150},
                            multi=False,
                            value=1.35
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='reinforcement_area_top',
                            name='Reinforcement Area, Top',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=2.58,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='reinforcement_area_bottom',
                            name='Reinforcement Area, Bottom',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=2.58,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                        NamedInput(
                            myId='alpha_cc',
                            name='Alpha cc',
                            placeholder='Enter a value...',
                            inputmode='numeric',
                            type='number',
                            value=1.00,
                            style={'width': 150}
                        )
                    ]),
                    html.Div([
                       NamedRadioItems(
                           myId='eccentricity',
                           name='Limit capacity?',
                           options=[
                                {'label': 'Yes', 'value': 'yes'},
                                {'label': 'No', 'value': 'no'}
                            ],
                           value='no',
                           labelStyle={'display': 'inline-block'}
                       )
                    ]),
                    html.Div([
                       NamedRadioItems(
                           myId='cult-i',
                           name='CULT-I?',
                           options=[
                                {'label': 'Yes', 'value': 'yes'},
                                {'label': 'No', 'value': 'no'}
                            ],
                           value='yes',
                           labelStyle={'display': 'inline-block'}
                       )
                    ])
               ]),
        Column(
            width=5,
            style={'width': '60%',
                   'display': 'inline-block',
                   'marginBottom': 0,
                   'marginTop': 0,
                   'marginLeft': 0,
                   'marginRight': 0,
                   'padding': 0},
            children=[
                html.Div(id='output-diagram'),
                Row(id='Source Code',
                    children=[
                         dcc.Markdown(dedent(
                         '''
                         [Source Code](https://github.com/onurkoc/interaction-diagram)
                         '''))]
                    )
            ]
        ),
        Column(
            width=3,
            style={'width': '10%',
                   'display': 'inline-block',
                   'marginBottom': 0,
                   'marginTop': 0,
                   'marginLeft': 0,
                   'marginRight': 0,
                   'padding': 0},
            children=[
                html.Br(),
                html.P('Design Values',
                       style={'color': 'red', 'fontSize': 18}),
                html.Div(id='output-table')
            ]
        )
    ])
])


def parse_contents(contents, filename, last_modified):
    file_A = contents
    content_type, content_string = file_A.split(',')
    decoded = base64.b64decode(content_string)
    try:
        if 'csv' in filename:
            # Assuming user uploaded a csv file
            try:
                decoded_str = io.StringIO(decoded.decode('utf-8'))
                x, y = csv_read.read(decoded_str)
            except Exception as e:
                print(e)
                return html.H3(['There has been an upload error<br>First '
                                'exception'])
        elif 'xls' in filename:
            # Assuming user uploaded an excel file
            decoded_str = io.BytesIO(decoded)
            x, y = xls_read.read(decoded_str)
        else:
            return html.H3(['There has been an upload error<br>Second '
                            'exception'])
    except Exception as e:
        print(e)
        return html.H3(['There has been an upload error<br>Third exception'])
    else:
        return x, y


@app.callback(
    Output(component_id='output-diagram', component_property='children'),
    [Input(component_id='height', component_property='value'),
     Input(component_id='width', component_property='value'),
     Input(component_id='concrete_cover_top', component_property='value'),
     Input(component_id='concrete_cover_bottom', component_property='value'),
     Input(component_id='gamma_concrete', component_property='value'),
     Input(component_id='gamma_steel', component_property='value'),
     Input(component_id='load_factor', component_property='value'),
     Input(component_id='reinforcement_area_top', component_property='value'),
     Input(component_id='reinforcement_area_bottom',
           component_property='value'),
     Input(component_id='concrete_quality', component_property='value'),
     Input(component_id='steel_quality', component_property='value'),
     Input(component_id='alpha_cc', component_property='value'),
     Input(component_id='eccentricity', component_property='value'),
     Input(component_id='cult-i', component_property='value'),
     Input(component_id='upload-data', component_property='contents')],
    [State(component_id='upload-data', component_property='filename'),
     State(component_id='upload-data', component_property='last_modified')]
)
def update_output_fig(h, b, d_1, d_2, gamma_c, gamma_s, gamma_d, a_s1, a_s2,
                      f_ck, f_yk, alpha_cc, eccentricity, cult, contents,
                      filename,
                      last_modified):
    if filename is not None:
        try:
            x, y = parse_contents(contents, filename, last_modified)
        except (ValueError, TypeError, AttributeError) as e:
            print(e)
            return html.H3([
                'Please feed data'
            ])
    else:
        return html.H3(['No data available'])

    if eccentricity == 'yes':
        ecc = True
    else:
        ecc = False

    values = core.int_diagram(h_=h, b_=b, d_1=d_1, d_2=d_2, gamma_c=gamma_c,
                              gamma_s=gamma_s, gamma_d=gamma_d, a_s1=a_s1,
                              a_s2=a_s2, f_ck=f_ck, f_yk=f_yk,
                              alpha_cc=alpha_cc, eccentricity=ecc)
    i_val, val = values

    if cult == 'yes':
        index = []
        for m, n in zip(gamma_d*x/1000, gamma_d*y/1000):
            index.append(cult_i.cult_I(m=m,
                                       n=n,
                                       input_values=i_val,
                                       values=val)
                         )
        val['cult-I'] = index
    values = (i_val, val)
    try:
        graph = dcc.Graph(
                    figure=draw(values=values,
                                x=gamma_d*x/1000,
                                y=gamma_d*y/1000)
                )
    except (NameError, TypeError) as e:
        print(e)
        return html.H3(['No data available'])
    else:
        return graph


@app.callback(
    Output(component_id='output-table', component_property='children'),
    [Input(component_id='upload-data', component_property='contents'),
     Input(component_id='load_factor', component_property='value')],
    [State(component_id='upload-data', component_property='filename'),
     State(component_id='upload-data', component_property='last_modified')]
)
def update_output_table(contents, factor, filename, last_modified):
    if contents is None:
        return
    x, y = parse_contents(contents, filename, last_modified)
    df = pd.DataFrame.from_dict({'m [kN.m]': (factor*x).round(decimals=3),
                                 'n [kN]': (factor*y).round(decimals=1)})
    return dash_table.DataTable(data=df.to_dict('rows'),
                                columns=[{'id': c, 'name': c}
                                for c in df.columns],
                                style_table={'maxHeight': '500',
                                             'overflowY': 'scroll'},
                                style_header={
                                    'fontWeight': 'bold'
                                },
                                n_fixed_rows=1,
                                style_as_list_view=True,
                                style_cell={
                                    'minWidth': '0px',
                                    'maxWidth': '20px',
                                    'textAlign': 'center'
                                }
                                )


if __name__ == '__main__':
    app.run_server(debug=True)
