"use client";
import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DataReview from "@/components/DataReview";
import ResultsView from "@/components/ResultsView";
import { Plan } from "@/utils/excelParser";

// Define the data type for handleFileProcessed
interface ProcessedData {
  inventoryData: Plan[];
  resultFile: string;
  historicalFile: File;
}

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [inventoryData, setInventoryData] = useState<Plan[] | null>(null);
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [resultFile, setResultFile] = useState<string | null>(null);

  const steps = ['Upload Files', 'Review & Complete Data', 'View Results'];

  const handleFileProcessed = (data: ProcessedData) => {
    setInventoryData(data.inventoryData);
    setHistoricalFile(data.historicalFile);
    setResultFile(data.resultFile);
    setActiveStep(1);
  };

  const handleDataSubmitted = (result: { resultFile: string }) => {
    setResultFile(result.resultFile);
    setActiveStep(2);
  };

  const handleStepClick = (stepIndex: number) => {
    // Only allow going back if we have data
    if (stepIndex < activeStep) {
      setActiveStep(stepIndex);
    }
  };

  const handleStartOver = () => {
    setActiveStep(0);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="w-full py-4 bg-blue-600 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center space-x-4">
          <div className="bg-white p-2 rounded-full">
            <svg
              className="h-8 w-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Distribution Planner Ranker</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-full mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className="flex flex-col items-center relative flex-1"
                  onClick={() => handleStepClick(index)}
                >
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 cursor-pointer
                      ${activeStep === index 
                        ? 'bg-blue-600 text-white' 
                        : activeStep > index 
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                  >
                    {activeStep > index ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm font-medium ${activeStep === index ? 'text-blue-600' : 'text-gray-600'}`}>
                    {label}
                  </span>
                  {index < steps.length - 1 && (
                    <div 
                      className={`absolute top-4 left-1/2 w-full h-0.5 
                        ${activeStep > index ? 'bg-green-500' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {activeStep === 0 && (
              <FileUpload onProcessed={handleFileProcessed} />
            )}
            
            {activeStep === 1 && inventoryData && historicalFile && (
              <DataReview
                inventoryData={inventoryData}
                historicalFile={historicalFile}
                onSubmit={handleDataSubmitted}
              />
            )}

            {activeStep === 2 && resultFile && (
              <ResultsView 
                resultFile={resultFile}
                onStartOver={handleStartOver}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
