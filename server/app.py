import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import json
from werkzeug.utils import secure_filename

app = Flask(__name__)
# Configure CORS with more explicit settings
CORS(app, resources={r"/*": {"origins": "*", "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'
ALLOWED_EXTENSIONS = {'csv', 'xlsx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER

# Variable to store the latest ranking results
latest_rankings = {
    "all_publishers": [],
    "by_publisher": {}
}

# Add a root route for basic connectivity testing
@app.route('/', methods=['GET'])
def index():
    return jsonify({"status": "API is running"}), 200

# Add a route to fix the process-data endpoint without the /api prefix
@app.route('/process-data', methods=['POST', 'OPTIONS'])
def process_data_alt():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
    # Redirect to the main process_data function
    return process_data()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def json_to_csv(data, filename):
    """Convert JSON data to CSV file and save it"""
    try:
        # Handle arrays in publisher and tags fields
        processed_data = []
        for item in data:
            # Make a copy of the item to avoid modifying the original
            processed_item = dict(item)
            
            # Handle publisher array
            if 'publisher' in processed_item and isinstance(processed_item['publisher'], list):
                # Keep as array in data, will be handled in processing
                pass
            
            # Handle tags array
            if 'tags' in processed_item and isinstance(processed_item['tags'], list):
                # Keep as array in data, will be handled in processing
                pass

            # Rename distribution_count to distribution if needed in user input
            if 'distribution_count' in processed_item and 'distribution' not in processed_item:
                processed_item['distribution'] = processed_item['distribution_count']
                
            processed_data.append(processed_item)
            
        # Convert to DataFrame
        df = pd.DataFrame(processed_data)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        df.to_csv(filepath, index=False)
        return filepath
    except Exception as e:
        print(f"Error converting JSON to CSV: {str(e)}")
        raise

class PlannerRankerSystem:
    def __init__(self, historical_data_path, user_input_path, weights=None):
        """
        Initialize the Planner Ranker System
        
        Parameters:
        -----------
        historical_data_path : str
            Path to the CSV file containing past 7 days data
        user_input_path : str
            Path to the CSV file containing user input data
        weights : dict, optional
            Weights for CTR, EPC and Revenue rankings. Default is {CTR: 0.3, EPC: 0.4, Revenue: 0.3}
        """
        # Default weights if not provided or invalid
        if not weights or not isinstance(weights, dict):
            self.weights = {'CTR': 0.33, 'EPC': 0.33, 'Revenue': 0.33}
        else:
            # Ensure all required keys are present
            self.weights = {
                'CTR': weights.get('CTR', 0.33),
                'EPC': weights.get('EPC', 0.33),
                'Revenue': weights.get('Revenue', 0.33)
            }
        
        print(f"Initialized with weights: {self.weights}")
        
        # Load the data
        self.historical_data = pd.read_csv(historical_data_path)
        self.user_input = pd.read_csv(user_input_path)
        
        # Process publisher arrays if they're stored as strings
        if 'publisher' in self.user_input.columns:
            try:
                # Try to convert string representations of lists to actual lists
                self.user_input['publisher'] = self.user_input['publisher'].apply(
                    lambda x: eval(x) if isinstance(x, str) and x.startswith('[') else [x] if isinstance(x, str) else x
                )
            except:
                # If conversion fails, keep as is
                pass
        
        # Process tags arrays if they're stored as strings
        if 'tags' in self.user_input.columns:
            try:
                # Try to convert string representations of lists to actual lists
                self.user_input['tags'] = self.user_input['tags'].apply(
                    lambda x: eval(x) if isinstance(x, str) and x.startswith('[') else [x] if isinstance(x, str) else x
                )
            except:
                # If conversion fails, keep as is
                pass
        
        # Create output directory if it doesn't exist
        if not os.path.exists('output'):
            os.makedirs('output')
            
    def calculate_metrics(self):
        """Calculate rolling average CTR, EPC, and Revenue for each Plan ID by Publisher"""
        # Add debugging
        print("Historical data sample:", self.historical_data.head(2).to_dict('records'))
        
        # Handle division by zero
        # Calculate CTR for each row: clicks / distribution (avoid division by zero)
        self.historical_data['CTR'] = self.historical_data.apply(
            lambda row: row['clicks'] / row['distribution'] if row['distribution'] > 0 else 0, 
            axis=1
        )
        
        # Calculate EPC for each row: revenue / clicks (avoid division by zero)
        self.historical_data['EPC'] = self.historical_data.apply(
            lambda row: row['revenue'] / row['clicks'] if row['clicks'] > 0 else 0,
            axis=1
        )
        
        # Group by publisher and plan_id to calculate averages
        metrics = self.historical_data.groupby(['publisher', 'plan_id']).agg({
            'CTR': 'mean',
            'EPC': 'mean',
            'revenue': 'mean',
            'clicks': 'sum',
            'distribution': 'sum'
        }).reset_index()
        
        # Rename revenue column to avg_revenue for clarity
        metrics = metrics.rename(columns={'revenue': 'avg_revenue'})
        
        # Debug
        print("Calculated metrics sample:", metrics.head(2).to_dict('records'))
        
        # Save Step 1 output
        metrics.to_excel('output/step1_avg_metrics.xlsx', index=False)
        
        return metrics
    
    def calculate_ranks(self, metrics):
        """Calculate rank for each metric within each publisher"""
        # Group by publisher and rank each metric in descending order
        ranked_data = metrics.copy()
        
        # Replace any NaN values with 0
        ranked_data = ranked_data.fillna(0)
        
        # Debug info
        print(f"Metrics shape before ranking: {ranked_data.shape}")
        print(f"Metrics columns: {ranked_data.columns.tolist()}")
        print(f"Any NaN values: {ranked_data.isna().any().any()}")
        
        # For each publisher, rank the metrics (higher values get better ranks)
        publishers = ranked_data['publisher'].unique()
        
        for publisher in publishers:
            publisher_mask = ranked_data['publisher'] == publisher
            publisher_data = ranked_data[publisher_mask]
            
            if len(publisher_data) > 0:
                print(f"Ranking data for publisher: {publisher}, count: {len(publisher_data)}")
                
                # Ensure there are enough non-zero values to rank
                ctr_values = publisher_data['CTR'].values
                epc_values = publisher_data['EPC'].values
                revenue_values = publisher_data['avg_revenue'].values
                
                # Initialize ranks with default value 1 (top rank)
                ranked_data.loc[publisher_mask, 'CTR_rank'] = 1
                ranked_data.loc[publisher_mask, 'EPC_rank'] = 1
                ranked_data.loc[publisher_mask, 'avg_revenue_rank'] = 1
                
                # Only rank if we have more than one row and at least one non-zero value
                if len(publisher_data) > 1:
                    # Rank CTR (descending) if we have any non-zero values
                    if np.sum(ctr_values > 0) > 0:
                        ranked_data.loc[publisher_mask, 'CTR_rank'] = ranked_data.loc[publisher_mask, 'CTR'].rank(ascending=False, method='min')
                    
                    # Rank EPC (descending) if we have any non-zero values
                    if np.sum(epc_values > 0) > 0:
                        ranked_data.loc[publisher_mask, 'EPC_rank'] = ranked_data.loc[publisher_mask, 'EPC'].rank(ascending=False, method='min')
                    
                    # Rank Revenue (descending) if we have any non-zero values
                    if np.sum(revenue_values > 0) > 0:
                        ranked_data.loc[publisher_mask, 'avg_revenue_rank'] = ranked_data.loc[publisher_mask, 'avg_revenue'].rank(ascending=False, method='min')
        
        # Ensure no NaN values in rank columns
        ranked_data['CTR_rank'] = ranked_data['CTR_rank'].fillna(1)
        ranked_data['EPC_rank'] = ranked_data['EPC_rank'].fillna(1)
        ranked_data['avg_revenue_rank'] = ranked_data['avg_revenue_rank'].fillna(1)
        
        # Debug info
        print(f"Ranked data shape: {ranked_data.shape}")
        print(f"Any NaN values after ranking: {ranked_data.isna().any().any()}")
        
        # Save Step 2 output
        ranked_data.to_excel('output/step2_ranked_metrics.xlsx', index=False)
        
        return ranked_data
    
    def calculate_weighted_rank(self, ranked_data):
        """Calculate weighted average rank based on provided weights"""
        weighted_data = ranked_data.copy()
        
        # Ensure no NaN values
        weighted_data = weighted_data.fillna(0)
        
        # Print debug info
        print(f"Weighted rank calculation - Input shape: {weighted_data.shape}")
        print(f"Weight factors: {self.weights}")
        
        # Check if rank columns exist
        required_columns = ['CTR_rank', 'EPC_rank', 'avg_revenue_rank']
        for col in required_columns:
            if col not in weighted_data.columns:
                print(f"ERROR: Missing required column {col}")
                weighted_data[col] = 1  # Default to rank 1 if missing
        
        # Default any NaN rank values to 1 (best rank)
        for col in required_columns:
            weighted_data[col] = weighted_data[col].fillna(1)
        
        # Calculate weighted average rank with very defensive error handling
        try:
            # Extract and verify weight values
            ctr_weight = float(self.weights.get('CTR', 0.33))
            epc_weight = float(self.weights.get('EPC', 0.33))
            revenue_weight = float(self.weights.get('Revenue', 0.33))
            
            print(f"Using weights: CTR={ctr_weight}, EPC={epc_weight}, Revenue={revenue_weight}")
            
            # Calculate the weighted rank
            weighted_data['weighted_rank'] = (
                ctr_weight * weighted_data['CTR_rank'] +
                epc_weight * weighted_data['EPC_rank'] +
                revenue_weight * weighted_data['avg_revenue_rank']
            )
            print("Successfully calculated weighted ranks")
        except Exception as e:
            print(f"Error calculating weighted rank: {str(e)}")
            print(f"Data sample: {weighted_data.head(2).to_dict('records')}")
            print(f"Weight dictionary: {self.weights}")
            print(f"Weight dictionary type: {type(self.weights)}")
            print(f"Weight keys: {self.weights.keys() if hasattr(self.weights, 'keys') else 'No keys method'}")
            
            # If calculation fails, set a default weighted rank of 1
            weighted_data['weighted_rank'] = 1
        
        # Replace any NaN in weighted_rank with 1
        weighted_data['weighted_rank'] = weighted_data['weighted_rank'].fillna(1)
        
        # Debug info
        print(f"Any NaN values in weighted rank: {weighted_data['weighted_rank'].isna().any()}")
        print(f"Weighted rank range: {weighted_data['weighted_rank'].min()} to {weighted_data['weighted_rank'].max()}")
        
        # Save Step 3 output
        weighted_data.to_excel('output/step3_weighted_ranks.xlsx', index=False)
        
        return weighted_data
    
    def calculate_final_rank(self, weighted_data):
        """Calculate final rank based on weighted average (ascending order)"""
        final_data = weighted_data.copy()
        
        # Ensure no NaN values
        final_data = final_data.fillna(0)
        
        print(f"Final rank calculation - input shape: {final_data.shape}")
        
        # For each publisher, rank based on weighted rank (ascending order - lower weighted rank is better)
        publishers = final_data['publisher'].unique()
        
        # Initialize final_rank with default value 1
        final_data['final_rank'] = 1
        
        for publisher in publishers:
            publisher_mask = final_data['publisher'] == publisher
            publisher_data = final_data[publisher_mask]
            
            if len(publisher_data) > 0:
                print(f"Calculating final rank for publisher: {publisher}, count: {len(publisher_data)}")
                
                # Only rank if we have more than one row
                if len(publisher_data) > 1:
                    try:
                        final_data.loc[publisher_mask, 'final_rank'] = final_data.loc[publisher_mask, 'weighted_rank'].rank(method='min')
                    except Exception as e:
                        print(f"Error ranking for publisher {publisher}: {str(e)}")
                        # Keep default rank of 1
        
        # Ensure no NaN values in final_rank
        final_data['final_rank'] = final_data['final_rank'].fillna(1)
        
        # Debug info
        print(f"Final rank range: {final_data['final_rank'].min()} to {final_data['final_rank'].max()}")
        print(f"Any NaN values in final rank: {final_data['final_rank'].isna().any()}")
        
        # Save Step 4 output
        final_data.to_excel('output/step4_final_ranks.xlsx', index=False)
        
        return final_data
    
    def format_ranking_data(self, final_output):
        """Format numerical values in the final output for better display"""
        formatted_output = final_output.copy()
        
        # Round distribution to integers
        if 'distribution' in formatted_output.columns:
            formatted_output['distribution'] = formatted_output['distribution'].apply(
                lambda x: round(x) if pd.notnull(x) else 0
            )
        
        # Round revenue to integers
        if 'avg_revenue' in formatted_output.columns:
            formatted_output['avg_revenue'] = formatted_output['avg_revenue'].apply(
                lambda x: round(x) if pd.notnull(x) else 0
            )
        
        # Round EPC to 2 decimal places
        if 'EPC' in formatted_output.columns:
            formatted_output['EPC'] = formatted_output['EPC'].apply(
                lambda x: round(x, 2) if pd.notnull(x) else 0
            )
            
        # Format CTR as percentage with 2 decimal places
        if 'CTR' in formatted_output.columns:
            formatted_output['CTR'] = formatted_output['CTR'].apply(
                lambda x: round(x * 100, 2) if pd.notnull(x) else 0
            )
            
        # Round expected_clicks to integers
        if 'expected_clicks' in formatted_output.columns:
            formatted_output['expected_clicks'] = formatted_output['expected_clicks'].apply(
                lambda x: round(x) if pd.notnull(x) else 0
            )
            
        # Round budget_cap to integers
        if 'budget_cap' in formatted_output.columns:
            formatted_output['budget_cap'] = formatted_output['budget_cap'].apply(
                lambda x: round(x) if pd.notnull(x) else 0
            )
        
        return formatted_output
    
    def calculate_distribution_count(self, final_data):
        """Calculate distribution count based on tags"""
        # Create a list to store merged rows
        result_rows = []
        
        # For each plan in final_data
        for _, plan_row in final_data.iterrows():
            # Find matching user input rows
            matches = []
            for _, user_row in self.user_input.iterrows():
                # Check if plan_id matches and publisher is in the publisher array
                publisher_match = False
                if isinstance(user_row['publisher'], list):
                    publisher_match = plan_row['publisher'] in user_row['publisher']
                else:
                    publisher_match = plan_row['publisher'] == user_row['publisher']
                
                if user_row['plan_id'] == plan_row['plan_id'] and publisher_match:
                    matches.append(user_row)
            
            # Process each matching row
            for user_row in matches:
                # Create a merged row
                merged_row = plan_row.copy()
                
                # Extract tags
                tags = user_row['tags']
                if isinstance(tags, list):
                    tag = tags[0] if tags else ''
                else:
                    tag = tags
                
                # Add tag to merged row
                merged_row['tags'] = tag
                
                # Calculate distribution count based on tag
                if tag == 'FOC':
                    # FOC: clicks_to_be_delivered / CTR
                    clicks_to_deliver = user_row.get('clicks_to_be_delivered', 0)
                    ctr = merged_row.get('CTR', 0)
                    # Avoid division by zero
                    if ctr > 0 and clicks_to_deliver > 0:
                        merged_row['distribution'] = clicks_to_deliver / ctr
                    else:
                        merged_row['distribution'] = 0
                
                elif tag == 'Mandatory':
                    # Mandatory: distribution count is already provided
                    merged_row['distribution'] = user_row.get('distribution', 0)
                
                elif tag == 'Paid':
                    # Paid: (budget_cap / avg_EPC) / CTR
                    budget_cap = user_row.get('budget_cap', 0)
                    epc = merged_row.get('EPC', 0) 
                    ctr = merged_row.get('CTR', 0)
                    
                    # Avoid division by zero
                    if epc > 0 and ctr > 0 and budget_cap > 0:
                        clicks_to_be_delivered = budget_cap / epc
                        merged_row['distribution'] = clicks_to_be_delivered / ctr
                    else:
                        merged_row['distribution'] = 0
                
                # Calculate expected clicks
                merged_row['expected_clicks'] = merged_row['distribution'] * merged_row['CTR']
                
                # Add budget_cap from user input
                merged_row['budget_cap'] = user_row.get('budget_cap', 0)
                
                # Add subcategory and other user input fields
                for col in user_row.index:
                    if col not in merged_row.index:
                        merged_row[col] = user_row[col]
                
                # Add to result rows
                result_rows.append(merged_row)
        
        # Convert to DataFrame
        if result_rows:
            result = pd.DataFrame(result_rows)
            
            # Select required columns for final output
            columns_to_keep = [
                'publisher', 'plan_id', 'EPC', 'CTR', 'avg_revenue', 
                'final_rank', 'distribution', 'tags', 'subcategory',
                'expected_clicks', 'budget_cap'
            ]
            # Only keep columns that exist
            final_columns = [col for col in columns_to_keep if col in result.columns]
            final_output = result[final_columns]
            
            # Sort by publisher and final rank
            final_output = final_output.sort_values(['publisher', 'final_rank'])
            
            # Format the numerical values for better display
            final_output = self.format_ranking_data(final_output)
            
            # Save Final output to Excel with each publisher in a separate sheet
            with pd.ExcelWriter('output/final_planner_ranking.xlsx') as writer:
                # Save all data to a main sheet
                final_output.to_excel(writer, sheet_name='All Publishers', index=False)
                
                # Save each publisher to its own sheet
                publishers = final_output['publisher'].unique()
                for publisher in publishers:
                    publisher_data = final_output[final_output['publisher'] == publisher]
                    publisher_data.to_excel(writer, sheet_name=publisher, index=False)
            
            return final_output
        else:
            # Return empty DataFrame with required columns
            return pd.DataFrame(columns=['publisher', 'plan_id', 'EPC', 'CTR', 'avg_revenue', 
                                        'final_rank', 'distribution', 'tags', 'subcategory',
                                        'expected_clicks', 'budget_cap'])

@app.route('/api/process-data', methods=['POST', 'OPTIONS'])
def process_data():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        print("Process data endpoint called")
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
        
        data = request.get_json()
        
        if 'historical_data' not in data or 'user_input' not in data:
            return jsonify({"error": "Missing required data"}), 400
        
        print(f"Historical data sample: {data['historical_data'][0] if data['historical_data'] else 'No data'}")
        print(f"User input sample: {data['user_input'][0] if data['user_input'] else 'No data'}")
        
        # Save JSON data to temporary files
        historical_file = json_to_csv(data['historical_data'], 'historical_data.csv')
        user_input_file = json_to_csv(data['user_input'], 'user_input.csv')
        
        # Get weights or use default
        weights = data.get('weights', None)
        print(f"Using weights: {weights}")
        
        # Initialize the PlannerRankerSystem
        ranker = PlannerRankerSystem(historical_file, user_input_file, weights)
        
        # Execute the ranking process
        metrics = ranker.calculate_metrics()
        ranked_data = ranker.calculate_ranks(metrics)
        weighted_data = ranker.calculate_weighted_rank(ranked_data)
        final_ranked_data = ranker.calculate_final_rank(weighted_data)
        final_rankings = ranker.calculate_distribution_count(final_ranked_data)
        
        # Store the final rankings for the get-rankings endpoint
        global latest_rankings
        
        # Convert the final_rankings DataFrame to a list of dictionaries
        all_publishers_data = final_rankings.to_dict('records')
        
        # Group rankings by publisher and ensure all needed fields are present
        by_publisher = {}
        for record in all_publishers_data:
            # Ensure expected_clicks and budget_cap are present
            record.setdefault('expected_clicks', 0) 
            record.setdefault('budget_cap', 0)
            
            publisher = record.get('publisher', 'Unknown')
            if publisher not in by_publisher:
                by_publisher[publisher] = []
            by_publisher[publisher].append(record)
        
        # Store the latest rankings
        latest_rankings = {
            "all_publishers": all_publishers_data,
            "by_publisher": by_publisher
        }
        
        # Debug the output
        if all_publishers_data:
            print(f"First record fields: {all_publishers_data[0].keys()}")
            print(f"Expected clicks in first record: {all_publishers_data[0].get('expected_clicks', 'NOT FOUND')}")
            print(f"Budget cap in first record: {all_publishers_data[0].get('budget_cap', 'NOT FOUND')}")
        
        return jsonify({
            "status": "success",
            "message": "Data processed successfully",
            "result_file": "final_planner_ranking.xlsx"
        })
        
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-rankings', methods=['GET', 'OPTIONS'])
def get_rankings():
    """Return the latest ranking results"""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
        
    global latest_rankings
    
    # Add more debugging info
    print("GET /api/get-rankings called")
    print(f"Latest rankings data available: {bool(latest_rankings['all_publishers'])}")
    if latest_rankings["all_publishers"]:
        print(f"Number of records: {len(latest_rankings['all_publishers'])}")
        if latest_rankings["all_publishers"]:
            print(f"Sample record: {latest_rankings['all_publishers'][0]}")
            print(f"Available fields: {list(latest_rankings['all_publishers'][0].keys())}")
    
    if not latest_rankings["all_publishers"]:
        print("No ranking data available to return")
        return jsonify({"error": "No ranking data available"}), 404

    # Ensure all required fields are present in the response
    for record in latest_rankings["all_publishers"]:
        record.setdefault('expected_clicks', 0)
        record.setdefault('budget_cap', 0)
        record.setdefault('CTR', 0)
        record.setdefault('EPC', 0)
        record.setdefault('avg_revenue', 0)
        record.setdefault('distribution', 0)
        record.setdefault('final_rank', 0)
        record.setdefault('tags', '')
        record.setdefault('subcategory', '')

    return jsonify(latest_rankings)

@app.route('/api/download-rankings', methods=['GET', 'OPTIONS'])
def download_rankings():
    """Download the final rankings Excel file"""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        file_path = os.path.join(app.config['OUTPUT_FOLDER'], 'final_planner_ranking.xlsx')
        
        if not os.path.exists(file_path):
            return jsonify({"error": "Ranking file not found"}), 404
        
        return send_file(
            file_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'distribution_rankings_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )

    except Exception as e:
        print(f"Error downloading file: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/validate-data', methods=['POST', 'OPTIONS'])
def validate_data():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        # Get JSON data from request
        data = request.get_json()

        if not data or 'data' not in data:
            return jsonify({'error': 'No data provided'}), 400

        # Convert to DataFrame for validation
        df = pd.DataFrame(data['data'])
        
        # Return basic validation info
        validation_result = {
            'columns': list(df.columns),
            'row_count': len(df),
            'sample_data': df.head(5).to_dict(orient='records')
        }

        return jsonify(validation_result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)