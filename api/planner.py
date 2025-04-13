import pandas as pd
import numpy as np
from datetime import datetime
import os
import logging
import importlib

# Get the logger
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

# Import check_epc_alerts function lazily to avoid circular imports
def get_check_epc_alerts():
    """Import and return the check_epc_alerts function from index.py."""
    try:
        # Try relative import first (for Vercel)
        from .index import check_epc_alerts
        return check_epc_alerts
    except ImportError:
        try:
            # Fallback to absolute import (for local development)
            from index import check_epc_alerts
            return check_epc_alerts
        except ImportError as e:
            logger.error(f"Error importing check_epc_alerts: {str(e)}")
            # Return a dummy function in case of import error
            return lambda x: logger.warning("check_epc_alerts function not available")

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
        logger.info(f"Using output folder: {self.OUTPUT_FOLDER}")
        
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
            
            # Generate and send EPC alerts based on thresholds
            # Lazily import check_epc_alerts to avoid circular dependency
            check_epc_alerts = get_check_epc_alerts()
            logger.info("Checking for EPC alerts")
            check_epc_alerts(metrics)
            
            # Save Step 1 output
            metrics.to_excel(f'{self.OUTPUT_FOLDER}/step1_avg_metrics.xlsx', index=False)
            
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
            
            # Save Step 2 output
            ranked_data.to_excel(f'{self.OUTPUT_FOLDER}/step2_ranked_metrics.xlsx', index=False)
            
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
            
            # Save Step 3 output
            weighted_data.to_excel(f'{self.OUTPUT_FOLDER}/step3_weighted_ranks.xlsx', index=False)
            
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
            
            # Import save function and file paths
            try:
                # Try relative import first (for Vercel)
                from .index import save_dataframe_to_excel, RANKING_FILE
            except ImportError:
                # Fallback to absolute import (for local development)
                from index import save_dataframe_to_excel, RANKING_FILE
            
            # Save rankings file
            if not save_dataframe_to_excel(final_data, RANKING_FILE):
                logger.error("Failed to save rankings file")
            
            # Create overall performance report
            self.create_overall_performance_report(final_data)
            
            return final_data
            
        except Exception as e:
            logger.exception(f"Error calculating final rank: {str(e)}")
            raise
    
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
            
            # Import save function and file path
            try:
                # Try relative import first (for Vercel)
                from .index import save_dataframe_to_excel, PERFORMANCE_FILE
            except ImportError:
                # Fallback to absolute import (for local development)
                from index import save_dataframe_to_excel, PERFORMANCE_FILE
            
            # Save performance report
            if not save_dataframe_to_excel(report_data, PERFORMANCE_FILE):
                logger.error("Failed to save performance report")
            else:
                logger.info("Successfully saved performance report")
            
        except Exception as e:
            logger.exception(f"Error creating overall performance report: {str(e)}")
            # Don't raise the exception, just log it to prevent breaking the main workflow
    
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
            with pd.ExcelWriter(f'{self.OUTPUT_FOLDER}/final_planner_ranking.xlsx') as writer:
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