import pandas as pd

# The goal of this code is to preprocess the file: 'ALLCOUNTRIES.csv'
def preprocess_file(path):
    countries = pd.read_csv(path)
    # the csv file contains lines with infromation that are not necessary, so we begin by removing them
    countries = countries.iloc[7:]
    # fit the columns names properly
    countries.columns = countries.iloc[0]
    countries = countries.iloc[1:]

    print(f"Number of lines:{len(countries)}")
    # remove countries that don't have all dates
    all_dates = set(countries["Time"].unique())

    valid_countries = (
        countries.groupby("Country")["Time"]
        .apply(lambda x: set(x) == all_dates)
    )
    countries = countries[countries["Country"].isin(valid_countries[valid_countries].index)]

    print(f"Number of lines:{len(countries)}")

    print("file preprocessed")
    return countries

if __name__=="__main__":
    file = preprocess_file("Data/raw/ALLCOUNTRIES.csv")
    file.to_csv("Data/preprocessed/ALLCOUNTRIES.csv")
    print("file saved to /Data/preprocessed")
