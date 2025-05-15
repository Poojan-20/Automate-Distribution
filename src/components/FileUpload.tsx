import { useState, useRef, ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseInventoryReport, Plan } from '@/utils/excelParser';
import { savePlanToFirebase } from '@/utils/firebaseOperations';

interface ProcessedData {
  inventoryData: Plan[];
  historicalFile: File;
  resultFile: string;
  performanceReport?: string;
}

interface FileUploadProps {
  onProcessed: (data: ProcessedData) => void;
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
    console.log('Processing inventory file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          console.error('Failed to read file data');
          throw new Error("Failed to read file");
        }
        console.log('File data loaded, size:', (data as ArrayBuffer).byteLength);
        
        // Use the async parseInventoryReport function
        const parsedData = await parseInventoryReport(data as ArrayBuffer);
        console.log('Parsed inventory data:', parsedData);
        
        if (parsedData.length === 0) {
          console.error('No data found in parsed inventory file');
          throw new Error("No data found in file. Please check if the file is empty.");
        }
        
        // Check if required fields are present and valid
        const invalidPlans = parsedData.filter(plan => !plan.planId || !plan.subcategory);
        console.log('Invalid plans found:', invalidPlans);
        
        if (invalidPlans.length > 0) {
          console.error(`Found ${invalidPlans.length} invalid plans:`, invalidPlans);
          throw new Error(`Found ${invalidPlans.length} plans with missing Plan ID or Subcategory.`);
        }
        
        setInventoryData(parsedData);
        console.log('Inventory data set successfully');
        
      } catch (err) {
        console.error("Error processing inventory file:", err);
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
      console.error('Missing required files:', {
        inventoryFile: !!inventoryFile,
        historicalFile: !!historicalFile,
        inventoryData: !!inventoryData
      });
      setError('Please upload both files');
      return;
    }

    console.log('Starting submit process with files:', {
      inventoryFileName: inventoryFile.name,
      historicalFileName: historicalFile.name,
      inventoryDataCount: inventoryData.length
    });

    setIsLoading(true);
    try {
      // Save all edited plans to Firebase
      const editedPlans = inventoryData.filter(plan => plan.isEdited);
      console.log(`Saving ${editedPlans.length} edited plans to Firebase`);
      
      const savePromises = editedPlans.map(plan => savePlanToFirebase(plan));
      await Promise.all(savePromises);
      console.log('All edited plans saved successfully');

      if (onProcessed) {
        console.log('Calling onProcessed callback with data');
        onProcessed({ 
          inventoryData: inventoryData,
          resultFile: 'sample-result.xlsx',
          historicalFile: historicalFile,
          performanceReport: 'overall_performance_report.xlsx'
        });
      }
    } catch (error) {
      console.error('Error in submit process:', error);
      setError('Failed to save plans to database');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <CardHeader className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-800 dark:text-white">Upload Files</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Upload your files to compare and validate their contents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {error && (
          <Alert variant="destructive" className="mb-6 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              File 1 - Inventory Report
            </label>
            <div 
              className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onDrop={handleInventoryDrop}
              onDragOver={handleDragOver}
            >
              {!inventoryFile ? (
                <>
                  <div className="mb-4 rounded-full bg-gray-200 dark:bg-gray-600 p-3 text-gray-700">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Drag and drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mb-4">
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
                    className="cursor-pointer text-gray-700"
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              File 2 - Historical Data
            </label>
            <div 
              className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              onDrop={handleHistoricalDrop}
              onDragOver={handleDragOver}
            >
              {!historicalFile ? (
                <>
                  <div className="mb-4 rounded-full p-3 text-gray-700 bg-gray-200 dark:bg-gray-600">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <p className="mb-2 text-sm font-medium text-gray-700">Drag and drop or click to upload</p>
                  <p className="text-xs text-muted-foreground mb-4">
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
                    className="cursor-pointer text-gray-700"
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
      <CardFooter className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 p-6">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-800 dark:hover:bg-blue-900 text-white py-3"
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