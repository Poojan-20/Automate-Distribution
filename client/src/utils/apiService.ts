import { Plan, parseHistoricalData, parseInventoryReport } from './excelParser';

// Define the base URL with proper formatting
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const API_ENDPOINTS = {
  processData: `${API_BASE_URL}/api/process-data`,
  validateData: `${API_BASE_URL}/api/validate-data`,
  getRankings: `${API_BASE_URL}/api/get-rankings`,
  downloadRankings: `${API_BASE_URL}/api/download-rankings`
};

// Updated interface to match backend data structure
export interface RankingItem {
  plan_id: string;
  publisher: string;
  EPC: number;      // Will be displayed with 2 decimal places
  CTR: number;      // Will be converted to percentage with 1 decimal place
  avg_revenue: number;  // Will be rounded to integer
  final_rank: number;
  distribution: number;  // Will be rounded to integer
  tags: string;
  subcategory: string;
}

export interface ProcessDataResponse {
  all_publishers: Array<{
    plan_id: string;
    publisher: string;
    final_rank: number;
    CTR: number;
    EPC: number;
    avg_revenue: number;
    distribution: number;
    tags: string;
    subcategory: string;
    expected_clicks: number;
    budget_cap: number;
  }>;
  by_publisher: {
    [key: string]: Array<{
      plan_id: string;
      publisher: string;
      final_rank: number;
      CTR: number;
      EPC: number;
      avg_revenue: number;
      distribution: number;
      tags: string;
      subcategory: string;
      expected_clicks: number;
      budget_cap: number;
    }>;
  };
}

export const apiService = {
  async processData(historicalData: File, userInput: File, weights?: { ctr: number; epc: number; revenue: number }) {
    console.log('processData called with files');

    try {
      // Parse historical data
      const historicalBuffer = await historicalData.arrayBuffer();
      const processedHistoricalData = parseHistoricalData(historicalBuffer);
      
      // Validate and normalize historical data
      const normalizedHistoricalData = processedHistoricalData.map(record => {
        // Ensure field names exactly match what the backend expects
        return {
          plan_id: record.planId,
          publisher: record.publisher,
          date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : record.date,
          revenue: record.revenue || 0,
          // The field MUST be named 'distribution' for the backend calculations
          distribution: record.distribution_count || 0,
          clicks: record.clicks || 0
        };
      });
      
      console.log('Normalized sample historical record:', 
        normalizedHistoricalData.length > 0 ? JSON.stringify(normalizedHistoricalData[0]) : 'No data');

      // Parse user input data
      const userInputBuffer = await userInput.arrayBuffer();
      const processedUserInput = await parseInventoryReport(userInputBuffer);
      
      // Normalize user input data
      const normalizedUserInput = processedUserInput.map(plan => {
        // Ensure publisher and tags are arrays
        const publishers = Array.isArray(plan.publisher) ? plan.publisher : [plan.publisher].filter(Boolean);
        const tags = Array.isArray(plan.tags) ? plan.tags : [plan.tags].filter(Boolean);
        
        return {
          plan_id: plan.planId,
          publisher: publishers, // Keep as array
          tags: tags, // Keep as array
          budget_cap: plan.budgetCap || 0,
          subcategory: plan.subcategory || '',
          brand_name: plan.brand_name || '',
          distribution: plan.distributionCount || 0, // Renamed to match backend
          clicks_to_be_delivered: plan.clicksToBeDelivered || 0
        };
      });

      console.log('Normalized sample user input:', 
        normalizedUserInput.length > 0 ? JSON.stringify(normalizedUserInput[0]) : 'No data');

      // Convert frontend weight keys to match backend expected format
      const backendWeights = {
        'CTR': weights?.ctr || 0.33,
        'EPC': weights?.epc || 0.33,
        'Revenue': weights?.revenue || 0.33
      };
      
      console.log('Using weights:', backendWeights);

      // Prepare the request body
      const requestBody = {
        historical_data: normalizedHistoricalData,
        user_input: normalizedUserInput,
        weights: backendWeights
      };

      console.log('Sending request to backend:', API_ENDPOINTS.processData);

      // Send JSON data to backend with complete URL
      const response = await fetch(API_ENDPOINTS.processData, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        // Add credentials option for CORS
        credentials: 'same-origin'
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        console.error('API Error Response:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('API Response:', data);
      return data;
    } catch (error) {
      // Enhance error logging for CORS issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('CORS or network error - Check if the Flask server is running and CORS is configured correctly');
      }
      console.error('Error processing data:', error);
      throw error;
    }
  },

  async validateData(file: File) {
    console.log('validateData called with file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    try {
      // Read and parse the file
      const buffer = await file.arrayBuffer();
      const processedData = await parseInventoryReport(buffer);

      // Send JSON data for validation
      const response = await fetch(API_ENDPOINTS.validateData, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: processedData }),
        credentials: 'same-origin'
      });

      if (!response.ok) {
        console.error('Validation API Error:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Validation API Response:', result);
      return result;
    } catch (error) {
      console.error('Error validating data:', error);
      throw error;
    }
  },

  async getRankings(): Promise<ProcessDataResponse> {
    try {
      console.log('Getting ranking data from backend');
      const response = await fetch(API_ENDPOINTS.getRankings, {
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get rankings: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add default values for any missing fields
      if (data.all_publishers) {
        data.all_publishers.forEach((item: any) => {
          // Ensure all required fields exist with default values
          item.expected_clicks = item.expected_clicks || 0;
          item.budget_cap = item.budget_cap || 0;
        });
      }
      
      // Same for by_publisher data
      if (data.by_publisher) {
        Object.keys(data.by_publisher).forEach(publisher => {
          data.by_publisher[publisher].forEach((item: any) => {
            item.expected_clicks = item.expected_clicks || 0;
            item.budget_cap = item.budget_cap || 0;
          });
        });
      }
      
      console.log('Processed ranking data:', data);
      return data;
    } catch (error) {
      console.error('Error getting ranking data:', error);
      throw error;
    }
  },

  getDownloadUrl(): string {
    return API_ENDPOINTS.downloadRankings;
  }
}; 