import pandas as pd
import xgboost as xgb
from sklearn.model_selection import cross_val_score, KFold
import pickle

# 1. Load data
aug_df = pd.read_csv("August 2026.csv")
sep_df = pd.read_csv("September 2026.csv")
df = pd.concat([aug_df, sep_df], ignore_index=True)

# Clean column names
df.columns = df.columns.str.strip()
if 'Reading Type' in df.columns:
    df['Reading Type'] = df['Reading Type'].astype(str).str.strip()

# 2. Reverse dataframe so it's chronological (oldest to newest)
df = df.iloc[::-1].reset_index(drop=True)

# 3. Convert columns to numeric
df['Glucose (mmol/L)'] = pd.to_numeric(df['Glucose (mmol/L)'], errors='coerce')
df['Net Carbs (g)'] = pd.to_numeric(df['Net Carbs (g)'], errors='coerce')

# 4. Create historical features using sequential shift (previous row)
df['Prev_Glucose'] = df['Glucose (mmol/L)'].shift(1)
df['Prev_Carbs'] = df['Net Carbs (g)'].shift(1)

# Forward-fill starting baseline glucose as a fallback
df['Starting_Glucose'] = df['Glucose (mmol/L)'].ffill()

# 5. Filter for Post-Meal rows 
post_meals = df[df['Reading Type'] == 'Post-Meal'].copy()
post_meals['Net Carbs (g)'] = post_meals['Net Carbs (g)'].fillna(0)
post_meals['Prev_Carbs'] = post_meals['Prev_Carbs'].fillna(0)

print(f"Total post-meal rows found: {len(post_meals)}")

# Features: Current meal carbs, starting glucose, previous glucose, and previous meal carbs
features = [
    'Net Carbs (g)', 
    'Starting_Glucose', 
    'Prev_Glucose', 
    'Prev_Carbs'
]

# Clean data by dropping rows missing core values or the previous reading
clean_data = post_meals.dropna(subset=['Glucose (mmol/L)', 'Prev_Glucose'])

X_clean = clean_data[features]
y_clean = clean_data['Glucose (mmol/L)']

print(f"Total valid post-meal samples for training with history: {len(X_clean)}")

if len(X_clean) < 5:
    raise ValueError("Error: Still too few samples!")

# 6. Initialize XGBoost and Train
model = xgb.XGBRegressor(
    n_estimators=50, 
    max_depth=3, 
    learning_rate=0.05, 
    random_state=42
)

if len(X_clean) > 10:
    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X_clean, y_clean, cv=cv, scoring='r2')
    print(f"Average Cross-Validation R² Score: {cv_scores.mean():.4f}")

model.fit(X_clean, y_clean)
with open("glucotrack_xgb.pkl", "wb") as f:
    pickle.dump(model, f)

print("Updated XGBoost model successfully saved as glucotrack_xgb.pkl!")