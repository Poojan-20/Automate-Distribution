import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService, ProcessDataResponse } from '@/utils/apiService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Download, 
  FileSpreadsheet, 
  BarChart3,
  RefreshCcw,
  Loader2,
  FileBarChart2
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ResultsViewProps {
  resultFile: string;
  performanceReport?: string;
  onStartOver: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ resultFile, performanceReport, onStartOver }) => {
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

  const downloadRankingsFile = async () => {
    try {
      // Get the file blob from the API service
      const blob = await apiService.downloadRankingsFile();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `distribution_rankings_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading rankings file:', error);
      setError('Failed to download rankings file. Please try again.');
    }
  };

  const downloadPerformanceReport = async () => {
    if (!performanceReport) return;
    
    try {
      // Get the file blob from the API service
      const blob = await apiService.downloadPerformanceReport();
      
      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `performance_report_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading performance report:', error);
      setError('Failed to download performance report. Please try again.');
    }
  };

  // Helper function to render rank badge
  const renderRankBadge = (rank: number) => {
    let badgeClass = 'rank-badge ';
    
    if (rank === 1) {
      // Green for top rank (best)
      badgeClass += 'rank-1';
    } else if (rank === 2) {
      // Orange/amber for middle ranks
      badgeClass += 'rank-2';
    } else if (rank === 3) {
      // Orange/amber for middle ranks
      badgeClass += 'rank-3';
    } else if (rank <= 10) {
      // Red for lower ranks
      badgeClass += 'rank-top-10';
    } else {
      // Darker red for worst ranks
      badgeClass += 'rank-regular';
    }
    
    return (
      <div className={badgeClass}>
        {rank}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-6 py-5">
          <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" strokeWidth={2} />
            Loading Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-12">
          <div className="mb-6">
            <Loader2 className="animate-spin h-12 w-12 text-violet-600" />
          </div>
          <p className="text-lg font-medium text-gray-700">Preparing your distribution rankings...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
        </CardContent>
      </Card>
    );
  }

  // If no data is available, show a specific message
  if (!rankingData || !rankingData.all_publishers || rankingData.all_publishers.length === 0) {
    return (
      <Card className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5">
          <CardTitle className="text-xl font-semibold text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" strokeWidth={2} />
            No Ranking Data Available
          </CardTitle>
          <CardDescription className="text-amber-700 mt-1">
            We couldn&apos;t find any ranking data for your request
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {error && (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col gap-6 items-center justify-center mt-6">
            <p className="text-gray-600 max-w-md text-center">
              No ranking data has been generated yet. Please process some data first or start over to try again.
            </p>
            <Button 
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 font-medium text-base"
              onClick={onStartOver}
            >
              <RefreshCcw className="mr-2 h-5 w-5" />
              Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-red-50 to-pink-50 px-6 py-5">
          <CardTitle className="text-xl font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" strokeWidth={2} />
            Error Loading Results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 flex flex-col items-center">
          <div className="bg-red-50 rounded-xl p-5 mb-8 w-full max-w-lg border border-red-100">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 font-medium text-base"
            onClick={onStartOver}
          >
            <RefreshCcw className="mr-2 h-5 w-5" />
            Start Over
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Helper function to format numbers
  const formatNumber = (value: number | string | undefined, type: 'CTR' | 'EPC' | 'Revenue' | 'Distribution' | 'ExpectedClicks' | 'BudgetCap' = 'EPC') => {
    if (value === undefined || value === null) return '-';
    
    const num = parseFloat(String(value));
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
        // Round to integer with currency
        return `₹${Math.round(num).toLocaleString()}`;
      case 'Distribution':
        // Round to integer
        return Math.round(num).toLocaleString();
      case 'ExpectedClicks':
        // Round to integer
        return Math.round(num).toLocaleString();
      case 'BudgetCap':
        // Round to integer with currency
        return `₹${Math.round(num).toLocaleString()}`;
      default:
        return num.toFixed(2);
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-5">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-600" strokeWidth={2} />
            Distribution Rankings
          </CardTitle>
          
          <div className="flex gap-2">
            {performanceReport && (
              <Button 
                onClick={downloadPerformanceReport}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <FileBarChart2 className="h-4 w-4" />
                Overall Performance Report
              </Button>
            )}
            
            <Button 
              onClick={downloadRankingsFile}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Rankings
            </Button>
          </div>
        </div>
        <div className="flex flex-col mt-2 space-y-1">
          <div className="flex items-center">
            <FileSpreadsheet className="h-4 w-4 text-gray-500 mr-2" />
            <p className="text-sm text-gray-500">Rankings file: {resultFile}</p>
          </div>
          
          {performanceReport && (
            <div className="flex items-center">
              <FileBarChart2 className="h-4 w-4 text-blue-500 mr-2" />
              <p className="text-sm text-blue-600">Performance report available: {performanceReport}</p>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="p-4">
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-violet-50/70 p-1.5">
              <Tab
                key="all"
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200
                  ${selected 
                    ? 'bg-white text-violet-700 shadow-sm' 
                    : 'text-violet-600 hover:bg-white/60 hover:text-violet-700'
                  }`
                }
              >
                All Rankings
              </Tab>
              
              {publishers.map((publisher) => (
                <Tab
                  key={publisher}
                  className={({ selected }) =>
                    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200
                    ${selected 
                      ? 'bg-white text-violet-700 shadow-sm' 
                      : 'text-violet-600 hover:bg-white/60 hover:text-violet-700'
                    }`
                  }
                >
                  {publisher}
                </Tab>
              ))}
            </Tab.List>
            
            <Tab.Panels className="mt-4">
              <Tab.Panel key="all-panel" className="rounded-xl bg-white p-3">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4 px-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
                    A
                  </span>
                  Overall Rankings
                </h3>
                
                {rankingData?.all_publishers && rankingData.all_publishers.length > 0 ? (
                  <div className="overflow-x-auto modern-table rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Plan ID</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Publisher</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Rank</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Exp. Distribution</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">CTR</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">EPC</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Revenue</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Exp. Clicks</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Budget Cap</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Tags</TableHead>
                          <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Subcategory</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankingData.all_publishers.map((item, idx) => (
                          <TableRow key={`${item.plan_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <TableCell className="font-medium text-violet-900">{item.plan_id}</TableCell>
                            <TableCell>
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                {item.publisher}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                {renderRankBadge(item.final_rank)}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-800">{formatNumber(item.distribution, 'Distribution')}</TableCell>
                            <TableCell className="text-gray-800">{formatNumber(item.CTR, 'CTR')}</TableCell>
                            <TableCell className="text-gray-800">{formatNumber(item.EPC, 'EPC')}</TableCell>
                            <TableCell className="font-medium text-emerald-700">{formatNumber(item.avg_revenue, 'Revenue')}</TableCell>
                            
                            <TableCell className="text-blue-700">{formatNumber(item.expected_clicks, 'ExpectedClicks')}</TableCell>
                            <TableCell className="text-gray-800">{formatNumber(item.budget_cap, 'BudgetCap')}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {item.tags.split(';').map((tag: string) => (
                                  <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-800">{item.subcategory || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-xl">
                    <p className="text-gray-500">No ranking data available</p>
                  </div>
                )}
              </Tab.Panel>
              
              {publishers.map((publisher) => (
                <Tab.Panel key={`${publisher}-panel`} className="rounded-xl bg-white p-3">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4 px-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
                      {publisher.charAt(0)}
                    </span>
                    {publisher} Rankings
                  </h3>
                  
                  {rankingData?.by_publisher && rankingData.by_publisher[publisher] && rankingData.by_publisher[publisher].length > 0 ? (
                    <div className="overflow-x-auto modern-table rounded-xl">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Plan ID</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Publisher</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Rank</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Exp. Distribution</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">CTR</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">EPC</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Revenue</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Exp. Clicks</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Budget Cap</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Tags</TableHead>
                            <TableHead className="font-semibold text-violet-900 bg-violet-50/60">Subcategory</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rankingData.by_publisher[publisher].map((item, idx) => (
                            <TableRow key={`${item.plan_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <TableCell className="font-medium text-violet-900">{item.plan_id}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                  {item.publisher}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  {renderRankBadge(item.final_rank)}
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.distribution, 'Distribution')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.CTR, 'CTR')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.EPC, 'EPC')}</TableCell>
                              <TableCell className="font-medium text-emerald-700">{formatNumber(item.avg_revenue, 'Revenue')}</TableCell>
                              <TableCell className="text-blue-700">{formatNumber(item.expected_clicks, 'ExpectedClicks')}</TableCell>
                              <TableCell className="text-gray-800">{formatNumber(item.budget_cap, 'BudgetCap')}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.tags.split(';').map((tag: string) => (
                                    <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-md text-xs">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-gray-800">{item.subcategory || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-xl">
                      <p className="text-gray-500">No ranking data available for {publisher}</p>
                    </div>
                  )}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab.Group>
        </div>
        
        <div className="flex justify-center p-6 bg-gray-50 border-t border-gray-100">
          <Button 
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 font-medium text-base"
            onClick={onStartOver}
          >
            <RefreshCcw className="mr-2 h-5 w-5" />
            Start Over
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultsView;