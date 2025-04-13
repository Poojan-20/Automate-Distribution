from flask import Blueprint, request, jsonify, send_file
import os
import pandas as pd
from datetime import datetime
import traceback
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Get the absolute path to the client/api directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Use /tmp for file operations when in serverless environment (Vercel)
IS_SERVERLESS = os.environ.get('VERCEL_ENV') is not None
OUTPUT_FOLDER = '/tmp/output' if IS_SERVERLESS else os.path.join(BASE_DIR, 'output')

# Create output directory if it doesn't exist
if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)
    logger.info(f"Created output directory: {OUTPUT_FOLDER}")

# Define file paths
RANKING_FILE = os.path.join(OUTPUT_FOLDER, 'final_planner_ranking.xlsx')
PERFORMANCE_FILE = os.path.join(OUTPUT_FOLDER, 'overall_performance_report.xlsx')

# Create blueprint
routes = Blueprint('routes', __name__)

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

@routes.route('/api/download-rankings', methods=['GET'])
def download_rankings():
    """Download the latest rankings file"""
    try:
        logger.info(f"Attempting to serve rankings file: {RANKING_FILE}")
        return serve_file(RANKING_FILE, f'distribution_rankings_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx')
    except Exception as e:
        logger.exception(f"Error serving rankings file: {str(e)}")
        return jsonify({"error": "Failed to download rankings"}), 500

@routes.route('/api/download-performance-report', methods=['GET'])
def download_performance():
    """Download the latest performance report"""
    try:
        logger.info(f"Attempting to serve performance file: {PERFORMANCE_FILE}")
        return serve_file(PERFORMANCE_FILE, f'performance_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx')
    except Exception as e:
        logger.exception(f"Error serving performance report: {str(e)}")
        return jsonify({"error": "Failed to download performance report"}), 500

# Add direct file endpoints matching apiService.ts
@routes.route('/api/files/rankings', methods=['GET'])
def files_rankings():
    """Download rankings file - alternative endpoint"""
    try:
        logger.info(f"Serving rankings file from /api/files/rankings endpoint")
        return serve_file(RANKING_FILE, f'distribution_rankings_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx')
    except Exception as e:
        logger.exception(f"Error serving rankings file: {str(e)}")
        return jsonify({"error": "Failed to download rankings"}), 500

@routes.route('/api/files/performance', methods=['GET'])
def files_performance():
    """Download performance report - alternative endpoint"""
    try:
        logger.info(f"Serving performance file from /api/files/performance endpoint")
        return serve_file(PERFORMANCE_FILE, f'performance_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx')
    except Exception as e:
        logger.exception(f"Error serving performance report: {str(e)}")
        return jsonify({"error": "Failed to download performance report"}), 500

@routes.route('/api/validate-data', methods=['POST'])
def validate_data():
    try:
        logger.info("Validating data")
        # Get JSON data from request
        data = request.get_json()

        if not data or 'data' not in data:
            logger.warning("No data provided in validation request")
            return jsonify({'error': 'No data provided'}), 400

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
        return jsonify(validation_result)

    except Exception as e:
        logger.exception(f"Error validating data: {str(e)}")
        return jsonify({'error': str(e)}), 500
