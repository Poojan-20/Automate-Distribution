import { useState, useRef, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseInventoryReport, Plan } from '@/utils/excelParser';
import { savePlanToFirebase } from '@/utils/firebaseOperations';

interface FileUploadProps {
  onProcessed: (data: {
    inventoryData: Plan[];
    resultFile: string;
  }) => void;
}

export default function FileUpload({ onProcessed }: FileUploadProps) {
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [inventoryData, setInventoryData] = useState<Plan[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const inventoryInputRef = useRef<HTMLInputElement>(null);
  const historicalInputRef = useRef<HTMLInputElement>(null);

  const processInventoryFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("Failed to read file");
        }
        
        // Use the async parseInventoryReport function
        const parsedData = await parseInventoryReport(data as ArrayBuffer);
        
        if (parsedData.length === 0) {
          throw new Error("No data found in file. Please check if the file is empty.");
        }
        
        // Check if required fields are present and valid
        const invalidPlans = parsedData.filter(plan => !plan.planId || !plan.subcategory);
        
        if (invalidPlans.length > 0) {
          console.log('Invalid plans:', invalidPlans);
          throw new Error(`Found ${invalidPlans.length} plans with missing Plan ID or Subcategory.`);
        }
        
        setInventoryData(parsedData);
        
      } catch (err) {
        console.error("Error processing file:", err);
        setError(err instanceof Error ? err.message : "Failed to process inventory file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleInventoryDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setInventoryFile(file);
      processInventoryFile(file);
      setError(null);
    } else {
      setError("Please upload a valid Excel file (.xlsx, .xls, .csv)");
    }
  };

  const handleHistoricalDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setHistoricalFile(file);
      setError(null);
    } else {
      setError("Please upload a valid Excel file (.xlsx, .xls, .csv)");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleInventoryFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setInventoryFile(file);
      processInventoryFile(file);
      setError(null);
    }
  };

  const handleHistoricalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHistoricalFile(file);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!inventoryFile || !historicalFile || !inventoryData) {
      setError('Please upload both files');
      return;
    }

    setIsLoading(true);
    try {
      // Save all edited plans to Firebase
      const savePromises = inventoryData
        .filter(plan => plan.isEdited)
        .map(plan => savePlanToFirebase(plan));
      
      await Promise.all(savePromises);

      if (onProcessed) {
        onProcessed({ 
          inventoryData: inventoryData,
          resultFile: 'sample-result.xlsx'
        });
      }
    } catch (error) {
      console.error('Error saving plans:', error);
      setError('Failed to save plans to database');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-lg">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-xl font-semibold text-gray-800">Upload Files</CardTitle>
        <CardDescription className="text-gray-600">
          Upload your files to compare and validate their contents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              File 1 - Inventory Report
            </label>
            <div 
              className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              onDrop={handleInventoryDrop}
              onDragOver={handleDragOver}
            >
              {!inventoryFile ? (
                <>
                  <div className="mb-4 rounded-full bg-primary p-3 text-gray-700">
                    <UploadCloud className="h-8 w-8 " />
                  </div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Drag and drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mb-4 text-gray-700">
                    Upload Excel file with Plan ID and Subcategory columns
                  </p>
                  <Input
                    ref={inventoryInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleInventoryFileChange}
                    className="hidden"
                    id="inventory-file-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="cursor-pointer"
                    onClick={() => inventoryInputRef.current?.click()}
                  >
                    Select File
                  </Button>
                </>
              ) : (
                <div className="w-full">
                  <div className="flex items-center space-x-3 mb-2 text-gray-700">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium ">{inventoryFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(inventoryFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setInventoryFile(null)}
                    >
                      X
                    </Button>
                  </div>
                  
                  {inventoryData && (
                    <div className="mt-2 text-gray-500">
                      <p className="text-xs text-muted-foreground mb-1">
                        {inventoryData.length} plans found (requires publisher & budget cap input in next step)
                      </p>
                      <Progress value={100} className="h-1" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              File 2 - Historical Data
            </label>
            <div 
              className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              onDrop={handleHistoricalDrop}
              onDragOver={handleDragOver}
            >
              {!historicalFile ? (
                <>
                  <div className="mb-4 rounded-full bg-primary p-3 text-gray-700">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Drag and drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mb-4 text-gray-700">
                    Support for Excel files (.xlsx, .xls, .csv)
                  </p>
                  <Input
                    ref={historicalInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleHistoricalFileChange}
                    className="hidden"
                    id="historical-file-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="cursor-pointer"
                    onClick={() => historicalInputRef.current?.click()}
                  >
                    Select File
                  </Button>
                </>
              ) : (
                <div className="w-full">
                  <div className="flex items-center space-x-3 text-gray-700">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium ">{historicalFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(historicalFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setHistoricalFile(null)}
                    >
                      X
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-gray-50 border-t border-gray-100 p-6">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
          onClick={handleSubmit}
          disabled={!inventoryFile || !historicalFile || isLoading || !inventoryData}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Files...
            </div>
          ) : (
            'Compare Files'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 