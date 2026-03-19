import pandas as pd

data = pd.read_csv("../../Data/preprocessed/production_merged.csv")
data = data[data["value"]> 0]
print(data.groupby("source")["value"].mean())

print(f"total production : {data['value'].sum()}")
print(f"most producing country: {pd.DataFrame(data.groupby('zone')['value'].sum()).max()}")


total = data.groupby('datetime')['value'].sum()
mu = total.mean()
std = total.std()
coeff_variation = std / mu
print(f" coef variation: {coeff_variation}")

