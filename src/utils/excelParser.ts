import * as XLSX from 'xlsx';
import { getLatestPlanData } from './firebaseOperations';

export const PREDEFINED_PUBLISHERS = ["Jiocinema", "Jioengage", "MyJio"] as const;
export const PREDEFINED_TAGS = ["Paid", "Mandatory", "FOC"] as const;

export type Publisher = typeof PREDEFINED_PUBLISHERS[number];
export type Tag = typeof PREDEFINED_TAGS[number];

export interface Plan {
  planId: string;
  budgetCap: number;
  tags: Tag[];
  publisher: Publisher[];
  subcategory: string;
  isEdited?: boolean; // Flag to track if user has edited this plan
  distributionCount?: number; // New field for Mandatory tag
  clicksToBeDelivered?: number; // New field for FOC tag
}

export interface HistoricalData {
  planId: string;
  publisher: string;
  date: Date;
  epc: number;
  ctr: number;
  revenue: number;
  impressions: number;
  clicks: number;
}

export const parseInventoryReport = async (data: ArrayBuffer): Promise<Plan[]> => {
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  // Add debug logging
  console.log('Raw Excel Data:', jsonData);

  // Process each row and check Firebase for existing data
  const processedData = await Promise.all(jsonData.map(async (row: any) => {
    const planId = row['planId'] || row['Plan ID'] || row['plan_id'] || row['PlanId'] || '';
    
    // Try to get existing data from Firebase
    const existingPlan = await getLatestPlanData(planId);
    
    if (existingPlan) {
      // Use existing data from Firebase
      return {
        ...existingPlan,
        isEdited: false
      };
    }

    // If no existing data, create new plan
    return {
      planId,
      subcategory: row['subcategory'] || row['Subcategory'] || row['SubCategory'] || row['sub_category'] || '',
      budgetCap: parseFloat(row['budgetCap'] || row['Budget Cap'] || row['budget_cap'] || 0),
      tags: [],
      publisher: [],
      distributionCount: 0,
      clicksToBeDelivered: 0,
      isEdited: false
    };
  }));

  return processedData;
};

export const parseHistoricalData = (data: ArrayBuffer): HistoricalData[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  // Extract relevant fields from historical data
  return jsonData.map((row: any) => ({
    planId: row['Plan ID'] || row['plan_id'] || '',
    publisher: row['Publisher'] || row['publisher'] || '',
    date: row['Date'] ? new Date(row['Date']) : new Date(),
    revenue: parseFloat(row['Revenue'] || row['revenue'] || 0),
    Distribution: parseInt(row['Distribution_count'] || row['Distributions'] || 0),
    clicks: parseInt(row['Clicks'] || row['clicks'] || 0)
  }));
}; 