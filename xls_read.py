import pandas as pd


def read(decoded: str):
    """read the data from a .csv file and return the relevant dict data"""
    df = pd.read_excel(decoded)
    for item in df.columns:
        if 'n' in item.lower():
            y = df[item].astype(float)

        if 'm' in item.lower():
            x = df[item].astype(float)
    return x, y


if __name__ == '__main__':
    data = r"C:\Users\okoc\OneDrive - Dr. Sauer & " \
           r"Partners\Programming\Python\Dash\interaction_diagram " + \
           r"\NM.xlsx"
    x, y = read(data)
    print(x)