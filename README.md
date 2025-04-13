# Distribution Planner Application

A Next.js and Flask application for planning and automating distribution based on historical performance data.

## Features

- **Distribution Planning**: Set up and manage distribution plans
- **Historical Data Analysis**: Analyze past performance data
- **Automated Rankings**: Generate rankings based on CTR, EPC, and revenue
- **Slack Alerts**: Get notifications for key metrics
- **Excel Import/Export**: Easy data import and export

## Project Structure

- `client/`: Next.js frontend application
  - `api/`: Flask API backend
  - `src/`: Next.js source code
  - `public/`: Public assets

## Quick Start

### Method 1: Using Batch Script (Windows)

Just run the start-dev.bat file:

```
start-dev.bat
```

### Method 2: Manual Setup

1. **Install dependencies**:

   ```
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   npm run api:install
   ```

2. **Run the development server**:

   ```
   # Run both frontend and backend together
   npm run dev:all
   
   # Alternative method
   npm run dev:all:alt
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5328

## API Endpoints

See the [API documentation](api/README.md) for details on available endpoints.

## Troubleshooting

If you encounter connection issues, you can test your API connectivity:

```
npm run test:api
```

### SSL Certificate Issues with Slack

If you encounter SSL certificate issues when connecting to Slack, you can:

1. Edit the `.env.local` file to set:
   ```
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

2. In PowerShell, you can run:
   ```
   $env:NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

3. In Command Prompt:
   ```
   set NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

## Deployment

This project is configured for deployment on Vercel with both the Next.js frontend and Flask backend.
