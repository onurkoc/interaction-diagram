import pandas as pd


def read(data: str):
    """read the data from a .csv file and return the relevant dict data"""
    df = pd.read_csv(data, sep=';', header=1)
    df.drop(0, axis=0, inplace=True)
    df.reset_index(drop=True, inplace=True)
    for item in df.columns:
        if 'Forces-NX' in item:
            y = df[item].astype(float)

        if 'Moments-MZ' in item:
            x = df[item].astype(float)
    try:
        x, y
    except AttributeError as e:
        print(e)
    else:
        return x, y


if __name__ == '__main__':
    data = r"C:\temp\ZSoil\Road_60\New_Tunnel\V3.3\Results" + \
           r"\SF_1.3_NoAbutment.csv"
    x, y = read(data)
    print(x)
