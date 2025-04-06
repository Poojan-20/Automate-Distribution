# Automatic Distribution Planner - Development Instructions

This document outlines the development plan for the Automatic Distribution Planner MVP, focusing on creating a system that can ingest inventory reports and historical data to generate optimized distribution plans.

## System Overview

The MVP will consist of:

1. **React Frontend**: For file upload, data review, and results display
2. **Python Rule Engine**: For analyzing data and generating rankings
3. **Firebase Database**: For storing plan data and configuration

## Development Phases

### Phase 1: Setup & Basic Infrastructure

### Frontend Setup

1. Create a new React application
    
    ```bash
    npx create-react-app distribution-planner
    cd distribution-planner
    npm install firebase axios react-router-dom @mui/material @mui/icons-material xlsx
    
    ```
    
2. Set up Firebase
    - Create a new Firebase project in the Firebase console
    - Enable Firestore database
    - Add Firebase configuration to your React app
    
    ```jsx
    // src/firebase.js
    import { initializeApp } from "firebase/app";
    import { getFirestore } from "firebase/firestore";
    
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_MESSAGING_ID",
      appId: "YOUR_APP_ID"
    };
    
    const app = initializeApp(firebaseConfig);
    export const db = getFirestore(app);
    
    ```
    

### Backend Setup

1. Create a new Python project directory
    
    ```bash
    mkdir distribution-engine
    cd distribution-engine
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install fastapi uvicorn pandas numpy openpyxl firebase-admin
    
    ```
    
2. Create a basic FastAPI application
    
    ```python
    # main.py
    from fastapi import FastAPI, UploadFile, File
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI()
    
    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Replace with your frontend URL in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.get("/")
    def read_root():
        return {"message": "Distribution Planner API is running"}
    
    if __name__ == "__main__":
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)
    
    ```
    

### Phase 2: File Upload & Processing

### Frontend - File Upload Component

1. Create a file upload component for inventory and historical data
    
    ```jsx
    // src/components/FileUpload.jsimport React, { useState } from 'react';import { Button, Typography, Paper, CircularProgress } from '@mui/material';import * as XLSX from 'xlsx';import axios from 'axios';const FileUpload = () => {  const [inventoryFile, setInventoryFile] = useState(null);  const [historicalFile, setHistoricalFile] = useState(null);  const [inventoryData, setInventoryData] = useState(null);  const [isLoading, setIsLoading] = useState(false);    const processInventoryFile = (file) => {    const reader = new FileReader();    reader.onload = (e) => {      const data = e.target.result;      const workbook = XLSX.read(data, { type: 'array' });      const sheetName = workbook.SheetNames[0];      const worksheet = workbook.Sheets[sheetName];      const json = XLSX.utils.sheet_to_json(worksheet);      setInventoryData(json);    };    reader.readAsArrayBuffer(file);  };    const handleInventoryFileChange = (event) => {    const file = event.target.files[0];    setInventoryFile(file);    processInventoryFile(file);  };    const handleHistoricalFileChange = (event) => {    setHistoricalFile(event.target.files[0]);  };    const handleSubmit = async () => {    if (!inventoryFile || !historicalFile) {      alert('Please upload both files');      return;    }        setIsLoading(true);        const formData = new FormData();    formData.append('inventory', inventoryFile);    formData.append('historical', historicalFile);        try {      const response = await axios.post('http://localhost:8000/api/process-files', formData, {        headers: {          'Content-Type': 'multipart/form-data'        }      });            // Handle the response      console.log(response.data);          } catch (error) {      console.error('Error uploading files:', error);    } finally {      setIsLoading(false);    }  };    return (    <Paper elevation={3} style={{ padding: '20px', marginTop: '20px' }}>      <Typography variant="h5" gutterBottom>Upload Files</Typography>            <div style={{ marginBottom: '20px' }}>        <Typography variant="subtitle1">Inventory Report</Typography>        <input          type="file"          accept=".xlsx,.xls,.csv"          onChange={handleInventoryFileChange}          style={{ display: 'none' }}          id="inventory-file-upload"        />        <label htmlFor="inventory-file-upload">          <Button variant="contained" component="span">            Upload Inventory File          </Button>        </label>        {inventoryFile && (          <Typography variant="body2" style={{ marginTop: '5px' }}>            Selected: {inventoryFile.name}          </Typography>        )}      </div>            <div style={{ marginBottom: '20px' }}>        <Typography variant="subtitle1">Historical Data (7 Days)</Typography>        <input          type="file"          accept=".xlsx,.xls,.csv"          onChange={handleHistoricalFileChange}          style={{ display: 'none' }}          id="historical-file-upload"        />        <label htmlFor="historical-file-upload">          <Button variant="contained" component="span">            Upload Historical Data          </Button>        </label>        {historicalFile && (          <Typography variant="body2" style={{ marginTop: '5px' }}>            Selected: {historicalFile.name}          </Typography>        )}      </div>            <Button         variant="contained"         color="primary"         onClick={handleSubmit}        disabled={!inventoryFile || !historicalFile || isLoading}      >        {isLoading ? <CircularProgress size={24} /> : 'Process Files'}      </Button>    </Paper>  );};export default FileUpload;
    
    ```
    

### Backend - File Processing API

1. Create endpoints to receive and process Excel files
    
    ```python
    # file_processor.py
    import pandas as pd
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Initialize Firebase Admin
    cred = credentials.Certificate("path/to/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    def process_inventory_file(file_path):
        """Process inventory Excel file and extract plan IDs"""
        df = pd.read_excel(file_path)
        # Assuming columns for plan_id, budget_cap, tags, publisher, subcategory
        # Adjust column names based on your actual Excel structure
        inventory_data = []
    
        for _, row in df.iterrows():
            plan_data = {
                'plan_id': str(row.get('plan_id', '')),
                'budget_cap': float(row.get('budget_cap', 0)),
                'tags': str(row.get('tags', '')),
                'publisher': str(row.get('publisher', '')),
                'subcategory': str(row.get('subcategory', ''))
            }
            inventory_data.append(plan_data)
    
        return inventory_data
    
    def process_historical_file(file_path):
        """Process historical data Excel file"""
        df = pd.read_excel(file_path)
        # Process based on your specific data structure
        return df.to_dict('records')
    
    def save_to_firebase(inventory_data):
        """Save inventory data to Firebase"""
        batch = db.batch()
    
        for item in inventory_data:
            # Use plan_id as document ID
            doc_ref = db.collection('plans').document(item['plan_id'])
            batch.set(doc_ref, item)
    
        batch.commit()
        return True
    
    ```
    
2. Add endpoints to FastAPI
    
    ```python
    # main.py (updated)
    import os
    import shutil
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from file_processor import process_inventory_file, process_historical_file, save_to_firebase
    from rule_engine import generate_rankings
    
    app = FastAPI()
    
    # Enable CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    @app.post("/api/process-files")
    async def process_files(inventory: UploadFile = File(...), historical: UploadFile = File(...)):
        # Create temp directory if it doesn't exist
        os.makedirs("temp", exist_ok=True)
    
        # Save uploaded files
        inventory_path = f"temp/{inventory.filename}"
        historical_path = f"temp/{historical.filename}"
    
        with open(inventory_path, "wb") as buffer:
            shutil.copyfileobj(inventory.file, buffer)
    
        with open(historical_path, "wb") as buffer:
            shutil.copyfileobj(historical.file, buffer)
    
        # Process files
        try:
            inventory_data = process_inventory_file(inventory_path)
            historical_data = process_historical_file(historical_path)
    
            # Save to Firebase
            save_to_firebase(inventory_data)
    
            # Generate rankings
            result_path = generate_rankings(inventory_data, historical_data)
    
            return {
                "message": "Files processed successfully",
                "inventory_count": len(inventory_data),
                "result_file": result_path
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            # Clean up temp files
            if os.path.exists(inventory_path):
                os.remove(inventory_path)
            if os.path.exists(historical_path):
                os.remove(historical_path)
    
    @app.get("/api/download/{filename}")
    async def download_file(filename: str):
        file_path = f"results/{filename}"
        if os.path.exists(file_path):
            return FileResponse(file_path, filename=filename)
        raise HTTPException(status_code=404, detail="File not found")
    
    ```
    

### Phase 3: Data Review & Firebase Storage

### Frontend - Data Review Component

1. Create a component to review extracted plan data before saving
    
    ```jsx
    // src/components/DataReview.jsimport React, { useState } from 'react';import {   Table, TableBody, TableCell, TableContainer,   TableHead, TableRow, Paper, Button, Typography } from '@mui/material';import { doc, setDoc, collection } from "firebase/firestore";import { db } from '../firebase';const DataReview = ({ inventoryData, onSubmit }) => {  const [isSubmitting, setIsSubmitting] = useState(false);    const handleSaveToFirebase = async () => {    setIsSubmitting(true);        try {      // Save each plan to Firebase      const promises = inventoryData.map(async (plan) => {        const planRef = doc(collection(db, "plans"), plan.plan_id);        await setDoc(planRef, {          plan_id: plan.plan_id,          budget_cap: plan.budget_cap,          tags: plan.tags,          publisher: plan.publisher,          subcategory: plan.subcategory,          created_at: new Date()        });      });            await Promise.all(promises);      onSubmit();    } catch (error) {      console.error("Error saving to Firebase:", error);      alert("Error saving data to Firebase");    } finally {      setIsSubmitting(false);    }  };    if (!inventoryData || inventoryData.length === 0) {    return <Typography>No inventory data available for review</Typography>;  }    return (    <Paper elevation={3} style={{ padding: '20px', marginTop: '20px' }}>      <Typography variant="h5" gutterBottom>Review Plan Data</Typography>      <Typography variant="body2" gutterBottom>        {inventoryData.length} plan(s) found in the inventory file.        Please review before submitting to Firebase.      </Typography>            <TableContainer component={Paper} style={{ marginTop: '20px', maxHeight: '400px' }}>        <Table stickyHeader>          <TableHead>            <TableRow>              <TableCell>Plan ID</TableCell>              <TableCell>Budget Cap</TableCell>              <TableCell>Tags</TableCell>              <TableCell>Publisher</TableCell>              <TableCell>Subcategory</TableCell>            </TableRow>          </TableHead>          <TableBody>            {inventoryData.map((plan, index) => (              <TableRow key={index}>                <TableCell>{plan.plan_id}</TableCell>                <TableCell>{plan.budget_cap}</TableCell>                <TableCell>{plan.tags}</TableCell>                <TableCell>{plan.publisher}</TableCell>                <TableCell>{plan.subcategory}</TableCell>              </TableRow>            ))}          </TableBody>        </Table>      </TableContainer>            <Button        variant="contained"        color="primary"        style={{ marginTop: '20px' }}        onClick={handleSaveToFirebase}        disabled={isSubmitting}      >        {isSubmitting ? 'Saving...' : 'Save to Firebase & Run Analysis'}      </Button>    </Paper>  );};export default DataReview;
    
    ```
    

### Phase 4: Rule Engine Implementation

### Python Rule Engine

1. Create the rule engine module for ranking plan IDs
    
    ```python
    # rule_engine.pyimport pandas as pdimport numpy as npimport osfrom datetime import datetimedef generate_rankings(inventory_data, historical_data):    """Generate rankings based on inventory and historical data"""    # Create output directory if it doesn't exist    os.makedirs("results", exist_ok=True)        # Create DataFrame from inventory data    inventory_df = pd.DataFrame(inventory_data)        # Create DataFrame from historical data    historical_df = pd.DataFrame(historical_data)        # Get unique publishers    publishers = inventory_df['publisher'].unique()        # Results dictionary to store rankings by publisher    results = {}        for publisher in publishers:        # Filter inventory for this publisher        publisher_inventory = inventory_df[inventory_df['publisher'] == publisher]                # Filter historical data for this publisher        publisher_historical = historical_df[historical_df['publisher'] == publisher]                # Calculate metrics for each plan        ranked_plans = []                for _, plan in publisher_inventory.iterrows():            plan_id = plan['plan_id']                        # Get historical data for this plan            plan_history = publisher_historical[publisher_historical['plan_id'] == plan_id]                        if not plan_history.empty:                # Calculate metrics from historical data                avg_epc = plan_history['epc'].mean() if 'epc' in plan_history.columns else 0                avg_ctr = plan_history['ctr'].mean() if 'ctr' in plan_history.columns else 0                avg_revenue = plan_history['revenue'].mean() if 'revenue' in plan_history.columns else 0                                # If this is a new plan with no history, use subcategory averages                if avg_epc == 0 or avg_ctr == 0:                    subcategory = plan['subcategory']                    subcategory_history = publisher_historical[                        publisher_historical['subcategory'] == subcategory                    ]                                        if not subcategory_history.empty:                        avg_epc = subcategory_history['epc'].mean() if 'epc' in subcategory_history.columns else 0                        avg_ctr = subcategory_history['ctr'].mean() if 'ctr' in subcategory_history.columns else 0                        avg_revenue = subcategory_history['revenue'].mean() if 'revenue' in subcategory_history.columns else 0            else:                # No history for this plan, use subcategory averages                subcategory = plan['subcategory']                subcategory_history = publisher_historical[                    publisher_historical['subcategory'] == subcategory                ]                                if not subcategory_history.empty:                    avg_epc = subcategory_history['epc'].mean() if 'epc' in subcategory_history.columns else 0                    avg_ctr = subcategory_history['ctr'].mean() if 'ctr' in subcategory_history.columns else 0                    avg_revenue = subcategory_history['revenue'].mean() if 'revenue' in subcategory_history.columns else 0                else:                    # No subcategory history either, use defaults                    avg_epc = 0                    avg_ctr = 0                    avg_revenue = 0                        # Calculate score based on metrics            # Adjust weights based on importance of each metric            score = (avg_epc * 0.4) + (avg_ctr * 0.3) + (avg_revenue / 1000 * 0.3)                        # Adjust for budget cap            budget_factor = min(1.0, plan['budget_cap'] / 1000)  # Normalize budget effect            adjusted_score = score * budget_factor                        ranked_plans.append({                'plan_id': plan_id,                'publisher': publisher,                'tags': plan['tags'],                'subcategory': plan['subcategory'],                'budget_cap': plan['budget_cap'],                'avg_epc': avg_epc,                'avg_ctr': avg_ctr,                'avg_revenue': avg_revenue,                'score': adjusted_score,                'rank': 0  # Will be set after sorting            })                # Sort plans by score and assign ranks        ranked_plans = sorted(ranked_plans, key=lambda x: x['score'], reverse=True)                for i, plan in enumerate(ranked_plans):            plan['rank'] = i + 1                results[publisher] = ranked_plans        # Generate output Excel file    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")    output_file = f"results/rankings_{timestamp}.xlsx"        with pd.ExcelWriter(output_file) as writer:        # Write summary sheet        summary_rows = []        for publisher, plans in results.items():            for plan in plans:                summary_rows.append({                    'Publisher': publisher,                    'Plan ID': plan['plan_id'],                    'Rank': plan['rank'],                    'Tags': plan['tags'],                    'Subcategory': plan['subcategory'],                    'Budget Cap': plan['budget_cap'],                    'Avg EPC': plan['avg_epc'],                    'Avg CTR': plan['avg_ctr'],                    'Avg Revenue': plan['avg_revenue'],                    'Score': plan['score']                })                summary_df = pd.DataFrame(summary_rows)        summary_df.to_excel(writer, sheet_name='Summary', index=False)                # Write individual publisher sheets        for publisher, plans in results.items():            publisher_df = pd.DataFrame(plans)            publisher_df.to_excel(writer, sheet_name=publisher[:31], index=False)  # Excel sheet names limited to 31 chars        return output_file
    
    ```
    

### Phase 5: Results Display & Download

### Frontend - Results Component

1. Create a component to display ranking results and download Excel
    
    ```jsx
    // src/components/Results.jsimport React, { useState, useEffect } from 'react';import {   Paper, Typography, Button, CircularProgress,  Table, TableBody, TableCell, TableContainer,   TableHead, TableRow, Tabs, Tab, Box } from '@mui/material';import DownloadIcon from '@mui/icons-material/Download';import axios from 'axios';function TabPanel(props) {  const { children, value, index, ...other } = props;  return (    <div      role="tabpanel"      hidden={value !== index}      id={`publisher-tabpanel-${index}`}      aria-labelledby={`publisher-tab-${index}`}      {...other}    >      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}    </div>  );}const Results = ({ resultFile }) => {  const [loading, setLoading] = useState(false);  const [results, setResults] = useState(null);  const [publishers, setPublishers] = useState([]);  const [activeTab, setActiveTab] = useState(0);    useEffect(() => {    if (resultFile) {      // In a real app, you would fetch the results data      // For MVP, we'll simulate results structure      const mockResults = {        'Publisher A': [          { plan_id: '12345', rank: 1, tags: 'tag1,tag2', subcategory: 'Electronics', budget_cap: 1000, avg_epc: 0.23, avg_ctr: 0.05, avg_revenue: 150, score: 0.85 },          { plan_id: '67890', rank: 2, tags: 'tag3,tag4', subcategory: 'Fashion', budget_cap: 800, avg_epc: 0.19, avg_ctr: 0.04, avg_revenue: 120, score: 0.72 },        ],        'Publisher B': [          { plan_id: '54321', rank: 1, tags: 'tag2,tag5', subcategory: 'Travel', budget_cap: 1200, avg_epc: 0.25, avg_ctr: 0.03, avg_revenue: 180, score: 0.79 },          { plan_id: '09876', rank: 2, tags: 'tag1,tag3', subcategory: 'Food', budget_cap: 600, avg_epc: 0.15, avg_ctr: 0.02, avg_revenue: 90, score: 0.63 },        ]      };            setResults(mockResults);      setPublishers(Object.keys(mockResults));    }  }, [resultFile]);    const handleTabChange = (event, newValue) => {    setActiveTab(newValue);  };    const handleDownload = async () => {    setLoading(true);    try {      const response = await axios.get(`http://localhost:8000/api/download/${resultFile}`, {        responseType: 'blob',      });            // Create download link      const url = window.URL.createObjectURL(new Blob([response.data]));      const link = document.createElement('a');      link.href = url;      link.setAttribute('download', resultFile);      document.body.appendChild(link);      link.click();      link.remove();    } catch (error) {      console.error('Download error:', error);      alert('Error downloading results file');    } finally {      setLoading(false);    }  };    if (!resultFile) {    return null;  }    if (!results) {    return (      <Paper elevation={3} style={{ padding: '20px', marginTop: '20px', textAlign: 'center' }}>        <CircularProgress />        <Typography variant="body1" style={{ marginTop: '10px' }}>          Loading results...        </Typography>      </Paper>    );  }    return (    <Paper elevation={3} style={{ padding: '20px', marginTop: '20px' }}>      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>        <Typography variant="h5">Ranking Results</Typography>        <Button          variant="contained"          color="primary"          startIcon={<DownloadIcon />}          onClick={handleDownload}          disabled={loading}        >          {loading ? <CircularProgress size={24} /> : 'Download Results'}        </Button>      </div>            <Tabs value={activeTab} onChange={handleTabChange} aria-label="publisher tabs">        {publishers.map((pub, index) => (          <Tab key={index} label={pub} id={`publisher-tab-${index}`} />        ))}      </Tabs>            {publishers.map((publisher, index) => (        <TabPanel key={index} value={activeTab} index={index}>          <Typography variant="h6" gutterBottom>{publisher} Rankings</Typography>          <TableContainer>            <Table size="small">              <TableHead>                <TableRow>                  <TableCell>Rank</TableCell>                  <TableCell>Plan ID</TableCell>                  <TableCell>Tags</TableCell>                  <TableCell>Subcategory</TableCell>                  <TableCell>Budget Cap</TableCell>                  <TableCell>Avg EPC</TableCell>                  <TableCell>Avg CTR</TableCell>                  <TableCell>Avg Revenue</TableCell>                  <TableCell>Score</TableCell>                </TableRow>              </TableHead>              <TableBody>                {results[publisher].map((plan) => (                  <TableRow key={plan.plan_id}>                    <TableCell>{plan.rank}</TableCell>                    <TableCell>{plan.plan_id}</TableCell>                    <TableCell>{plan.tags}</TableCell>                    <TableCell>{plan.subcategory}</TableCell>                    <TableCell>${plan.budget_cap}</TableCell>                    <TableCell>{plan.avg_epc.toFixed(3)}</TableCell>                    <TableCell>{(plan.avg_ctr * 100).toFixed(2)}%</TableCell>                    <TableCell>${plan.avg_revenue.toFixed(2)}</TableCell>                    <TableCell>{plan.score.toFixed(2)}</TableCell>                  </TableRow>                ))}              </TableBody>            </Table>          </TableContainer>        </TabPanel>      ))}    </Paper>  );};export default Results;
    
    ```
    

### Main App Component

1. Wire everything together in the main App component
    
    ```jsx
    // src/App.jsimport React, { useState } from 'react';import { Container, Typography, Stepper, Step, StepLabel, Paper } from '@mui/material';import FileUpload from './components/FileUpload';import DataReview from './components/DataReview';import Results from './components/Results';function App() {  const [activeStep, setActiveStep] = useState(0);  const [inventoryData, setInventoryData] = useState(null);  const [resultFile, setResultFile] = useState(null);    const steps = ['Upload Files', 'Review Data', 'View Results'];    const handleFileProcessed = (data) => {    setInventoryData(data.inventoryData);    setActiveStep(1);  };    const handleDataSubmitted = (result) => {    setResultFile(result.resultFile);    setActiveStep(2);  };    return (    <Container maxWidth="lg" style={{ marginTop: '30px', marginBottom: '30px' }}>      <Typography variant="h4" component="h1" gutterBottom style={{ textAlign: 'center' }}>        Automatic Distribution Planner      </Typography>            <Paper elevation={1} style={{ padding: '20px', marginBottom: '20px' }}>        <Stepper activeStep={activeStep} alternativeLabel>          {steps.map((label) => (            <Step key={label}>              <StepLabel>{label}</StepLabel>            </Step>          ))}        </Stepper>      </Paper>            {activeStep === 0 && (        <FileUpload onProcessed={handleFileProcessed} />      )}            {activeStep === 1 && (        <DataReview           inventoryData={inventoryData}          onSubmit={handleDataSubmitted}        />      )}            {activeStep === 2 && (        <Results resultFile={resultFile} />      )}    </Container>  );}export default App;
    
    ```
    

### Phase 6: MVP Testing & Deployment

### Testing

1. Test the frontend file uploads
    - Ensure Excel files are correctly parsed
    - Verify data appears correctly in review screen
2. Test Firebase integration
    - Verify plan data is correctly saved to Firestore
    - Check that plan IDs are used as document IDs
3. Test rule engine
    - Verify correct rankings based on test data
    - Ensure Excel output contains all required information

### Deployment

1. Backend deployment
    - Set up a server (e.g., AWS EC2, Google Cloud Run, or Heroku)
    - Deploy FastAPI application
    - Set up environment variables for Firebase credentials
2. Frontend deployment
    - Build React application for production
    
    ```bash
    npm run build
    
    ```
    
    - Deploy to hosting service (e.g., Firebase Hosting, Netlify, Vercel)
    - Configure environment variables for API URL

## Future Enhancements

### Phase 7: User Authentication & Permissions

- Add user authentication using Firebase Auth
- Create user roles and permissions
- Implement secure API endpoints

### Phase 8: Advanced Analytics

- Add historical performance tracking
- Create visualizations for performance metrics
- Implement automated reporting

### Phase 9: Automatic Scheduling

- Create scheduled runs of the distribution planner
- Implement notifications for distribution changes
- Add approval workflows for major changes

## Data Structure Guidelines

### Inventory Report Excel Structure

The inventory report Excel file should contain the following columns:

- `plan_id`: Unique identifier for each plan
- `budget_cap`: Daily budget cap for the plan
- `tags`: Comma-separated tags for categorization
- `publisher`: Publisher name
- `subcategory`: Subcategory of the offer

### Historical Data Excel Structure

The historical data Excel file