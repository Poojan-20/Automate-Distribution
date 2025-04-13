# Distribution Planner API

This directory contains the Flask API backend for the Distribution Planner application.

## API Endpoints

### Data Processing Endpoints

- **GET /api/health-check**
  - Check if the API is running
  - Returns: `{"status": "ok"}`

- **POST /api/process-data**
  - Process historical and user input data to generate rankings
  - Request body: 
    ```json
    {
      "historical_data": [...],  // Array of historical data records
      "user_input": [...],       // Array of user input plans
      "weights": {               // Optional ranking weights
        "CTR": 0.33,
        "EPC": 0.33,
        "Revenue": 0.33
      }
    }
    ```
  - Returns: Ranking data

- **POST /api/validate-data**
  - Validate uploaded user input data
  - Request body: 
    ```json
    {
      "data": [...]  // Array of plan objects
    }
    ```
  - Returns: Validation results

- **GET /api/get-rankings**
  - Get the latest ranking data
  - Returns: Complete ranking data

- **GET /api/download-rankings**
  - Download rankings as Excel file
  - Returns: Excel file

### Slack Alert Endpoints

- **GET /api/test-slack**
  - Test Slack webhook integration
  - Returns: `{"status": "success"}` or error message

- **POST /api/trigger-epc-alerts**
  - Manually trigger EPC alerts based on provided data
  - Request body: 
    ```json
    {
      "historical_data": [...]  // Array of historical data records
    }
    ```
  - Returns: Alert results

- **GET /api/scheduled-epc-alerts**
  - Run scheduled EPC alerts based on saved data
  - Returns: Alert results

## Running the API

### Development

```bash
# From the client directory
npm run api:dev

# Or directly
cd api
python -m flask --app index run --port=5328 --debug
```

### Production

The API is deployed as a serverless function. 