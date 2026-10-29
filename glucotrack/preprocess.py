import pandas as pd
import os

base_dir = os.path.dirname(__file__)
august_path = os.path.join(base_dir, "August 2026.csv")
sept_path = os.path.join(base_dir, "September 2026.csv")
output_path = os.path.join(base_dir, "processed_glucotrack.csv")

# 1. Load CSVs
df_aug = pd.read_csv(august_path)
df_sept = pd.read_csv(sept_path)

# 2. Combine datasets and remove exact duplicated rows
df = pd.concat([df_aug, df_sept], ignore_index=True)
df = df.drop_duplicates()

# 3. Clean column headers (standardizes spaces and casing)
df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')

# 4. Fill missing food entries with 'none' instead of dropping the row entirely
if 'food_eaten' in df.columns:
    df['food_eaten'] = df['food_eaten'].fillna('none')

# Fill missing numerical entries (e.g. carbs) with 0 instead of dropping rows
num_cols = df.select_dtypes(include=['float64', 'int64']).columns
df[num_cols] = df[num_cols].fillna(0)

# Save combined dataset retaining date, time, and food info
df.to_csv(output_path, index=False)
print("Successfully processed dataset preserving all columns!")