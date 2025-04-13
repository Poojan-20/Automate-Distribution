from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
import urllib3
from werkzeug.utils import secure_filename
from io import BytesIO
import traceback

app = Flask(__name__)
# Configure CORS for compatibility with Next.js
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Disposition"]
    }
})

# Setup logging
import logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('api.log')
    ]
)
logger = logging.getLogger(__name__)
logger.info("API Starting")

# Get the absolute path to the client/api directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'output')

# Create directories if they don't exist
for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER]:
    if not os.path.exists(folder):
        os.makedirs(folder)
        logger.info(f"Created directory: {folder}")

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

logger.info(f"Upload folder set to: {UPLOAD_FOLDER}")
logger.info(f"Output folder set to: {OUTPUT_FOLDER}")

# Store file paths globally
RANKING_FILE = os.path.join(OUTPUT_FOLDER, 'final_planner_ranking.xlsx')
PERFORMANCE_FILE = os.path.join(OUTPUT_FOLDER, 'overall_performance_report.xlsx')

# Variable to store the latest ranking results
latest_rankings = {
    "all_publishers": [],
    "by_publisher": {}
}

ALLOWED_EXTENSIONS = {'csv', 'xlsx'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def json_to_csv(data, filename):
    """Convert JSON data to CSV file and save it"""
    try:
        processed_data = []
        for item in data:
            processed_item = dict(item)
            
            # Handle publisher array
            if 'publisher' in processed_item and isinstance(processed_item['publisher'], list):
                # If publisher is a list, convert it to a string representation
                processed_item['publisher'] = str(processed_item['publisher'])
            
            # Handle tags array
            if 'tags' in processed_item and isinstance(processed_item['tags'], list):
                # If tags is a list, convert it to a string representation
                processed_item['tags'] = str(processed_item['tags'])

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

def save_excel_file(df: pd.DataFrame, filename: str) -> str:
    """Save DataFrame to Excel file and return the full path"""
    try:
        # Create a BytesIO object to hold the Excel file in memory
        excel_buffer = BytesIO()
        
        # Save DataFrame to the buffer
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False)
            # Get the workbook and worksheet objects for formatting
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            
            # Add some basic formatting
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'bg_color': '#D9D9D9'
            })
            
            # Apply header format
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                worksheet.set_column(col_num, col_num, 15)  # Set column width
        
        # Save the buffer to a file
        file_path = os.path.join(OUTPUT_FOLDER, filename)
        with open(file_path, 'wb') as f:
            f.write(excel_buffer.getvalue())
        
        logger.info(f"Successfully saved file to {file_path}")
        return file_path
    
    except Exception as e:
        logger.exception(f"Error saving Excel file: {str(e)}")
        raise

def get_excel_file(file_path: str, download_name: str = None):
    """Return Excel file as a response with proper headers"""
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # If no download name provided, use the original filename
        if download_name is None:
            download_name = os.path.basename(file_path)
            
        # Create a BytesIO object to hold the file
        file_buffer = BytesIO()
        
        # Read the file into the buffer
        with open(file_path, 'rb') as f:
            file_buffer.write(f.read())
        file_buffer.seek(0)
        
        response = send_file(
            file_buffer,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=download_name
        )
        
        # Add headers to force download
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["Content-Disposition"] = f'attachment; filename="{download_name}"'
        
        return response
        
    except Exception as e:
        logger.exception(f"Error getting Excel file: {str(e)}")
        raise

def save_dataframe_to_excel(df: pd.DataFrame, filepath: str) -> bool:
    """Save DataFrame to Excel with basic formatting"""
    try:
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Sheet1')
            
            # Get workbook and worksheet
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            
            # Add header format
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#D9D9D9',
                'border': 1
            })
            
            # Apply formatting
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
                worksheet.set_column(col_num, col_num, 15)
        
        logger.info(f"Successfully saved file: {filepath}")
        return True
    except Exception as e:
        logger.error(f"Error saving Excel file: {str(e)}")
        return False

def serve_file(filepath: str, filename: str = None):
    """Serve a file for download with proper headers"""
    try:
        if not os.path.exists(filepath):
            logger.error(f"File not found: {filepath}")
            return jsonify({"error": "File not found"}), 404
            
        if filename is None:
            filename = os.path.basename(filepath)
        
        response = send_file(
            filepath,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
        # Add CORS headers
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Expose-Headers', 'Content-Disposition')
        response.headers.add('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.add('Pragma', 'no-cache')
        response.headers.add('Expires', '0')
        
        logger.info(f"Successfully serving file: {filepath} as {filename}")
        return response
        
    except Exception as e:
        logger.error(f"Error serving file: {str(e)}")
        error_response = jsonify({"error": str(e)}), 500
        error_response[0].headers.add('Access-Control-Allow-Origin', '*')
        return error_response

@app.route('/api/files/rankings', methods=['GET'])
def download_rankings():
    """Download rankings file"""
    logger.info(f"Attempting to serve rankings file: {RANKING_FILE}")
    return serve_file(RANKING_FILE, 'distribution_rankings.xlsx')

@app.route('/api/files/performance', methods=['GET'])
def download_performance():
    """Download performance report"""
    logger.info(f"Attempting to serve performance file: {PERFORMANCE_FILE}")
    return serve_file(PERFORMANCE_FILE, 'performance_report.xlsx')

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
            missing_fields = []
            if 'historical_data' not in data:
                missing_fields.append('historical_data')
            if 'user_input' not in data:
                missing_fields.append('user_input')
            return jsonify({"error": f"Missing required data: {', '.join(missing_fields)}"}), 400
        
        # Import PlannerRankerSystem here to avoid circular imports
        try:
            from planner import PlannerRankerSystem
        except ImportError as e:
            print(f"Error importing PlannerRankerSystem: {str(e)}")
            return jsonify({"error": f"Internal server error: {str(e)}"}), 500
        
        # Save JSON data to temporary files
        try:
            historical_file = json_to_csv(data['historical_data'], 'historical_data.csv')
            user_input_file = json_to_csv(data['user_input'], 'user_input.csv')
        except Exception as e:
            print(f"Error processing input data: {str(e)}")
            return jsonify({"error": f"Failed to process input data: {str(e)}"}), 400
        
        # Get weights or use default
        weights = data.get('weights', None)
        print(f"Using weights: {weights}")
        
        # Initialize the PlannerRankerSystem
        try:
            ranker = PlannerRankerSystem(historical_file, user_input_file, weights)
        except Exception as e:
            print(f"Error initializing PlannerRankerSystem: {str(e)}")
            return jsonify({"error": f"Failed to initialize ranking system: {str(e)}"}), 500
        
        # Execute the ranking process with detailed error handling for each step
        try:
            metrics = ranker.calculate_metrics()
        except Exception as e:
            print(f"Error calculating metrics: {str(e)}")
            return jsonify({"error": f"Failed to calculate metrics: {str(e)}"}), 500
            
        try:
            ranked_data = ranker.calculate_ranks(metrics)
        except Exception as e:
            print(f"Error calculating ranks: {str(e)}")
            return jsonify({"error": f"Failed to calculate ranks: {str(e)}"}), 500
            
        try:
            weighted_data = ranker.calculate_weighted_rank(ranked_data)
        except Exception as e:
            print(f"Error calculating weighted rank: {str(e)}")
            return jsonify({"error": f"Failed to calculate weighted rank: {str(e)}"}), 500
            
        try:
            final_ranked_data = ranker.calculate_final_rank(weighted_data)
        except Exception as e:
            print(f"Error calculating final rank: {str(e)}")
            return jsonify({"error": f"Failed to calculate final rank: {str(e)}"}), 500
            
        try:
            final_rankings = ranker.calculate_distribution_count(final_ranked_data)
        except Exception as e:
            print(f"Error calculating distribution count: {str(e)}")
            return jsonify({"error": f"Failed to calculate distribution count: {str(e)}"}), 500
        
        # Store the final rankings for the get-rankings endpoint
        global latest_rankings
        
        # Convert the final_rankings DataFrame to a list of dictionaries
        all_publishers_data = final_rankings.to_dict('records')
        
        # Group rankings by publisher and ensure all needed fields are present
        by_publisher = {}
        for record in all_publishers_data:
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
        
        # Check if performance report was created
        OUTPUT_FOLDER = '/tmp/output' if os.environ.get('VERCEL_ENV') == 'production' else 'output'
        performance_report_path = os.path.join(OUTPUT_FOLDER, 'overall_performance_report.xlsx')
        performance_report_exists = os.path.exists(performance_report_path)
        
        return jsonify({
            "status": "success",
            "message": "Data processed successfully",
            "result_file": "final_planner_ranking.xlsx",
            "performance_report": "overall_performance_report.xlsx" if performance_report_exists else None
        })
        
    except Exception as e:
        print(f"Error processing data: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-rankings', methods=['GET'])
def get_rankings():
    """Return the latest ranking results"""
    global latest_rankings
    
    if not latest_rankings["all_publishers"]:
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

# Import and register routes blueprint
from routes import routes
app.register_blueprint(routes)

# For local development only
if __name__ == '__main__':
    app.run(debug=True, port=5328) 