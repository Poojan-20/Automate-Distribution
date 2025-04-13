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
        
        # Import PlannerRankerSystem here to avoid circular imports
        try:
            from .planner import PlannerRankerSystem
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
            "message": "API is running",
            "timestamp": datetime.now().isoformat(),
            "environment": "production" if IS_SERVERLESS else "development"
        })
    except Exception as e:
        logger.exception(f"Error in health check: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Import routes from routes.py - use relative import
try:
    from .routes import routes as blueprint_routes
    app.register_blueprint(blueprint_routes)
except ImportError:
    # Fallback for local development
    try:
        from .routes import routes as blueprint_routes
        app.register_blueprint(blueprint_routes)
    except ImportError:
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
                "message": "API is running",
                "timestamp": datetime.now().isoformat(),
                "environment": "production" if IS_SERVERLESS else "development"
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
                "message": "API is running",
                "timestamp": datetime.now().isoformat(),
                "endpoints": [
                    "/api/process-data",
                    "/api/validate-data",
                    "/api/get-rankings",
                    "/api/download-rankings",
                    "/api/download-performance-report",
                    "/api/files/rankings",
                    "/api/files/performance",
                    "/api/health"
                ]
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