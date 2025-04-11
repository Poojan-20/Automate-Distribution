import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService, ProcessDataResponse } from '@/utils/apiService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface RankingItem {
  plan_id: string;
  publisher: string;
  final_rank: number;
  CTR: number;
  EPC: number;
  avg_revenue: number;
  distribution: number;
  tags: string;
  subcategory: string;
  expected_clicks: number;
  budget_cap: number;
}

interface ResultsViewProps {
  resultFile: string;
  onStartOver: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ resultFile, onStartOver }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankingData, setRankingData] = useState<ProcessDataResponse | null>(null);
  const [publishers, setPublishers] = useState<string[]>([]);

  useEffect(() => {
    const fetchRankingData = async () => {
      try {
        setLoading(true);
        // Fetch the ranking data from the server using our apiService
        const data = await apiService.getRankings();
        console.log("Ranking data received:", data);
        
        // Debug output to check the actual structure
        if (data.all_publishers && data.all_publishers.length > 0) {
          console.log("Sample record:", data.all_publishers[0]);
          console.log("Expected clicks value:", data.all_publishers[0].expected_clicks);
          console.log("Budget cap value:", data.all_publishers[0].budget_cap);
        }
        
        setRankingData(data);
        
        // Extract publisher names from the data
        if (data.by_publisher) {
          setPublishers(Object.keys(data.by_publisher));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ranking data');
        console.error('Error loading ranking data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRankingData();
  }, [resultFile]);

  const downloadFile = () => {
    // Use the API service to get the download URL
    const downloadUrl = apiService.getDownloadUrl();
    window.open(downloadUrl, '_blank');
  };


  if (loading) {
    return (
      <Card className="bg-white rounded-lg shadow-lg p-8 text-center">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Loading Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center my-6">
            <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no data is available, show a specific message with option to load test data
  if (!rankingData || !rankingData.all_publishers || rankingData.all_publishers.length === 0) {
    return (
      <Card className="bg-white rounded-lg shadow-lg p-8 text-center">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-amber-600">No Ranking Data Available</CardTitle>
          <CardDescription className="text-gray-600">
            No ranking data has been generated yet. Please process some data first or generate test data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col gap-4 items-center justify-center mt-6">
           
            <button 
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={onStartOver}
            >
              Start Over
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white rounded-lg shadow-lg p-8 text-center">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-red-600">Error Loading Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-6">{error}</p>
          <button 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={onStartOver}
          >
            Start Over
          </button>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format numbers
  const formatNumber = (value: any, type: 'CTR' | 'EPC' | 'Revenue' | 'Distribution' | 'ExpectedClicks' | 'BudgetCap' = 'EPC') => {
    if (value === undefined || value === null) return '-';
    
    const num = parseFloat(value);
    console.log(`Formatting ${type} value: ${value}, parsed as ${num}`);
    if (isNaN(num)) return '-';
    
    switch (type) {
      case 'CTR':
        // Convert to percentage with 2 decimal places
        return `${(num).toFixed(2)}%`;
      case 'EPC':
        // 2 decimal places
        return num.toFixed(2);
      case 'Revenue':
        // Round to integer
        return Math.round(num).toLocaleString();
      case 'Distribution':
        // Round to integer
        return Math.round(num).toLocaleString();
      case 'ExpectedClicks':
        // Round to integer
        return Math.round(num).toLocaleString();
      case 'BudgetCap':
        // Round to integer
        return Math.round(num).toLocaleString();
      default:
        return num.toFixed(2);
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-lg">
      <CardHeader className="border-b border-gray-100 p-6">
        <CardTitle className="text-xl font-semibold text-gray-800">Distribution Rankings</CardTitle>
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-gray-500">
            Results file: {resultFile}
          </p>
          <button 
            onClick={downloadFile}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            Download Excel File
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 md:p-6">
        <div className="mb-6">
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-blue-50 p-1">
              <Tab
                key="all"
                className={({ selected }: { selected: boolean }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                  ${selected 
                    ? 'bg-white text-blue-700 shadow' 
                    : 'text-blue-500 hover:bg-white/[0.12] hover:text-blue-600'
                  }`
                }
              >
                All Rankings
              </Tab>
              
              {publishers.map((publisher) => (
                <Tab
                  key={publisher}
                  className={({ selected }: { selected: boolean }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 
                    ${selected 
                      ? 'bg-white text-blue-700 shadow' 
                      : 'text-blue-500 hover:bg-white/[0.12] hover:text-blue-600'
                    }`
                  }
                >
                  {publisher}
                </Tab>
              ))}
            </Tab.List>
            
            <Tab.Panels className="mt-4">
              <Tab.Panel key="all-panel" className="rounded-xl bg-white p-3">
                <h3 className="text-lg mb-4 text-gray-800 font-bold">Overall Rankings</h3>
                {rankingData?.all_publishers && rankingData.all_publishers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-black">Plan ID</TableHead>
                          <TableHead className="font-semibold text-black">Publisher</TableHead>
                          <TableHead className="font-semibold text-black">Rank</TableHead>
                          <TableHead className="font-semibold text-black">CTR (%)</TableHead>
                          <TableHead className="font-semibold text-black">EPC</TableHead>
                          <TableHead className="font-semibold text-black">Revenue</TableHead>
                          <TableHead className="font-semibold text-black">Distribution</TableHead>
                          <TableHead className="font-semibold text-black">Expected Clicks</TableHead>
                          <TableHead className="font-semibold text-black">Budget Cap</TableHead>
                          <TableHead className="font-semibold text-black">Tags</TableHead>
                          <TableHead className="font-semibold text-black">Subcategory</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankingData.all_publishers.map((item, idx) => {
                          console.log(`Row ${idx} expected_clicks:`, item.expected_clicks);
                          console.log(`Row ${idx} budget_cap:`, item.budget_cap);
                          return (
                            <TableRow key={`${item.plan_id}-${idx}`} className="hover:bg-gray-50">
                              <TableCell className="font-medium text-gray-800">{item.plan_id}</TableCell>
                              <TableCell className="text-gray-800">{item.publisher}</TableCell>
                              <TableCell className="text-gray-800">{item.final_rank}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.CTR, 'CTR')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.EPC, 'EPC')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.avg_revenue, 'Revenue')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.distribution, 'Distribution')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.expected_clicks, 'ExpectedClicks')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.budget_cap, 'BudgetCap')}</TableCell>
                              <TableCell className="text-gray-800">{item.tags}</TableCell>
                              <TableCell className="text-gray-800">{item.subcategory || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-gray-500">No ranking data available</p>
                )}
              </Tab.Panel>
              
              {publishers.map((publisher) => (
                <Tab.Panel key={`${publisher}-panel`} className="rounded-xl bg-white p-3">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">{publisher} Rankings</h3>
                  {rankingData?.by_publisher && rankingData.by_publisher[publisher] && rankingData.by_publisher[publisher].length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold text-black">Plan ID</TableHead>
                            <TableHead className="font-semibold text-black">Publisher</TableHead>
                            <TableHead className="font-semibold text-black">Rank</TableHead>
                            <TableHead className="font-semibold text-black">CTR (%)</TableHead>
                            <TableHead className="font-semibold text-black">EPC</TableHead>
                            <TableHead className="font-semibold text-black">Revenue</TableHead>
                            <TableHead className="font-semibold text-black">Distribution</TableHead>
                            <TableHead className="font-semibold text-black">Expected Clicks</TableHead>
                            <TableHead className="font-semibold text-black">Budget Cap</TableHead>
                            <TableHead className="font-semibold text-black">Tags</TableHead>
                            <TableHead className="font-semibold text-black">Subcategory</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingData.by_publisher[publisher].map((item, idx) => {
                            console.log(`Publisher ${publisher} Row ${idx} expected_clicks:`, item.expected_clicks);
                            console.log(`Publisher ${publisher} Row ${idx} budget_cap:`, item.budget_cap);
                            return (
                              <TableRow key={`${item.plan_id}-${idx}`} className="hover:bg-gray-50">
                                <TableCell className="font-medium text-gray-800">{item.plan_id}</TableCell>
                                <TableCell className="text-gray-800">{item.publisher}</TableCell>
                                <TableCell className="text-gray-800">{item.final_rank}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.CTR, 'CTR')}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.EPC, 'EPC')}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.avg_revenue, 'Revenue')}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.distribution, 'Distribution')}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.expected_clicks, 'ExpectedClicks')}</TableCell>
                                <TableCell className="text-gray-800">{formatNumber(item.budget_cap, 'BudgetCap')}</TableCell>
                                <TableCell className="text-gray-800">{item.tags}</TableCell>
                                <TableCell className="text-gray-800">{item.subcategory || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No ranking data available for {publisher}</p>
                  )}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab.Group>
        </div>
        
        <div className="flex justify-center mt-6">
          <button 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={onStartOver}
          >
            Start Over
          </button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsView; 