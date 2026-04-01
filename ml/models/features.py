import pandas as pd

import numpy as np

 

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:

    """

    Input:  DataFrame with columns [tag_id, value, recorded_at]

    Output: Wide DataFrame of engineered features per time point

    """

    df = df.copy()

 

    # Handle null/missing recorded_at values

    df['recorded_at'] = pd.to_datetime(df['recorded_at'], errors='coerce')

 

    # Fill missing timestamps with evenly spaced times

    if df['recorded_at'].isna().any():

        now = pd.Timestamp.now()

        null_count = df['recorded_at'].isna().sum()

        df.loc[df['recorded_at'].isna(), 'recorded_at'] = [

            now - pd.Timedelta(seconds=i*60)

            for i in range(null_count)

        ]

 

    # Drop any remaining NaT values

    df = df.dropna(subset=['recorded_at'])

 

    if df.empty:

        return pd.DataFrame()

 

    df = df.sort_values('recorded_at')

    features = pd.DataFrame()

 

    for tag_id in df['tag_id'].unique():

        s = df[df['tag_id'] == tag_id].set_index('recorded_at')['value']

 

        # Remove duplicate index values

        s = s[~s.index.duplicated(keep='last')]

 

        feat = pd.DataFrame(index=s.index)

        feat[f't{tag_id}_raw']  = s

        feat[f't{tag_id}_m1h']  = s.rolling('1h').mean()

        feat[f't{tag_id}_s1h']  = s.rolling('1h').std()

        feat[f't{tag_id}_m8h']  = s.rolling('8h').mean()

        feat[f't{tag_id}_m24h'] = s.rolling('24h').mean()

        feat[f't{tag_id}_roc']  = s.diff() / s.shift(1)

        baseline = s.mean()
    if baseline != 0:   
        feat[f't{tag_id}_dev']  = (s - baseline) / baseline * 100 

    else: 
        feat[f't{tag_id}_dev']  = s * 0

 
    if features.empty:
        features = feat  

    else: features = features.join(feat, how='outer')

    return features.ffill().bfill().fillna(0)