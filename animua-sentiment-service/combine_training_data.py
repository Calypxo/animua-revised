import pandas as pd

main_file = "surrender_sentiment_dataset.csv"
additional_file = "additional_training.csv"
output_file = "surrender_sentiment_dataset.csv"

main_df = pd.read_csv(main_file)
additional_df = pd.read_csv(additional_file)

combined_df = pd.concat([main_df, additional_df], ignore_index=True)

combined_df = combined_df.drop_duplicates(subset=["reason"])

combined_df.to_csv(output_file, index=False, encoding="utf-8-sig")

print("Done combining training data.")
print("Original rows:", len(main_df))
print("Additional rows:", len(additional_df))
print("Final rows:", len(combined_df))
print("Saved as:", output_file)