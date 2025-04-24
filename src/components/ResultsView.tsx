"use client"

import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService, ProcessDataResponse } from '@/utils/apiService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  Download, 
  FileSpreadsheet, 
  BarChart3,
  LineChart as LineChartIcon,
  RefreshCcw,
  Loader2,
  FileBarChart2,
  TrendingUp
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Dot,Label, Pie, PieChart, } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ResultsViewProps {
  resultFile: string;
  performanceReport?: string;
  onStartOver: () => void;
}

interface MetricsChartData {
  planId: string;
  epc: number;
  ctr: number;
  publisher: string;
}

interface PerformanceData {
  publisher: string;
  plan_id: string;
  CTR: number;
  avg_revenue: number;
  clicks: number;
  distribution: number;
}

const ResultsView: React.FC<ResultsViewProps> = ({ resultFile, performanceReport, onStartOver }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankingData, setRankingData] = useState<ProcessDataResponse | null>(null);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [chartData, setChartData] = useState<MetricsChartData[]>([]);
  const [publisherMetrics, setPublisherMetrics] = useState<{[key: string]: {epc: number, ctr: number}}>({});
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

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

        // Prepare data for the line chart - plan specific data
        if (data.all_publishers && data.all_publishers.length > 0) {
          const chartMetrics: MetricsChartData[] = data.all_publishers.map(item => ({
            planId: item.plan_id,
            epc: parseFloat(String(item.EPC)) || 0,
            ctr: parseFloat(String(item.CTR)) || 0,
            publisher: item.publisher
          }));
          
          // Sort by EPC value in descending order
          chartMetrics.sort((a, b) => b.epc - a.epc);
          
          // Only take top 10 plans for better visualization
          setChartData(chartMetrics.slice(0, 10));
          
          // Calculate publisher-wise averages
          const pubMetrics: {[key: string]: {epc: number, ctr: number, count: number}} = {};
          
          chartMetrics.forEach(item => {
            if (!pubMetrics[item.publisher]) {
              pubMetrics[item.publisher] = { epc: 0, ctr: 0, count: 0 };
            }
            pubMetrics[item.publisher].epc += item.epc;
            pubMetrics[item.publisher].ctr += item.ctr;
            pubMetrics[item.publisher].count += 1;
          });
          
          // Calculate averages
          const aggregatedMetrics: {[key: string]: {epc: number, ctr: number}} = {};
          Object.entries(pubMetrics).forEach(([pub, data]) => {
            aggregatedMetrics[pub] = {
              epc: data.count > 0 ? data.epc / data.count : 0,
              ctr: data.count > 0 ? data.ctr / data.count : 0
            };
          });
          
          setPublisherMetrics(aggregatedMetrics);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ranking data');
        console.error('Error loading ranking data:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchPerformanceData = async () => {
      // Only fetch performance data if we have a performance report
      if (!performanceReport) return;
      
      try {
        setLoadingPerformance(true);
        setPerformanceError(null);
        
        // Fetch the performance data
        const data = await apiService.getPerformanceData();
        console.log("Performance data received:", data);
        
        if (data && data.length > 0) {
          setPerformanceData(data);
        } else {
          setPerformanceError("No performance data available");
        }
      } catch (err) {
        setPerformanceError(err instanceof Error ? err.message : 'Failed to load performance data');
        console.error('Error loading performance data:', err);
      } finally {
        setLoadingPerformance(false);
      }
    };

    // Fetch both datasets
    fetchRankingData();
    fetchPerformanceData();
  }, [resultFile, performanceReport]);

  
    

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

  // Define chart colors for publishers
  const publisherColors = {
    Jiocinema: "#4f46e5", // Indigo
    Jioengage: "#06b6d4", // Cyan
    MyJio: "#10b981",     // Emerald
    JioCoupons: "#f59e0b", // Amber
    Default1: "#8b5cf6",  // Violet
  };

  // Create chart config for EPC and CTR
  const epcChartConfig: ChartConfig = {
    epc: {
      label: "EPC",
      color: "#06b6d4", // Cyan
    }
  };
  
  const ctrChartConfig: ChartConfig = {
    ctr: {
      label: "CTR",
      color: "#8b5cf6", // Violet
    }
  };
  
  // Add publisher-specific configs - simplified with hardcoded colors
  publishers.forEach((publisher, index) => {
    // Define a set of hardcoded colors to use
    const colorPalette = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6"];
    
    epcChartConfig[publisher] = {
      label: publisher,
      color: publisherColors[publisher as keyof typeof publisherColors] || 
             colorPalette[index % colorPalette.length]
    };
    
    ctrChartConfig[publisher] = {
      label: publisher,
      color: publisherColors[publisher as keyof typeof publisherColors] || 
             colorPalette[index % colorPalette.length]
    };
  });

  // Create data for publisher charts
  const getPublisherChartData = () => {
    console.log(chartData)
    return publishers.map(pub => {
      // Define a set of hardcoded colors to use
      const colorPalette = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6"];
      
      return {
        publisher: pub,
        epc: publisherMetrics[pub]?.epc || 0,
        ctr: publisherMetrics[pub]?.ctr || 0,
        fill: publisherColors[pub as keyof typeof publisherColors] || 
              colorPalette[publishers.indexOf(pub) % colorPalette.length]
      };
    });
  };

  // Prepare data for the pie charts based on performance metrics
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'clicks' | 'distribution'>('revenue');
  
  // Calculate total values for each metric from performance data
  const getTotalValue = (metric: 'revenue' | 'clicks' | 'distribution') => {
    if (!performanceData || performanceData.length === 0) return 0;
    
    return performanceData.reduce((sum, item) => {
      const value = metric === 'revenue' ? item.avg_revenue :
                   metric === 'clicks' ? item.clicks : 
                   item.distribution;
      return sum + value;
    }, 0);
  };
  
  // Prepare pie chart data based on selected metric from performance data
  const getPieChartData = () => {
    if (!performanceData || performanceData.length === 0) return [];
    
    // Group by publisher
    const publisherData: {[key: string]: number} = {};
    
    // Calculate total for each publisher
    performanceData.forEach(item => {
      const publisher = item.publisher;
      const value = selectedMetric === 'revenue' ? item.avg_revenue :
                   selectedMetric === 'clicks' ? item.clicks : 
                   item.distribution;
      
      if (!publisherData[publisher]) {
        publisherData[publisher] = 0;
      }
      publisherData[publisher] += value;
    });
    
    // Convert to array format for pie chart
    const result = Object.entries(publisherData)
      .filter(([, value]) => value > 0) // Filter out zero values
      .map(([publisher, value], index) => {
        // Define a set of hardcoded colors to use
        const colorPalette = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e"];
        
        return {
          publisher,
          value,
          fill: publisherColors[publisher as keyof typeof publisherColors] || 
                colorPalette[index % colorPalette.length]
        };
      });
    
    // Sort by value in descending order
    return result.sort((a, b) => b.value - a.value);
  };
  
  // Create config for the pie chart
  const pieChartConfig: ChartConfig = {
    value: {
      label: "Value",
      color: "#4f46e5" // Indigo
    }
  };
  
  // Add publisher-specific configs to pie chart
  publishers.forEach((publisher, index) => {
    // Define a set of hardcoded colors to use
    const colorPalette = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e"];
    
    pieChartConfig[publisher] = {
      label: publisher,
      color: publisherColors[publisher as keyof typeof publisherColors] || 
             colorPalette[index % colorPalette.length]
    };
  });
  
  // Format function for the pie chart values
  const formatPieChartValue = (value: number, metric: 'revenue' | 'clicks' | 'distribution') => {
    if (metric === 'revenue') {
      return `₹${Math.round(value).toLocaleString()}`;
    } else {
      return Math.round(value).toLocaleString();
    }
  };

  // Define metric titles and subtitles
  const metricTitles = {
    revenue: 'Revenue Distribution',
    clicks: 'Expected Clicks Distribution',
    distribution: 'Planned Distribution Count'
  };
  
  const metricSubtitles = {
    revenue: 'Share of revenue by publisher',
    clicks: 'Expected clicks by publisher',
    distribution: 'Distribution count by publisher'
  };

  // Render charts - both line charts and pie chart
  const renderPublisherCharts = () => {
    if (publishers.length === 0) return null;
    
    const publisherData = getPublisherChartData();
    const pieData = getPieChartData();
    const totalValue = getTotalValue(selectedMetric);
    
    const metricTitle = metricTitles[selectedMetric];
    const metricSubtitle = metricSubtitles[selectedMetric];
    
    // Determine if we should show the performance chart
    const showPerformanceChart = performanceReport !== undefined;
    
    return (
      <div className="flex flex-col gap-6 mt-8">
        <div className="flex gap-6">
          {/* EPC Chart Card */}
          <Card className="bg-white rounded-xl shadow-lg w-full min-h-[300px] border border-gray-100 overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5">
              <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-blue-600" strokeWidth={2} />
                Publisher EPC Performance
              </CardTitle>
              <CardDescription className="text-gray-600 mt-1">
                Average Earnings Per Click by Publisher
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ChartContainer config={epcChartConfig}>
                  <LineChart
                    accessibilityLayer
                    data={publisherData}
                    margin={{ top: 24, right: 24, left: 24, bottom: 24 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#211f1f" />
                    <XAxis 
                      dataKey="publisher"
                      tick={{ fontSize: 12, fill: '#0d0c0c' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => value.toFixed(2)}
                      tick={{ fontSize: 12, fill: '#0d0c0c' }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          className='text-black'
                          labelFormatter={(label) => `Publisher: ${label}`}
                        />
                      }
                    />
                    <Line
                      dataKey="epc"
                      type="monotone"
                      stroke="#06b6d4" // Hardcoded Cyan color
                      strokeWidth={2}
                      dot={({ payload, ...props }) => {
                        return (
                          <Dot
                            key={payload.publisher}
                            r={5}
                            cx={props.cx}
                            cy={props.cy}
                            fill={payload.fill}
                            stroke={payload.fill}
                          />
                          
                        )
                      }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
            
            <CardFooter className="flex-col items-start gap-2 text-sm bg-gray-50 p-4 border-t border-gray-100">
              <div className="flex gap-2 font-medium leading-none mt-4">
                {Math.max(...Object.values(publisherMetrics).map(m => m.epc)) > 0 ? (
                  <span className="flex items-center text-emerald-600">
                    Best performing: {Object.entries(publisherMetrics)
                      .sort((a, b) => b[1].epc - a[1].epc)[0][0]} 
                    <TrendingUp className="h-4 w-4 ml-1" />
                  </span>
                ) : (
                  <span>No EPC data available</span>
                )}
              </div>
              <div className="leading-none text-muted-foreground">
                Higher EPC indicates better monetization efficiency
              </div>
            </CardFooter>
          </Card>
          
          {/* CTR Chart Card */}
          <Card className="bg-white rounded-xl shadow-lg w-full min-h-[300px] border border-gray-100 overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-5">
              <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-purple-600" strokeWidth={2} />
                Publisher CTR Performance
              </CardTitle>
              <CardDescription className="text-gray-600 mt-1">
                Average Click-Through Rate by Publisher
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ChartContainer config={ctrChartConfig}>
                  <LineChart
                    accessibilityLayer
                    data={publisherData}
                    margin={{ top: 24, right: 24, left: 24, bottom: 24 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#211f1f" />
                    <XAxis 
                      dataKey="publisher"
                      tick={{ fontSize: 12, fill: '#0d0c0c' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value.toFixed(2)}%`}
                      tick={{ fontSize: 12, fill: '#0d0c0c' }}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          className='text-black'
                          labelFormatter={(label) => `Publisher: ${label}`}
                        />
                      }
                    />
                    <Line
                      dataKey="ctr"
                      type="monotone"
                      stroke="#8b5cf6" // Hardcoded Violet color
                      strokeWidth={2}
                      dot={({ payload, ...props }) => {
                        return (
                          <Dot
                            key={payload.publisher}
                            r={5}
                            cx={props.cx}
                            cy={props.cy}
                            fill={payload.fill}
                            stroke={payload.fill}
                          />
                        )
                      }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
            
            <CardFooter className="flex-col items-start gap-2 text-sm bg-gray-50 p-4 border-t border-gray-100">
              <div className="flex gap-2 font-medium leading-none mt-4">
                {Math.max(...Object.values(publisherMetrics).map(m => m.ctr)) > 0 ? (
                  <span className="flex items-center text-purple-600">
                    Best performing: {Object.entries(publisherMetrics)
                      .sort((a, b) => b[1].ctr - a[1].ctr)[0][0]} 
                    <TrendingUp className="h-4 w-4 ml-1" />
                  </span>
                ) : (
                  <span>No CTR data available</span>
                )}
              </div>
              <div className="leading-none text-muted-foreground">
                Higher CTR indicates better user engagement
              </div>
            </CardFooter>
          </Card>
        </div>
        
        {/* Only show performance chart if a performance report is available */}
        {showPerformanceChart && (
          <Card className="bg-white rounded-xl shadow-lg w-full min-h-[400px] border border-gray-100 overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-5">
              <div className="flex justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FileBarChart2 className="h-5 w-5 text-amber-600" strokeWidth={2} />
                    {metricTitle} - Performance Report
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-1">
                    {metricSubtitle} from performance data
                  </CardDescription>
                </div>
                <div className="w-48">
                  <Select
                    value={selectedMetric}
                    onValueChange={(value) => setSelectedMetric(value as 'revenue' | 'clicks' | 'distribution')}
                  >
                    <SelectTrigger className="w-full bg-white border border-gray-200 text-black">
                      <SelectValue placeholder="Select metric" className="text-black" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black">
                      <SelectItem value="revenue" className="text-black">Revenue</SelectItem>
                      <SelectItem value="clicks" className="text-black">Clicks</SelectItem>
                      <SelectItem value="distribution" className="text-black">Distribution Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="py-6 px-4 flex justify-center">
              <div className="h-[350px] w-full max-w-[700px]">
                {loadingPerformance ? (
                  <div className="flex items-center justify-center h-full w-full flex-col">
                    <Loader2 className="h-12 w-12 text-amber-600 animate-spin mb-4" />
                    <p className="text-black text-lg font-medium">Loading performance data...</p>
                  </div>
                ) : performanceError ? (
                  <div className="flex items-center justify-center h-full w-full flex-col">
                    <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                    <p className="text-black text-lg font-medium">Error loading performance data</p>
                    <p className="text-black text-sm">{performanceError}</p>
                  </div>
                ) : pieData.length > 0 ? (
                  <ChartContainer config={pieChartConfig} className="mx-auto performance-pie-chart">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            className='text-black'
                            labelFormatter={(label) => `Publisher: ${label}`}
                          />
                        }
                      />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="publisher"
                        cx="50%"
                        cy="50%"
                        outerRadius={140}
                        innerRadius={70}
                        paddingAngle={2}
                        strokeWidth={2}
                        stroke="#fff"
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="text-black"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-black text-2xl font-bold"
                                  >
                                    {formatPieChartValue(totalValue, selectedMetric)}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy as number) + 24}
                                    className="fill-black text-sm"
                                  >
                                    Total {selectedMetric}
                                  </tspan>
                                </text>
                              );
                            }
                            return null;
                          }}
                        />
                      </Pie>
                      <ChartLegend
                        content={<ChartLegendContent nameKey="publisher" className="!text-gray-800 text-sm" />}
                        verticalAlign="bottom"
                      />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full w-full flex-col">
                    <FileBarChart2 className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-black text-lg font-medium">No performance data available</p>
                    <p className="text-black text-sm">No {selectedMetric} data found in the performance report</p>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="flex-col items-start gap-2 text-sm bg-gray-50 p-4 border-t border-gray-100">
              <div className="flex justify-between w-full">
                <div className="flex gap-2 font-medium leading-none">
                  {pieData.length > 0 ? (
                    <span className="flex items-center text-amber-600">
                      Highest share: {pieData[0]?.publisher || 'None'}
                      <TrendingUp className="h-4 w-4 ml-1" />
                    </span>
                  ) : (
                    <span>No data available</span>
                  )}
                </div>
                <div className="leading-none text-black">
                  {`Data from performance report: ${performanceData.length} records`}
                </div>
              </div>
            </CardFooter>
          </Card>
        )}
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
    <>
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
    {!loading && !error && rankingData && renderPublisherCharts()}
    </>
  );
};

export default ResultsView;