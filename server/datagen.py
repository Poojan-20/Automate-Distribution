import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta

def generate_sample_data():
    """
    Generate sample data files for the planner ranker system:
    1. Past 7 days data (historical data)
    2. User input data
    """
    # Set random seed for reproducibility
    np.random.seed(42)
    random.seed(42)
    
    # Define constants
    num_publishers = 3
    plans_per_publisher = 5
    days = 7
    
    publishers = [f"Publisher_{i}" for i in range(1, num_publishers + 1)]
    plan_ids = [f"Plan_{i}" for i in range(1, plans_per_publisher * num_publishers + 1)]
    subcategories = ["Finance", "Health", "Technology", "Travel", "Entertainment"]
    tags = ["Paid", "FOC", "Mandatory"]
    
    # Create mappings of plan_ids to publishers to ensure consistency
    plan_publisher_map = {}
    for i, plan_id in enumerate(plan_ids):
        publisher_idx = i // plans_per_publisher
        plan_publisher_map[plan_id] = publishers[publisher_idx]
    
    # Generate past 7 days data
    historical_data = []
    
    # Get date range for the past 7 days
    end_date = datetime.now().date()
    date_range = [(end_date - timedelta(days=i)) for i in range(1, days + 1)]
    
    for date in date_range:
        for plan_id, publisher in plan_publisher_map.items():
            # Generate random metrics
            distribution = random.randint(1000, 10000)
            # Ensure clicks are less than distribution
            clicks = random.randint(int(distribution * 0.01), int(distribution * 0.2))
            # Generate revenue with some correlation to clicks
            revenue = clicks * (random.uniform(0.5, 2.0))
            
            historical_data.append({
                'date': date,
                'plan_id': plan_id,
                'publisher': publisher,
                'distribution': distribution,
                'clicks': clicks,
                'revenue': revenue
            })
    
    # Create DataFrame for historical data
    historical_df = pd.DataFrame(historical_data)
    
    # Generate user input data
    user_input = []
    
    for plan_id, publisher in plan_publisher_map.items():
        # Randomly assign a tag
        tag = random.choice(tags)
        subcategory = random.choice(subcategories)
        
        # Generate appropriate values based on tag
        budget_cap = random.randint(1000, 5000) if tag == "Paid" else None
        clicks_to_be_delivered = random.randint(500, 2000) if tag == "FOC" else None
        distribution_count = random.randint(5000, 15000) if tag == "Mandatory" else None
        
        user_input.append({
            'plan_id': plan_id,
            'publisher': publisher,
            'subcategory': subcategory,
            'tags': tag,
            'budget_cap': budget_cap,
            'clicks_to_be_delivered': clicks_to_be_delivered,
            'distribution_count': distribution_count
        })
    
    # Create DataFrame for user input
    user_input_df = pd.DataFrame(user_input)
    
    # Save to CSV files
    historical_df.to_csv('past_7_days_data.csv', index=False)
    user_input_df.to_csv('user_input.csv', index=False)
    
    return historical_df, user_input_df

def display_sample_data(historical_df, user_input_df):
    """Display sample of the generated data"""
    print("\n===== SAMPLE OF PAST 7 DAYS DATA =====")
    print(historical_df.head(10))
    
    print("\n===== SAMPLE OF USER INPUT DATA =====")
    print(user_input_df.head(10))
    
    # Display some statistics
    print("\n===== DATA STATISTICS =====")
    print(f"Past 7 days data: {historical_df.shape[0]} records")
    print(f"Unique plan IDs: {historical_df['plan_id'].nunique()}")
    print(f"Unique publishers: {historical_df['publisher'].nunique()}")
    print(f"Date range: {historical_df['date'].min()} to {historical_df['date'].max()}")
    
    print("\nTag distribution in user input:")
    print(user_input_df['tags'].value_counts())

# Generate and display the sample data
if __name__ == "__main__":
    print("Generating sample data files...")
    historical_df, user_input_df = generate_sample_data()
    display_sample_data(historical_df, user_input_df)
    print("\nSample data files 'past_7_days_data.csv' and 'user_input.csv' have been generated.")