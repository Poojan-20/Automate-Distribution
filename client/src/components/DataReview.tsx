import React, { useState, useEffect } from 'react';
import { Plan, parseHistoricalData, parseInventoryReport, HistoricalData } from '@/utils/excelParser';
import PlanTable from './PlanTable';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiService } from '@/utils/apiService';
import { savePlanToFirebase } from '@/utils/firebaseOperations';

interface DataReviewProps {
  inventoryData: Plan[];
  historicalFile: File;
  onSubmit: (result: { resultFile: string }) => void;
}

const DataReview: React.FC<DataReviewProps> = ({ inventoryData, historicalFile, onSubmit }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [firebaseSaveStatus, setFirebaseSaveStatus] = useState<{success: number; failed: number}>({ success: 0, failed: 0 });

  // Load historical data
  useEffect(() => {
    const loadHistoricalData = async () => {
      try {
        const buffer = await historicalFile.arrayBuffer();
        const parsedData = parseHistoricalData(buffer);
        console.log(`Parsed ${parsedData.length} historical data records`);
        setHistoricalData(parsedData);
      } catch (err) {
        console.error('Error loading historical data:', err);
        setError('Failed to load historical data');
      }
    };
    
    if (historicalFile) {
      loadHistoricalData();
    }
  }, [historicalFile]);

  // Calculate average revenue and merge with inventory data
  useEffect(() => {
    if (inventoryData.length > 0 && historicalData.length > 0) {
      // Group historical data by plan ID and publisher
      const revenueByPlan = historicalData.reduce((acc, item) => {
        const key = item.planId;
        if (!acc[key]) {
          acc[key] = { totalRevenue: 0, count: 0 };
        }
        acc[key].totalRevenue += item.revenue || 0;
        acc[key].count += 1;
        return acc;
      }, {} as Record<string, { totalRevenue: number; count: number }>);

      // Merge with inventory data
      const enrichedPlans = inventoryData.map(plan => {
        const revenueData = revenueByPlan[plan.planId];
        const avgRevenue = revenueData 
          ? revenueData.count > 0 
            ? revenueData.totalRevenue / revenueData.count 
            : 0 
          : 0;
        
        return {
          ...plan,
          avgRevenue: avgRevenue
        };
      });

      console.log('Enriched plans with average revenue:', enrichedPlans);
      setPlans(enrichedPlans);
    } else {
      setPlans(inventoryData);
    }
  }, [inventoryData, historicalData]);

  // Update a specific plan
  const handlePlanUpdate = (updatedPlan: Plan) => {
    setPlans(prevPlans => 
      prevPlans.map(plan => 
        plan.planId === updatedPlan.planId ? updatedPlan : plan
      )
    );
  };

  // Validate all plans before submission
  const validatePlans = (): boolean => {
    let isValid = true;
    let unfilledCount = 0;

    plans.forEach(plan => {
      // Check if publisher is selected
      if (!plan.publisher || plan.publisher.length === 0) {
        isValid = false;
        unfilledCount++;
      }
      
      // Budget cap can be 0 for certain cases, so we only check if it's undefined
      if (plan.budgetCap === undefined) {
        isValid = false;
        unfilledCount++;
      }
      
      // Add validation for mandatory fields based on tags
      if (plan.tags.includes('Mandatory')) {
        // For Mandatory tag, distribution count must be provided but can be 0
        if (plan.distributionCount === undefined) {
          isValid = false;
          unfilledCount++;
        }
      }
      
      if (plan.tags.includes('FOC')) {
        // For FOC tag, clicks to be delivered must be provided but can be 0
        if (plan.clicksToBeDelivered === undefined) {
          isValid = false;
          unfilledCount++;
        }
      }
    });

    if (!isValid) {
      setWarning(`${unfilledCount} plan(s) have missing values. Please check publisher and required fields for each tag type.`);
    } else {
      setWarning(null);
    }

    return isValid;
  };

  // Save all plans to Firebase
  const saveAllPlansToFirebase = async () => {
    let successCount = 0;
    let failedCount = 0;
    
    for (const plan of plans) {
      try {
        await savePlanToFirebase(plan);
        successCount++;
      } catch (error) {
        console.error(`Failed to save plan ${plan.planId} to Firebase:`, error);
        failedCount++;
      }
    }
    
    return { success: successCount, failed: failedCount };
  };

  const handleProcessData = async () => {
    if (!plans || plans.length === 0) {
      setError('No inventory data to process');
      return;
    }

    if (!validatePlans()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Save all plans to Firebase first
      const saveStatus = await saveAllPlansToFirebase();
      setFirebaseSaveStatus(saveStatus);
      
      // Continue with processing even if some Firebase saves failed
      // Convert plans data to CSV format
      const headers = ['planId', 'publisher', 'budgetCap', 'brand_name', 'subcategory', 'tags', 'distributionCount', 'clicksToBeDelivered'];
      const csvData = plans.map(plan => ({
        planId: plan.planId,
        publisher: Array.isArray(plan.publisher) ? plan.publisher.join(';') : plan.publisher,
        budgetCap: plan.budgetCap,
        brand_name: plan.brand_name,
        subcategory: plan.subcategory,
        tags: plan.tags.join(';'),
        distributionCount: plan.distributionCount || 0,
        clicksToBeDelivered: plan.clicksToBeDelivered || 0
      }));

      // Convert to CSV string
      const csvString = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => row[header as keyof typeof row]).join(','))
      ].join('\n');

      // Create a CSV file
      const csvBlob = new Blob([csvString], { type: 'text/csv' });
      const userInputFile = new File([csvBlob], 'user_input.csv', { type: 'text/csv' });

      // Process data using the Flask API
      const result = await apiService.processData(historicalFile, userInputFile);

      // Generate a timestamp-based result file name
      const resultFile = `rankings_${new Date().getTime()}.xlsx`;

      // Set success message including Firebase status
      let successMessage = `Successfully processed ${plans.length} plans.`;
      if (saveStatus.success > 0) {
        successMessage += ` Saved ${saveStatus.success} plans to database.`;
      }
      if (saveStatus.failed > 0) {
        successMessage += ` Failed to save ${saveStatus.failed} plans.`;
      }
      
      setSuccess(successMessage);
      onSubmit({ resultFile });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process plans');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-lg  mx-auto">
      <CardHeader className="border-b border-gray-100">
        <CardTitle className="text-xl font-semibold text-gray-800">Review Data</CardTitle>
        <CardDescription className="text-gray-600">
          Review and validate the extracted data before processing
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-2 md:p-6 space-y-6">
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {warning && (
            <Alert className="bg-yellow-50 text-yellow-800 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-2">Data Summary</h3>
          <p className="text-sm text-gray-600">
            {plans.length} plan(s) found in the files
          </p>
        </div>

        <div className="w-full overflow-x-auto">
          <PlanTable plans={plans} onPlanUpdate={handlePlanUpdate} />
        </div>
      </CardContent>
      
      <CardFooter className="bg-gray-50 border-t border-gray-100 p-4 md:p-6">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 md:py-3"
          onClick={handleProcessData}
          disabled={isSubmitting || !plans || plans.length === 0}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Process & Generate Rankings'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DataReview; 