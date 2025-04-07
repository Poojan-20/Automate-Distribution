import React, { useState, useEffect } from 'react';
import { Plan } from '@/utils/excelParser';
import PlanTable from './PlanTable';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { savePlanToFirebase } from '@/utils/firebaseOperations';

interface DataReviewProps {
  inventoryData: Plan[];
  onSubmit: (result: { resultFile: string }) => void;
}

const DataReview: React.FC<DataReviewProps> = ({ inventoryData, onSubmit }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Initialize with the inventory data
  useEffect(() => {
    if (inventoryData && inventoryData.length > 0) {
      setPlans(inventoryData);
    }
  }, [inventoryData]);

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
      if (!plan.publisher || plan.budgetCap <= 0) {
        isValid = false;
        unfilledCount++;
      }
      
      // Add validation for mandatory fields based on tags
      if (plan.tags.includes('Mandatory') && (!plan.distributionCount || plan.distributionCount <= 0)) {
        isValid = false;
        unfilledCount++;
      }
      
      if (plan.tags.includes('FOC') && (!plan.clicksToBeDelivered || plan.clicksToBeDelivered <= 0)) {
        isValid = false;
        unfilledCount++;
      }
    });

    if (!isValid) {
      setWarning(`${unfilledCount} plan(s) have missing or invalid values. Please check publisher, budget cap, and tag-specific requirements.`);
    } else {
      setWarning(null);
    }

    return isValid;
  };

  const handleSaveToFirebase = async () => {
    if (!plans || plans.length === 0) {
      setError('No inventory data to save');
      return;
    }

    if (!validatePlans()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Save all plans to Firebase
      const savePromises = plans.map(async (plan) => {
        if (!plan.publisher || plan.publisher.length === 0) {
          throw new Error(`Plan ${plan.planId} is missing publisher`);
        }
        if (plan.budgetCap <= 0) {
          throw new Error(`Plan ${plan.planId} has invalid budget cap`);
        }
        return savePlanToFirebase(plan);
      });

      await Promise.all(savePromises);

      // Generate a timestamp-based result file name
      const resultFile = `rankings_${new Date().getTime()}.xlsx`;

      setSuccess(`Successfully saved ${plans.length} plans to the database.`);
      onSubmit({ resultFile });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plans to database');
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
          onClick={handleSaveToFirebase}
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
            'Save & Generate Rankings'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DataReview; 