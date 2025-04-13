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
from http.server import BaseHTTPRequestHandler
import json
import logging
import sys

app = Flask(__name__)
# Configure CORS for compatibility with Next.js
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://automate-distribution.vercel.app",
            "https://revenue-planner.vercel.app"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Disposition"]
    }
})

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("api")
logger.info("API Starting")

# Get the absolute path to the client/api directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Use /tmp for file operations when in serverless environment (Vercel)
IS_SERVERLESS = os.environ.get('VERCEL_ENV') is not None
OUTPUT_FOLDER = '/tmp/output' if IS_SERVERLESS else os.path.join(BASE_DIR, 'output')
UPLOAD_FOLDER = '/tmp/uploads' if IS_SERVERLESS else os.path.join(BASE_DIR, 'uploads')

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
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        df.to_csv(filepath, index=False)
        return filepath
    except Exception as e:
        logger.error(f"Error converting JSON to CSV: {str(e)}")
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
    
    
@app.route('/api/test')
def test():
    return {"status": "working"}


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
        
        # Use the local PlannerRankerSystem class instead of importing
        # No need to import from planner.py anymore
        
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

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint for debugging"""
    try:
        return jsonify({
            "status": "ok",
            "message": "Revenue Planner API is running",
            "description": "Manage your plans and rankings with powerful data-driven decision making",
            "timestamp": datetime.now().isoformat(),
            "environment": "production" if IS_SERVERLESS else "development",
            "version": "1.0.0"
        })
    except Exception as e:
        logger.exception(f"Error in health check: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Import routes from routes.py - use relative import
try:
    # We don't need to import routes anymore as all functionality is integrated
    # directly in this file
    pass
except ImportError:
    # Fallback for local development
    logger.error("Failed to import routes blueprint. API functionality will be limited.")

# For local development
if __name__ == '__main__':
    app.run(debug=True, port=5328)
    
# Vercel serverless handler class
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle_request()
        
    def do_POST(self):
        self._handle_request()
        
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(204)  # No content
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')  # 24 hours
        self.end_headers()
        
    def _handle_request(self):
        # Health check endpoint
        if self.path == '/api/health':
            self._send_json_response({
                "status": "ok",
                "message": "Revenue Planner API is running",
                "description": "Manage your plans and rankings with powerful data-driven decision making",
                "timestamp": datetime.now().isoformat(),
                "environment": "production" if IS_SERVERLESS else "development",
                "version": "1.0.0"
            })
            return
            
        # File download endpoints
        if self.path in ['/api/files/rankings', '/api/download-rankings']:
            self._serve_file(RANKING_FILE, 'distribution_rankings.xlsx')
            return
            
        if self.path in ['/api/files/performance', '/api/download-performance-report']:
            self._serve_file(PERFORMANCE_FILE, 'performance_report.xlsx')
            return
            
        # Get rankings endpoint
        if self.path == '/api/get-rankings':
            self._handle_get_rankings()
            return
            
        # Process data endpoint
        if self.path == '/api/process-data' and self.command == 'POST':
            self._handle_process_data()
            return
            
        # Validate data endpoint
        if self.path == '/api/validate-data' and self.command == 'POST':
            self._handle_validate_data()
            return
            
        # Basic info for root API path
        if self.path == '/api' or self.path == '/api/':
            self._send_json_response({
                "status": "ok",
                "message": "Revenue Planner API is running",
                "description": "Manage your plans and rankings with powerful data-driven decision making",
                "timestamp": datetime.now().isoformat(),
                "endpoints": [
                    "/api/process-data",
                    "/api/validate-data",
                    "/api/get-rankings",
                    "/api/files/rankings",
                    "/api/files/performance",
                    "/api/health"
                ],
                "version": "1.0.0"
            })
            return
            
        # Default response for unknown endpoints
        self._send_json_response({
            "error": "Unknown endpoint",
            "path": self.path,
            "method": self.command
        }, status=404)
    
    def _send_json_response(self, data, status=200):
        """Helper to send a JSON response with CORS headers"""
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def _serve_file(self, filepath, filename):
        """Serve a file for download"""
        try:
            if os.path.exists(filepath):
                # Read the file
                with open(filepath, 'rb') as file:
                    content = file.read()
                
                # Send headers
                self.send_response(200)
                self.send_header('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Expose-Headers', 'Content-Disposition')
                self.end_headers()
                
                # Send the file content
                self.wfile.write(content)
            else:
                # File not found
                logger.error(f"File not found: {filepath}")
                self._send_json_response({
                    "error": "File not found",
                    "path": filepath
                }, status=404)
        except Exception as e:
            # Error serving file
            logger.exception(f"Error serving file: {str(e)}")
            self._send_json_response({
                "error": str(e),
                "message": "Error serving file"
            }, status=500)
    
    def _handle_get_rankings(self):
        """Handle GET /api/get-rankings endpoint"""
        try:
            global latest_rankings
            
            if not latest_rankings["all_publishers"]:
                self._send_json_response({"error": "No ranking data available"}, status=404)
                return
                
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
                
            self._send_json_response(latest_rankings)
            
        except Exception as e:
            logger.exception(f"Error getting rankings: {str(e)}")
            self._send_json_response({"error": str(e)}, status=500)
    
    def _handle_process_data(self):
        """Handle POST /api/process-data endpoint"""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length) if content_length > 0 else b''
            
            # Parse JSON data
            data = json.loads(request_body)
            
            # Check required fields
            if 'historical_data' not in data or 'user_input' not in data:
                missing_fields = []
                if 'historical_data' not in data:
                    missing_fields.append('historical_data')
                if 'user_input' not in data:
                    missing_fields.append('user_input')
                    
                self._send_json_response({
                    "error": f"Missing required data: {', '.join(missing_fields)}"
                }, status=400)
                return
            
            # Save JSON data to temporary files
            try:
                historical_file = json_to_csv(data['historical_data'], 'historical_data.csv')
                user_input_file = json_to_csv(data['user_input'], 'user_input.csv')
            except Exception as e:
                logger.exception(f"Error processing input data: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to process input data: {str(e)}"
                }, status=400)
                return
            
            # Get weights or use default
            weights = data.get('weights', None)
            logger.info(f"Using weights: {weights}")
            
            # Initialize the PlannerRankerSystem
            try:
                ranker = PlannerRankerSystem(historical_file, user_input_file, weights)
            except Exception as e:
                logger.exception(f"Error initializing PlannerRankerSystem: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to initialize ranking system: {str(e)}"
                }, status=500)
                return
            
            # Execute the ranking process with detailed error handling for each step
            try:
                metrics = ranker.calculate_metrics()
            except Exception as e:
                logger.exception(f"Error calculating metrics: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to calculate metrics: {str(e)}"
                }, status=500)
                return
                
            try:
                ranked_data = ranker.calculate_ranks(metrics)
            except Exception as e:
                logger.exception(f"Error calculating ranks: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to calculate ranks: {str(e)}"
                }, status=500)
                return
                
            try:
                weighted_data = ranker.calculate_weighted_rank(ranked_data)
            except Exception as e:
                logger.exception(f"Error calculating weighted rank: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to calculate weighted rank: {str(e)}"
                }, status=500)
                return
                
            try:
                final_ranked_data = ranker.calculate_final_rank(weighted_data)
            except Exception as e:
                logger.exception(f"Error calculating final rank: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to calculate final rank: {str(e)}"
                }, status=500)
                return
                
            try:
                final_rankings = ranker.calculate_distribution_count(final_ranked_data)
            except Exception as e:
                logger.exception(f"Error calculating distribution count: {str(e)}")
                self._send_json_response({
                    "error": f"Failed to calculate distribution count: {str(e)}"
                }, status=500)
                return
            
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
            performance_report_path = PERFORMANCE_FILE
            performance_report_exists = os.path.exists(performance_report_path)
            
            # Return successful response
            self._send_json_response({
                "status": "success",
                "message": "Data processed successfully",
                "result_file": "final_planner_ranking.xlsx",
                "performance_report": "overall_performance_report.xlsx" if performance_report_exists else None
            })
            
        except Exception as e:
            logger.exception(f"Error processing data: {str(e)}")
            self._send_json_response({"error": str(e)}, status=500)
    
    def _handle_validate_data(self):
        """Handle POST /api/validate-data endpoint"""
        try:
            # Read request body
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length) if content_length > 0 else b''
            
            # Parse JSON data
            data = json.loads(request_body)
            
            if not data or 'data' not in data:
                self._send_json_response({'error': 'No data provided'}, status=400)
                return
                
            # Convert to DataFrame for validation
            df = pd.DataFrame(data['data'])
            logger.debug(f"Received data with {len(df)} rows and columns: {list(df.columns)}")
            
            # Return basic validation info
            validation_result = {
                'columns': list(df.columns),
                'row_count': len(df),
                'sample_data': df.head(5).to_dict(orient='records')
            }
            
            logger.info(f"Validated data with {len(df)} rows")
            self._send_json_response(validation_result)
            
        except Exception as e:
            logger.exception(f"Error validating data: {str(e)}")
            self._send_json_response({'error': str(e)}, status=500)

# Check epc alerts
def check_epc_alerts(metrics):
    """Check for significant EPC changes and send alerts if needed"""
    try:
        logger.info(f"Checking EPC alerts for {len(metrics)} metrics")
    except Exception as e:
        logger.error(f"Error checking EPC alerts: {str(e)}")
    return True

# Implementation of PlannerRankerSystem class
class PlannerRankerSystem:
    def __init__(self, historical_data_path, user_input_path, weights=None):
        """
        Initialize the Planner Ranker System
        """
        logger.info("Initializing Planner Ranker System")
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
        
        logger.info(f"Initialized with weights: {self.weights}")
        
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
        
        # Use the global output folder
        self.OUTPUT_FOLDER = OUTPUT_FOLDER
    
    def calculate_metrics(self):
        """Calculate rolling average CTR, EPC, and Revenue for each Plan ID by Publisher"""
        logger.info("Calculating metrics from historical data")
        
        try:
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
            
            # Make sure we have a date column for calculating rolling averages
            if 'date' not in self.historical_data.columns:
                # If no date column exists, create one or use current system date for all rows
                logger.warning("No date column found in historical data. Using current date for all rows.")
                self.historical_data['date'] = pd.to_datetime('today')
            else:
                # Convert date column to datetime if it's not already
                self.historical_data['date'] = pd.to_datetime(self.historical_data['date'])
            
            # Sort by date to properly compute rolling averages
            self.historical_data = self.historical_data.sort_values('date')
            
            # Calculate 7-day rolling average EPC for each publisher and plan_id
            epc_7day_avg = {}
            
            # Group by publisher and plan_id
            for (publisher, plan_id), group in self.historical_data.groupby(['publisher', 'plan_id']):
                if len(group) > 0:
                    # Calculate rolling average EPC over 7 days
                    # If we have enough data points
                    if len(group) >= 7:
                        rolling_epc = group['EPC'].rolling(window=7, min_periods=1).mean()
                        avg_epc_7day = rolling_epc.iloc[-1]  # Get the most recent value
                    else:
                        # If we don't have 7 days of data, use all available data
                        avg_epc_7day = group['EPC'].mean()
                        
                    epc_7day_avg[(publisher, plan_id)] = avg_epc_7day
            
            # Group by publisher and plan_id to calculate averages
            metrics = self.historical_data.groupby(['publisher', 'plan_id']).agg({
                'CTR': 'mean',
                'EPC': 'mean',
                'revenue': 'mean',
                'clicks': 'sum',
                'distribution': 'sum'
            }).reset_index()
            
            # Add the 7-day average EPC to the metrics
            metrics['avg_epc_7day'] = metrics.apply(
                lambda row: epc_7day_avg.get((row['publisher'], row['plan_id']), row['EPC']),
                axis=1
            )
            
            # Rename revenue column to avg_revenue for clarity
            metrics = metrics.rename(columns={'revenue': 'avg_revenue'})
            
            # Check for EPC alerts
            check_epc_alerts(metrics)
            
            # Save metrics to Excel
            save_dataframe_to_excel(metrics, os.path.join(self.OUTPUT_FOLDER, 'step1_avg_metrics.xlsx'))
            
            return metrics
            
        except Exception as e:
            logger.exception(f"Error calculating metrics: {str(e)}")
            raise
    
    def calculate_ranks(self, metrics):
        """Calculate rank for each metric within each publisher"""
        logger.info("Calculating ranks from metrics")
        
        try:
            # Group by publisher and rank each metric in descending order
            ranked_data = metrics.copy()
            
            # Replace any NaN values with 0
            ranked_data = ranked_data.fillna(0)
            
            # For each publisher, rank the metrics (higher values get better ranks)
            publishers = ranked_data['publisher'].unique()
            
            for publisher in publishers:
                publisher_mask = ranked_data['publisher'] == publisher
                publisher_data = ranked_data[publisher_mask]
                
                if len(publisher_data) > 0:
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
            
            # Save ranked data to Excel
            save_dataframe_to_excel(ranked_data, os.path.join(self.OUTPUT_FOLDER, 'step2_ranked_metrics.xlsx'))
            
            return ranked_data
            
        except Exception as e:
            logger.exception(f"Error calculating ranks: {str(e)}")
            raise
    
    def calculate_weighted_rank(self, ranked_data):
        """Calculate weighted average rank based on provided weights"""
        logger.info("Calculating weighted rank from ranked data")
        
        try:
            weighted_data = ranked_data.copy()
            
            # Ensure no NaN values
            weighted_data = weighted_data.fillna(0)
            
            # Check if rank columns exist
            required_columns = ['CTR_rank', 'EPC_rank', 'avg_revenue_rank']
            for col in required_columns:
                if col not in weighted_data.columns:
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
                
                # Calculate the weighted rank
                weighted_data['weighted_rank'] = (
                    ctr_weight * weighted_data['CTR_rank'] +
                    epc_weight * weighted_data['EPC_rank'] +
                    revenue_weight * weighted_data['avg_revenue_rank']
                )
            except Exception as e:
                logger.error(f"Error calculating weighted rank: {str(e)}")
                # If calculation fails, set a default weighted rank of 1
                weighted_data['weighted_rank'] = 1
            
            # Replace any NaN in weighted_rank with 1
            weighted_data['weighted_rank'] = weighted_data['weighted_rank'].fillna(1)
            
            # Save weighted data to Excel
            save_dataframe_to_excel(weighted_data, os.path.join(self.OUTPUT_FOLDER, 'step3_weighted_ranks.xlsx'))
            
            return weighted_data
            
        except Exception as e:
            logger.exception(f"Error calculating weighted rank: {str(e)}")
            raise
    
    def calculate_final_rank(self, weighted_data):
        """Calculate final rank based on weighted average (ascending order)"""
        logger.info("Calculating final rank from weighted data")
        
        try:
            final_data = weighted_data.copy()
            
            # Ensure no NaN values
            final_data = final_data.fillna(0)
            
            # For each publisher, rank based on weighted rank (ascending order - lower weighted rank is better)
            publishers = final_data['publisher'].unique()
            
            # Initialize final_rank with default value 1
            final_data['final_rank'] = 1
            
            for publisher in publishers:
                publisher_mask = final_data['publisher'] == publisher
                publisher_data = final_data[publisher_mask]
                
                if len(publisher_data) > 0:
                    # Only rank if we have more than one row
                    if len(publisher_data) > 1:
                        try:
                            final_data.loc[publisher_mask, 'final_rank'] = final_data.loc[publisher_mask, 'weighted_rank'].rank(method='min')
                        except Exception as e:
                            logger.error(f"Error ranking for publisher {publisher}: {str(e)}")
                            # Keep default rank of 1
            
            # Ensure no NaN values in final_rank
            final_data['final_rank'] = final_data['final_rank'].fillna(1)
            
            # Save rankings file
            if not save_dataframe_to_excel(final_data, RANKING_FILE):
                logger.error("Failed to save rankings file")
            
            # Create overall performance report
            self.create_overall_performance_report(final_data)
            
            return final_data
            
        except Exception as e:
            logger.exception(f"Error calculating final rank: {str(e)}")
            raise
    
    def format_ranking_data(self, final_output):
        """Format numerical values in the final output for better display"""
        logger.info("Formatting final output")
        
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
    
    def create_overall_performance_report(self, final_data):
        """Create a comprehensive performance report Excel file"""
        logger.info("Creating overall performance report")
        
        try:
            # Make a copy of the data to avoid modifying the original
            report_data = final_data.copy()
            
            # Add calculated fields for the report
            report_data['expected_distribution'] = report_data['distribution'] if 'distribution' in report_data.columns else 0
            
            # Format numbers for better readability
            report_data = self.format_ranking_data(report_data)
            
            # Save performance report
            if not save_dataframe_to_excel(report_data, PERFORMANCE_FILE):
                logger.error("Failed to save performance report")
            else:
                logger.info("Successfully saved performance report")
            
        except Exception as e:
            logger.exception(f"Error creating overall performance report: {str(e)}")
            # Don't raise the exception, just log it to prevent breaking the main workflow
    
    def calculate_distribution_count(self, final_data):
        """Calculate distribution count based on tags"""
        logger.info("Calculating distribution count based on tags")
        
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
            with pd.ExcelWriter(os.path.join(self.OUTPUT_FOLDER, 'final_planner_ranking.xlsx')) as writer:
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