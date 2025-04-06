import * as XLSX from 'xlsx';

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

export const parseInventoryReport = (data: ArrayBuffer): Plan[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);

  // Add debug logging
  console.log('Raw Excel Data:', jsonData);

  // Extract planId and subcategory, checking for different possible column names
  return jsonData.map((row: any) => ({
    planId: row['planId'] || row['Plan ID'] || row['plan_id'] || row['PlanId'] || '',
    subcategory: row['subcategory'] || row['Subcategory'] || row['SubCategory'] || '',
    budgetCap: 0,
    tags: [],
    publisher: [],
    isEdited: false
  }));
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