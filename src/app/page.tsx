"use client";
import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import DataReview from "@/components/DataReview";
import ResultsView from "@/components/ResultsView";
import { Plan } from "@/utils/excelParser";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Define the data type for handleFileProcessed
interface ProcessedData {
  inventoryData: Plan[];
  resultFile: string;
  historicalFile: File;
  performanceReport?: string;
}

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [inventoryData, setInventoryData] = useState<Plan[] | null>(null);
  const [historicalFile, setHistoricalFile] = useState<File | null>(null);
  const [resultFile, setResultFile] = useState<string | null>(null);
  const [performanceReport, setPerformanceReport] = useState<string | null>(null);

  const steps = ['Upload Files', 'Review & Complete Data', 'View Results'];

  const handleFileProcessed = (data: ProcessedData) => {
    setInventoryData(data.inventoryData);
    setHistoricalFile(data.historicalFile);
    setResultFile(data.resultFile);
    setPerformanceReport(data.performanceReport || null);
    setActiveStep(1);
  };

  const handleDataSubmitted = (resultFile: string, performanceReportFile?: string) => {
    setResultFile(resultFile);
    setPerformanceReport(performanceReportFile || null);
    setActiveStep(2);
  };

  const handleStepClick = (stepIndex: number) => {
    // Only allow going back if we have data
    if (stepIndex < activeStep) {
      setActiveStep(stepIndex);
    }
  };

  const handleStartOver = () => {
    setInventoryData(null);
    setHistoricalFile(null);
    setResultFile(null);
    setPerformanceReport(null);
    setActiveStep(0);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="w-full py-4 bg-blue-600 dark:bg-gray-800 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white dark:bg-gray-700 p-2 rounded-full">
              <svg width="50" height="50" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_10183_298035)">
                  <rect width="40" height="40" rx="20" fill="#F7AB20"/>
                  <path d="M22.0928 31.9995C22.2163 31.6999 22.4025 31.4302 22.6391 31.2086C22.8756 30.9871 23.1569 30.8188 23.4639 30.7152C23.771 30.6116 24.0967 30.575 24.4191 30.6079C24.7415 30.6409 25.0531 30.7426 25.3328 30.9062C25.7152 31.1322 26.1553 31.2416 26.599 31.2209C27.0427 31.2002 27.4708 31.0504 27.8305 30.7898C28.1902 30.5292 28.466 30.1692 28.6239 29.7541C28.7818 29.3389 28.8151 28.8866 28.7195 28.4529C28.6479 28.1365 28.6447 27.8085 28.71 27.4907C28.7753 27.173 28.9077 26.8728 29.0983 26.6103C29.2888 26.3478 29.5332 26.129 29.8151 25.9685C30.097 25.808 30.4099 25.7095 30.7328 25.6795C31.1869 25.6548 31.623 25.4941 31.9844 25.2183C32.3459 24.9425 32.6161 24.5644 32.7599 24.133C32.9037 23.7016 32.9144 23.237 32.7907 22.7995C32.667 22.3619 32.4146 21.9717 32.0662 21.6795C31.8247 21.4656 31.6313 21.2028 31.4989 20.9086C31.3665 20.6144 31.298 20.2955 31.298 19.9729C31.298 19.6502 31.3665 19.3313 31.4989 19.0371C31.6313 18.7429 31.8247 18.4801 32.0662 18.2662C32.4146 17.974 32.667 17.5838 32.7907 17.1462C32.9144 16.7087 32.9037 16.2441 32.7599 15.8127C32.6161 15.3814 32.3459 15.0032 31.9844 14.7274C31.623 14.4516 31.1869 14.2909 30.7328 14.2662C30.4099 14.2362 30.097 14.1377 29.8151 13.9772C29.5332 13.8167 29.2888 13.5979 29.0983 13.3354C28.9077 13.0729 28.7753 12.7727 28.71 12.455C28.6447 12.1373 28.6479 11.8092 28.7195 11.4929C28.802 11.063 28.7591 10.6185 28.5958 10.2124C28.4325 9.80634 28.1558 9.45583 27.7987 9.20277C27.4416 8.9497 27.0192 8.80477 26.5819 8.78528C26.1447 8.76579 25.7111 8.87256 25.3328 9.09286C25.0531 9.25645 24.7415 9.35815 24.4191 9.3911C24.0967 9.42405 23.771 9.38748 23.4639 9.28386C23.1569 9.18024 22.8756 9.01198 22.6391 8.79042C22.4025 8.56887 22.2163 8.29917 22.0928 7.99952C21.9164 7.59076 21.6242 7.2426 21.2522 6.998C20.8802 6.75339 20.4447 6.62305 19.9995 6.62305C19.5543 6.62305 19.1188 6.75339 18.7468 6.998C18.3749 7.2426 18.0826 7.59076 17.9062 7.99952C17.7827 8.29917 17.5965 8.56887 17.36 8.79042C17.1235 9.01198 16.8422 9.18024 16.5351 9.28386C16.228 9.38748 15.9023 9.42405 15.5799 9.3911C15.2575 9.35815 14.9459 9.25645 14.6662 9.09286C14.2838 8.86685 13.8437 8.75747 13.4 8.77815C12.9563 8.79883 12.5283 8.94866 12.1686 9.20925C11.8088 9.46983 11.5331 9.82982 11.3751 10.245C11.2172 10.6601 11.184 11.1124 11.2795 11.5462C11.351 11.8576 11.3562 12.1805 11.2949 12.494C11.2335 12.8075 11.107 13.1047 10.9235 13.3661C10.7399 13.6276 10.5035 13.8476 10.2295 14.0118C9.95545 14.1761 9.64998 14.2809 9.33285 14.3195C8.87883 14.3443 8.44274 14.505 8.08125 14.7808C7.71975 15.0566 7.44956 15.4347 7.30577 15.8661C7.16199 16.2974 7.15125 16.762 7.27497 17.1996C7.39869 17.6371 7.65114 18.0273 7.99952 18.3195C8.24102 18.5335 8.43436 18.7962 8.56678 19.0904C8.6992 19.3846 8.76767 19.7036 8.76767 20.0262C8.76767 20.3488 8.6992 20.6678 8.56678 20.962C8.43436 21.2562 8.24102 21.5189 7.99952 21.7329C7.65114 22.0251 7.39869 22.4153 7.27497 22.8528C7.15125 23.2903 7.16199 23.755 7.30577 24.1863C7.44956 24.6177 7.71975 24.9958 8.08125 25.2716C8.44274 25.5474 8.87883 25.7081 9.33285 25.7329C9.65584 25.7628 9.96873 25.8613 10.2506 26.0218C10.5325 26.1824 10.7769 26.4012 10.9674 26.6637C11.158 26.9262 11.2904 27.2263 11.3557 27.5441C11.421 27.8618 11.4178 28.1898 11.3462 28.5062C11.2735 28.9268 11.3203 29.3594 11.4813 29.7548C11.6424 30.1501 11.9112 30.4923 12.2571 30.7424C12.6031 30.9925 13.0123 31.1404 13.4382 31.1694C13.8641 31.1983 14.2896 31.1071 14.6662 30.9062C14.9434 30.7415 15.2526 30.6378 15.5731 30.6022C15.8936 30.5665 16.218 30.5996 16.5247 30.6993C16.8313 30.799 17.1132 30.963 17.3514 31.1803C17.5897 31.3976 17.7788 31.6633 17.9062 31.9595C18.0787 32.37 18.3676 32.721 18.7372 32.9692C19.1069 33.2174 19.5411 33.3519 19.9864 33.3562C20.4316 33.3604 20.8683 33.2342 21.2427 32.9931C21.617 32.752 21.9125 32.4066 22.0928 31.9995V31.9995ZM16.3328 14.6662C16.6625 14.6662 16.9847 14.7639 17.2588 14.9471C17.5329 15.1302 17.7465 15.3905 17.8726 15.6951C17.9988 15.9996 18.0318 16.3347 17.9675 16.658C17.9032 16.9813 17.7444 17.2783 17.5114 17.5114C17.2783 17.7445 16.9813 17.9032 16.658 17.9675C16.3347 18.0318 15.9996 17.9988 15.695 17.8727C15.3905 17.7465 15.1302 17.5329 14.9471 17.2588C14.7639 16.9847 14.6662 16.6625 14.6662 16.3329C14.6662 15.8908 14.8418 15.4669 15.1543 15.1543C15.4669 14.8418 15.8908 14.6662 16.3328 14.6662ZM23.6662 25.3329C23.3365 25.3329 23.0143 25.2351 22.7402 25.052C22.4662 24.8688 22.2525 24.6085 22.1264 24.304C22.0002 23.9995 21.9672 23.6643 22.0315 23.341C22.0958 23.0177 22.2546 22.7208 22.4877 22.4877C22.7208 22.2546 23.0177 22.0959 23.341 22.0315C23.6643 21.9672 23.9994 22.0002 24.304 22.1264C24.6085 22.2525 24.8688 22.4662 25.052 22.7402C25.2351 23.0143 25.3328 23.3366 25.3328 23.6662C25.3328 24.1082 25.1573 24.5321 24.8447 24.8447C24.5321 25.1573 24.1082 25.3329 23.6662 25.3329ZM24.9995 16.9462L16.9995 24.9462C16.8756 25.0712 16.7281 25.1704 16.5656 25.238C16.4031 25.3057 16.2289 25.3406 16.0528 25.3406C15.8768 25.3406 15.7026 25.3057 15.5401 25.238C15.3776 25.1704 15.2301 25.0712 15.1062 24.9462C14.9812 24.8222 14.882 24.6748 14.8143 24.5123C14.7466 24.3498 14.7118 24.1755 14.7118 23.9995C14.7118 23.8235 14.7466 23.6492 14.8143 23.4868C14.882 23.3243 14.9812 23.1768 15.1062 23.0529L23.1062 15.0529C23.3573 14.8018 23.6978 14.6607 24.0528 14.6607C24.4079 14.6607 24.7484 14.8018 24.9995 15.0529C25.2506 15.3039 25.3916 15.6445 25.3916 15.9995C25.3916 16.3546 25.2506 16.6951 24.9995 16.9462V16.9462Z" fill="white"/>
                </g>
                <defs>
                  <clipPath id="clip0_10183_298035">
                    <rect width="40" height="40" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white dark:text-white">Revenue Planner</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-full mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700">
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
                        ? 'bg-blue-600 text-white dark:bg-blue-700' 
                        : activeStep > index 
                          ? 'bg-green-500 text-white dark:bg-green-600'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                  >
                    {activeStep > index ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    activeStep === index 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {label}
                  </span>
                  {index < steps.length - 1 && (
                    <div 
                      className={`absolute top-4 left-1/2 w-full h-0.5 
                        ${activeStep > index ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
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
                performanceReport={performanceReport || undefined}
                onStartOver={handleStartOver}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
