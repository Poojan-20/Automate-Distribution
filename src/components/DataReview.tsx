import React, { useState, useEffect } from 'react';
import { Plan, HistoricalData, parseHistoricalData } from '@/utils/excelParser';
import PlanTable from './PlanTable';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  FileCheck, 
  ArrowRight,
  BarChart,
  Loader2
} from 'lucide-react';
import { apiService } from '@/utils/apiService';
import { savePlanToFirebase } from '@/utils/firebaseOperations';
import { useToast } from '@/components/ui/use-toast';

// Define type for CSV record
interface CsvRecord {
  planId: string;
  publisher: string;
  brand_name: string;
  subcategory: string;
  tags: string;
  distributionCount: number;
  clicksToBeDelivered: number;
  budgetCap: number;
  [key: string]: string | number; // Add index signature for flexible property access
}

interface DataReviewProps {
  inventoryData: Plan[];
  historicalFile: File;
  onSubmit: (resultFile: string, performanceReport?: string) => void;
}

const DataReview: React.FC<DataReviewProps> = ({ inventoryData, historicalFile, onSubmit }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [firebaseSaveStatus, setFirebaseSaveStatus] = useState<{success: number; failed: number}>({ success: 0, failed: 0 });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const { toast } = useToast();

  // Initialize with the inventory data
  useEffect(() => {
    if (inventoryData && inventoryData.length > 0) {
      setPlans(inventoryData);

      // Load historical data and calculate average revenue by plan ID (date-wise average)
      // This calculation intentionally ignores publisher differences and calculates
      // the average revenue for each plan ID across all dates and publishers
      const calculateAverageRevenue = async () => {
        try {
          setLoadingStats(true);
          const historicalBuffer = await historicalFile.arrayBuffer();
          const processedHistoricalData = parseHistoricalData(historicalBuffer);
          
          console.log('Historical data sample:', processedHistoricalData.slice(0, 3));
          
          // Check if we have any data before proceeding
          if (processedHistoricalData.length === 0) {
            console.warn('No historical data found');
            setLoadingStats(false);
            return;
          }
          
          // Check if this could be a format with revenue in date columns
          // If so, we will have a relatively small number of records compared to plans
          const uniquePlans = new Set(processedHistoricalData.map(record => record.planId));
          const uniquePublishers = new Set(processedHistoricalData.map(record => record.publisher));
          const uniqueDates = new Set(processedHistoricalData.map(record => {
            if (record.date instanceof Date) {
              // Format the date in a readable format like "Apr 14, 2025" for display/debugging
              const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
              return record.date.toLocaleDateString('en-US', options);
            }
            return String(record.date);
          }));
          
          console.log(`Found ${uniquePlans.size} unique plans, ${uniquePublishers.size} publishers, and ${uniqueDates.size} dates`);
          console.log(`Unique dates:`, Array.from(uniqueDates));
          
          // If we have very few dates (or only one record per plan/publisher), this might be a specialized format
          // where each record already represents all dates for a plan/publisher
          
          // Group by planId only to calculate average revenue (ignoring publisher)
          // This means the same average revenue will be shown for a plan ID regardless of publisher
          const revenueByPlan: Record<string, { totalRevenue: number; count: number }> = {};
          
          // Process each record, aggregating revenue by planId (not by publisher)
          processedHistoricalData.forEach((record: HistoricalData) => {
            const key = record.planId; // Only use planId as key, ignoring publisher
            if (!revenueByPlan[key]) {
              revenueByPlan[key] = {
                totalRevenue: 0,
                count: 0
              };
            }
            revenueByPlan[key].totalRevenue += record.revenue;
            revenueByPlan[key].count += 1;
            
            // Log date and revenue for debugging
            if (record.revenue > 0) {
              const dateFormatted = record.date instanceof Date 
                ? record.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : String(record.date);
              console.log(`Plan ${record.planId} on ${dateFormatted}: Revenue ${record.revenue}`);
            }
          });
          
          // Log the revenue data for debugging
          console.log('Revenue by plan (raw):', revenueByPlan);
          
          // Apply average revenue to each plan
          // For each plan, divide the total revenue by 7 days to get the correct average
          const updatedPlans = inventoryData.map(plan => {
            const planData = revenueByPlan[plan.planId];
            if (planData && planData.totalRevenue > 0) {
              // Divide by 7 for a 7-day average regardless of actual data points
              const avgRevenue = Math.round(planData.totalRevenue / 7);
              console.log(`Plan ${plan.planId} average revenue: ${avgRevenue} (total: ${planData.totalRevenue}, divided by 7 days)`);
              return { ...plan, avgRevenue };
            }
            
            // If we don't have data for this plan, log a warning
            console.warn(`No revenue data found for plan: ${plan.planId}`);
            return plan;
          });
          
          setPlans(updatedPlans);
          
          // Log summary of the calculation
          const plansWithRevenue = updatedPlans.filter(plan => plan.avgRevenue !== undefined);
          console.log(`Set average revenue for ${plansWithRevenue.length} out of ${updatedPlans.length} plans`);
          
        } catch (error) {
          console.error('Error calculating average revenue:', error);
          // Keep this toast - it's a validation error that needs user attention
          toast({
            variant: "destructive",
            title: "Calculation Error",
            description: "Failed to calculate average revenue from historical data.",
          });
        } finally {
          setLoadingStats(false);
        }
      };
      
      calculateAverageRevenue();
    }
  }, [inventoryData, historicalFile, toast]);

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
      
      // Budget cap validation - only required for Paid tag
      if (plan.tags.includes('Paid')) {
        if (plan.budgetCap === undefined) {
          isValid = false;
          unfilledCount++;
        }
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
      // Keep this toast - it's a validation error that needs user attention
      toast({
        variant: "warning",
        title: "Validation Warning",
        description: `${unfilledCount} plan(s) have missing values. Please check publisher and required fields for each tag type.`,
      });
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "No inventory data to process",
      });
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
      console.log(firebaseSaveStatus);
      
      // Continue with processing even if some Firebase saves failed
      // Convert plans data to CSV format
      const headers = ['planId', 'publisher', 'budgetCap', 'brand_name', 'subcategory', 'tags', 'distributionCount', 'clicksToBeDelivered'];
      const csvData = plans.map(plan => {
        // Create a base record without budgetCap
        const csvRecord: CsvRecord = {
          planId: plan.planId,
          publisher: Array.isArray(plan.publisher) ? plan.publisher.join(';') : plan.publisher,
          brand_name: plan.brand_name,
          subcategory: plan.subcategory,
          tags: plan.tags.join(';'),
          distributionCount: 0,
          clicksToBeDelivered: 0,
          budgetCap: 0
        };
        
        // Add budgetCap only for Paid tag
        if (plan.tags.includes('Paid')) {
          csvRecord.budgetCap = plan.budgetCap !== undefined ? plan.budgetCap : 0;
        } else {
          csvRecord.budgetCap = 0; // Set to 0 for non-Paid tags
        }
        
        // Add distributionCount for Mandatory tag
        if (plan.tags.includes('Mandatory')) {
          csvRecord.distributionCount = plan.distributionCount || 0;
        }
        
        // Add clicksToBeDelivered for FOC tag
        if (plan.tags.includes('FOC')) {
          csvRecord.clicksToBeDelivered = plan.clicksToBeDelivered || 0;
        }
        
        return csvRecord;
      });

      // Convert to CSV string
      const csvString = [
        headers.join(','),
        ...csvData.map(row => headers.map(header => row[header]).join(','))
      ].join('\n');

      // Create a CSV file
      const csvBlob = new Blob([csvString], { type: 'text/csv' });
      const userInputFile = new File([csvBlob], 'user_input.csv', { type: 'text/csv' });

      // Process data using the Flask API
      await apiService.processData(historicalFile, userInputFile);

      // Generate a timestamp-based result file name
      const resultFile = `final_planner_ranking.xlsx`;
      const performanceReport = `overall_performance_report.xlsx`;

      // Set success message including Firebase status
      let successMessage = `Successfully processed ${plans.length} plans.`;
      if (saveStatus.success > 0) {
        successMessage += ` Saved ${saveStatus.success} plans to database.`;
      }
      if (saveStatus.failed > 0) {
        successMessage += ` Failed to save ${saveStatus.failed} plans.`;
      }
      
      setSuccess(successMessage);
      onSubmit(resultFile, performanceReport);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process plans';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Processing Error",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count plans with complete data
  const getCompletePlansCount = () => {
    return plans.filter(plan => {
      // Check if publisher is selected
      if (!plan.publisher || plan.publisher.length === 0) {
        return false;
      }
      
      // Add validation for required fields based on tags
      if (plan.tags.includes('Paid') && plan.budgetCap === undefined) {
        return false;
      }
      
      if (plan.tags.includes('Mandatory') && plan.distributionCount === undefined) {
        return false;
      }
      
      if (plan.tags.includes('FOC') && plan.clicksToBeDelivered === undefined) {
        return false;
      }
      
      return true;
    }).length;
  };

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-5">
        <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-violet-600" strokeWidth={2} />
          Review Data
        </CardTitle>
        <CardDescription className="text-gray-600 mt-1">
          Review and complete the extracted data before generating rankings
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {warning && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
            <BarChart className="h-5 w-5 text-violet-600" />
            Data Summary
          </h3>
          
          {loadingStats ? (
            <div className="flex items-center text-gray-500 gap-2">
              <Loader2 className="animate-spin h-4 w-4" />
              <span>Calculating statistics...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Total Plans</div>
                <div className="text-2xl font-bold text-gray-800">{plans.length}</div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Complete Plans</div>
                <div className="text-2xl font-bold text-violet-700">{getCompletePlansCount()}</div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Completion Rate</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {plans.length > 0 ? Math.round((getCompletePlansCount() / plans.length) * 100) : 0}%
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto">
          <PlanTable plans={plans} onPlanUpdate={handlePlanUpdate} />
        </div>
      </CardContent>
      
      <CardFooter className="bg-gray-50 border-t border-gray-100 px-6 py-5">
        <Button 
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 font-medium text-base"
          onClick={handleProcessData}
          disabled={isSubmitting || !plans || plans.length === 0}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin h-5 w-5" />
              Processing...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span>Process & Generate Rankings</span>
              <ArrowRight className="h-5 w-5" />
            </div>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DataReview;