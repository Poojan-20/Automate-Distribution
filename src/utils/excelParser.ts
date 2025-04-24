import * as XLSX from 'xlsx';
import { getLatestPlanData } from './firebaseOperations';

export const PREDEFINED_PUBLISHERS = ["JioCinema", "JioEngage", "MyJio","JioCoupons","JioFinance","Poslite"] as const;
export const PREDEFINED_TAGS = ["Paid", "Mandatory", "FOC"] as const;

export type Publisher = typeof PREDEFINED_PUBLISHERS[number];
export type Tag = typeof PREDEFINED_TAGS[number];

export interface Plan {
  planId: string;
  domain?: string;
  brand_name: string;
  subcategory: string;
  geo?: string;
  publisher: Publisher | Publisher[];
  tags: Tag[];
  inventory?: number;
  unit_price?: number;
  budgetCap?: number;
  distributionCount?: number;
  clicksToBeDelivered?: number;
  expected_clicks?: number;
  avgRevenue?: number;
  isEdited?: boolean;
}

export interface HistoricalData {
  planId: string;
  publisher: string;
  date: Date;
  revenue: number;
  distribution_count: number;
  clicks: number;
}

// Excel row type definition
interface ExcelRow {
  [key: string]: string | number | null | undefined;
}

export const parseInventoryReport = async (data: ArrayBuffer): Promise<Plan[]> => {
  console.log('Starting parseInventoryReport with data buffer size:', data.byteLength);
  const workbook = XLSX.read(data, { type: 'array' });
  console.log('Workbook sheets:', workbook.SheetNames);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

  // Add debug logging
  console.log('Raw Excel Data:', jsonData);

  // Process each row and check Firebase for existing data
  const processedData = await Promise.all(jsonData.map(async (row) => {
    const planId = String(row['planId'] || row['Plan ID'] || row['plan_id'] || row['PlanId'] || '');
    console.log('Processing plan:', { planId, rawRow: row });
    
    // Try to get existing data from Firebase
    const existingPlan = await getLatestPlanData(planId);
    if (existingPlan) {
      console.log('Found existing plan data:', existingPlan);
      return {
        ...existingPlan,
        isEdited: false
      };
    }

    // Parse budget cap - allow zero values
    const budgetCap = row['budgetCap'] || row['Budget Cap'] || row['budget_cap'];
    const parsedBudgetCap = budgetCap !== undefined ? parseFloat(String(budgetCap)) : 0;
    console.log('Parsed budget cap:', { original: budgetCap, parsed: parsedBudgetCap });

    // If no existing data, create new plan
    return {
      planId,
      subcategory: String(row['subcategory'] || row['Subcategory'] || row['SubCategory'] || row['sub_category'] || ''),
      brand_name: String(row['brand_name'] || row['Brand Name'] || row['BrandName'] || row['brand'] || ''),
      budgetCap: parsedBudgetCap,
      tags: [] as Tag[],
      publisher: [] as Publisher[],
      distributionCount: 0,
      clicksToBeDelivered: 0,
      isEdited: false
    } as Plan;
  }));

  return processedData;
};

export const parseHistoricalData = (data: ArrayBuffer): HistoricalData[] => {
  console.log('Starting parseHistoricalData');
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
  
  if (jsonData.length > 0) {
    // Print first row for debugging
    console.log('First row of historical data:', JSON.stringify(jsonData[0]));
  }

  // Extract relevant fields from historical data
  const processedData = jsonData.map((row) => {
    // Parse date - try multiple potential date field names and formats
    let dateObj: Date = new Date(); // Default to current date
    try {
      const dateValue = row['Date'] || row['KPI_date'] || row['date'] || row['DATE'] || row['Day'] || row['KPI date'];
      
      if (dateValue !== undefined && dateValue !== null) {
        if (typeof dateValue === 'number') {
          // Excel numeric date (days since 1900)
          dateObj = XLSX.SSF.parse_date_code(dateValue);
        } else if (typeof dateValue === 'string') {
          // Handle format like "Apr 14, 2025"
          if (/^[A-Za-z]{3}\s\d{1,2},\s\d{4}$/.test(dateValue)) {
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
              dateObj = parsedDate;
            } else {
              // Fallback for browsers that might not parse this format correctly
              const parts = dateValue.match(/^([A-Za-z]{3})\s(\d{1,2}),\s(\d{4})$/);
              if (parts) {
                const months: {[key: string]: number} = {
                  'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                  'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                };
                const month = months[parts[1]];
                const day = parseInt(parts[2], 10);
                const year = parseInt(parts[3], 10);
                
                if (month !== undefined && !isNaN(day) && !isNaN(year)) {
                  dateObj = new Date(year, month, day);
                }
              }
            }
          } else {
            // Try to parse other string date formats
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            dateObj = parsedDate;
            }
          }
        } 
        // If dateValue is potentially a date object, try to use it (after validating)
        else if (dateValue && typeof dateValue === 'object' && 'getTime' in dateValue) {
          const time = (dateValue as Date).getTime();
          if (!isNaN(time)) {
            dateObj = new Date(time);
          }
        }
      }
      
      // Log the parsed date for debugging
      console.log(`Parsed date: ${dateValue} -> ${dateObj.toISOString()}`);
    } catch (e) {
      console.warn('Error parsing date:', e);
      // Keep the default date (current date)
    }

    // Parse clicks
    let clicks = 0;
    try {
      const clicksValue = row['Clicks'] || row['clicks'] || row['Total_Clicks'] || row['click_count'] || row['Click_Count'] || row['CLICKS'] || 0;
      clicks = typeof clicksValue === 'string' ? parseFloat(clicksValue.replace(/,/g, '')) : parseFloat(String(clicksValue)) || 0;
      clicks = isNaN(clicks) ? 0 : Math.round(clicks); // Round clicks to integers
    } catch {
      clicks = 0;
    }

    // Parse distribution count
    let distribution_count = 0;
    try {
      const distribution_countValue = row['Distribution_Count'] || row['distribution_count'] || row['Total_Distribution_Count'] || row['distribution_count'] || row['Distribution Count'] || row['DISTRIBUTION_COUNT'] || row['Distribution_count'] || row['Distribuion_count'] || row['Distribution'] || 0;
      distribution_count = typeof distribution_countValue === 'string' ? parseFloat(distribution_countValue.replace(/,/g, '')) : parseFloat(String(distribution_countValue)) || 0;
      distribution_count = isNaN(distribution_count) ? 0 : Math.round(distribution_count); // Round distribution to integers
    } catch {
      distribution_count = 0;
    }
    
    // Parse revenue - check multiple field names including a "Revenue" field that might have the date in it
    let revenue = 0;
    try {
      // First check standard revenue field names
      let revenueValue = row['Revenue'] || row['revenue'] || row['Total_Revenue'] || 
        row['REVENUE'] || row['Total Revenue'] || row['TotalRevenue'];
      
      // If not found, look for date-specific revenue fields like "Revenue_2023-01-01"
      if (revenueValue === undefined || revenueValue === null) {
        // Check for keys that contain "Revenue" and a date pattern
        const revenueKeys = Object.keys(row).filter(key => 
          key.toLowerCase().includes('revenue') || 
          key.toLowerCase().includes('earnings') || 
          key.toLowerCase().includes('income')
        );
        
        if (revenueKeys.length > 0) {
          // If multiple revenue fields are found, pick the first one
          revenueValue = row[revenueKeys[0]];
          console.log(`Found revenue in field: ${revenueKeys[0]} with value: ${revenueValue}`);
        }
      }
      
      revenue = typeof revenueValue === 'string' ? 
        parseFloat(revenueValue.toString().replace(/,/g, '')) : 
        parseFloat(String(revenueValue)) || 0;
      
      revenue = isNaN(revenue) ? 0 : Math.round(revenue); // Round revenue to integers
    } catch {
      revenue = 0;
    }

    // Get plan ID, trying various potential field names
    const planId = String(
      row['Plan ID'] || row['plan_id'] || row['PlanId'] || row['PLAN_ID'] || 
      row['planid'] || row['planId'] || row['Plan Id'] || ''
    );

    // Get publisher, trying various potential field names
    const publisher = String(
      row['Publisher'] || row['publisher'] || row['dist_business'] || 
      row['PUBLISHER'] || row['pub'] || row['Pub'] || ''
    );

    // Create the processed row
    return {
      planId,
      publisher,
      date: dateObj,
      revenue,
      distribution_count,
      clicks
    } as HistoricalData;
  });

  // Log a sample record
  if (processedData.length > 0) {
    console.log('Sample processed record:', JSON.stringify(processedData[0]));
  }
  
  return processedData;
}; 