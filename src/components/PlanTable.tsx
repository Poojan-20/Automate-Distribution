import React, { useState } from 'react';
import { Plan, PREDEFINED_PUBLISHERS, PREDEFINED_TAGS } from '@/utils/excelParser';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { X, Search, Check, ListFilter, Tag, BarChart, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface PlanTableProps {
  plans: Plan[];
  onPlanUpdate: (updatedPlan: Plan) => void;
}

const PlanTable: React.FC<PlanTableProps> = ({ plans, onPlanUpdate }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { toast } = useToast();

  if (!plans || plans.length === 0) {
    return (
      <div className="p-8 text-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
        <div className="flex flex-col items-center justify-center">
          <ListFilter className="h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No Plan Data Available</h3>
          <p className="text-gray-500">Please upload inventory file to see plan data here.</p>
        </div>
      </div>
    );
  }

  // Handler for updating budget cap
  const handleBudgetChange = (index: number, value: string) => {
    // Only update budget cap if Paid tag is selected
    if (!plans[index].tags.includes('Paid')) {
      toast({
        variant: "warning",
        title: "Budget Update Not Allowed",
        description: "Budget cap can only be set for plans with the 'Paid' tag.",
      });
      return;
    }
    
    // Use parseFloat but handle empty string as 0
    // This is important for allowing users to clear the field and set to 0
    const numericValue = value === '' ? 0 : parseFloat(value);
    // Don't use || 0 as it will convert NaN to 0, which is not what we want
    const budgetCap = isNaN(numericValue) ? 0 : numericValue;
    
    const updatedPlan = { ...plans[index], budgetCap, isEdited: true };
    onPlanUpdate(updatedPlan);

    // We don't need a success toast for budget updates
  };

  const filteredPlans = plans.filter(plan => {
    const planIdMatch = plan.planId.toLowerCase().includes(searchQuery.toLowerCase());
    const subcategoryMatch = plan.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
    const brandNameMatch = plan.brand_name.toLowerCase().includes(searchQuery.toLowerCase());
    return planIdMatch || subcategoryMatch || brandNameMatch;
  });

  // Handler for updating publisher
  const handlePublisherChange = (index: number, publisher: typeof PREDEFINED_PUBLISHERS[number]) => {
    const currentPublishers = Array.isArray(plans[index].publisher) ? plans[index].publisher : [];
    let updatedPublishers;

    if (currentPublishers.includes(publisher)) {
      updatedPublishers = currentPublishers.filter(p => p !== publisher);
    } else {
      updatedPublishers = [...currentPublishers, publisher];
    }

    const updatedPlan = {
      ...plans[index],
      publisher: updatedPublishers,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  // Handler for selecting a single tag
  const handleTagSelect = (index: number, tag: typeof PREDEFINED_TAGS[number]) => {
    // If tag is already selected, do nothing (keep it selected)
    if (plans[index].tags.includes(tag) && plans[index].tags.length === 1) {
      toast({
        variant: "warning",
        title: "Tag Selection",
        description: "At least one tag must be selected.",
      });
      return;
    }

    // Otherwise set only the selected tag
    const updatedPlan = {
      ...plans[index],
      tags: [tag],
      isEdited: true
    };
    
    // Reset budget cap if switching to FOC or Mandatory
    if ((tag === 'FOC' || tag === 'Mandatory') && plans[index].tags.includes('Paid')) {
      updatedPlan.budgetCap = undefined;
      toast({
        title: "Budget Cap Reset",
        description: `Budget cap has been reset as the plan was changed to ${tag} type.`,
      });
    }
    
    // Update input fields based on tag
    if (tag === 'FOC') {
      // Ensure clicks to be delivered is initialized
      if (updatedPlan.clicksToBeDelivered === undefined) {
        updatedPlan.clicksToBeDelivered = 0;
      }
      // No need for toast here
    } else if (tag === 'Mandatory') {
      // Ensure distribution count is initialized
      if (updatedPlan.distributionCount === undefined) {
        updatedPlan.distributionCount = 0;
      }
      // No need for toast here
    } else if (tag === 'Paid') {
      // Always ensure budget cap has a value when Paid tag is selected
      updatedPlan.budgetCap = updatedPlan.budgetCap !== undefined ? updatedPlan.budgetCap : 0;
      // No need for toast here
    }
    
    onPlanUpdate(updatedPlan);
  };

  // Add handlers for the new numeric fields
  const handleDistributionCountChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    const updatedPlan = {
      ...plans[index],
      distributionCount: numericValue,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  const handleClicksToBeDeliveredChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    const updatedPlan = {
      ...plans[index],
      clicksToBeDelivered: numericValue,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  // Add handlers for select all
  const handleSelectAllPublishers = (index: number) => {
    const updatedPlan = {
      ...plans[index],
      publisher: [...PREDEFINED_PUBLISHERS],
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
    // Remove toast notification for select all
  };

  const handleClearAllPublishers = (index: number) => {
    const updatedPlan = {
      ...plans[index],
      publisher: [],
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
    // Remove toast notification for clear all
  };

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white w-full shadow-sm">
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        {/* Search Bar */}
        <div className="flex flex-col">
          <label className="text-gray-700 font-medium text-sm mb-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            Search Plans
          </label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by Plan ID, Brand Name or Subcategory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 pl-10 pr-4 rounded-lg bg-white text-gray-800 border border-gray-200 focus:border-violet-300 focus:ring focus:ring-violet-200 focus:ring-opacity-50"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {filteredPlans.length} plan{filteredPlans.length !== 1 ? 's' : ''} found
            </span>
            {searchQuery && (
              <span className="text-xs text-violet-600 font-medium">
                Filtering by: &quot;{searchQuery}&quot;
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                Plan ID
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                Publisher
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <IndianRupee className="h-3.5 w-3.5" />
                  Budget Cap
                </div>
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <BarChart className="h-3.5 w-3.5" />
                  Avg Revenue
                </div>
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                Brand Name
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                Subcategory
              </TableHead>
              <TableHead className="bg-violet-50/60 text-violet-900 font-semibold whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Tags & Requirements
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredPlans.map((plan, index) => (
              <TableRow
                key={plan.planId || index}
                className="group hover:bg-violet-50/30 transition-colors"
              >
                <TableCell className="font-medium text-violet-900 whitespace-nowrap">
                  {plan.planId}
                </TableCell>

                <TableCell className="min-w-[220px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 mb-2">
                      <Button
                        onClick={() => handleSelectAllPublishers(index)}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 py-0 bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 hover:text-violet-800 hover:border-violet-300"
                      >
                        <Check className="h-3 w-3 mr-1" /> Select All
                      </Button>
                      <Button
                        onClick={() => handleClearAllPublishers(index)}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 py-0 bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      >
                        <X className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {PREDEFINED_PUBLISHERS.map((pub) => {
                        const isSelected = Array.isArray(plan.publisher) && plan.publisher.includes(pub);
                        return (
                          <button
                            key={pub}
                            onClick={() => handlePublisherChange(index, pub)}
                            className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                            ${isSelected
                                ? 'bg-blue-100 text-gray-700 hover:bg-violet-200 shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {pub}
                            {isSelected && (
                              <X size={14} className="ml-1.5 opacity-70" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="min-w-[130px]">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <IndianRupee className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                      type="number"
                      min="0"
                      value={plan.budgetCap || ''}
                      onChange={(e) => handleBudgetChange(index, e.target.value)}
                      placeholder="0"
                      disabled={plan.tags.includes('FOC') || plan.tags.includes('Mandatory')}
                      onWheel={(e) => e.currentTarget.blur()}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                        }
                      }}
                      className={`pl-9 py-1.5 h-9 bg-white text-gray-800 border-gray-200 focus:border-violet-300 focus:ring focus:ring-violet-200 focus:ring-opacity-50 ${
                        plan.tags.includes('FOC') || plan.tags.includes('Mandatory') ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                  </div>
                </TableCell>

                <TableCell className="min-w-[100px] font-medium text-emerald-700">
                  {plan.avgRevenue ? `₹${plan.avgRevenue.toLocaleString()}` : '₹0'}
                </TableCell>

                <TableCell className="text-gray-800 whitespace-nowrap">
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">
                    {plan.brand_name}
                  </span>
                </TableCell>

                <TableCell className="text-gray-800 whitespace-nowrap">
                  <span className="px-2.5 py-1 bg-sky-50 text-sky-700 rounded-md text-xs font-medium">
                    {plan.subcategory}
                  </span>
                </TableCell>

                <TableCell className="min-w-[320px]">
                  <div className="flex justify-between">
                    {/* Left side: Tags area */}
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_TAGS.map((tag) => {
                        const isSelected = plan.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => handleTagSelect(index, tag)}
                            className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                              ${isSelected
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {tag}
                            {isSelected && (
                              <X size={14} className="ml-1.5 opacity-70" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right side: Fixed position for input fields */}
                    <div className="w-52 flex flex-col space-y-3">
                      {plan.tags.includes('Mandatory') && (
                        <div className="flex flex-col gap-1 bg-violet-50 p-2 rounded-md">
                          <label className="text-xs text-violet-700 font-medium flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-200 text-violet-700 text-xs font-bold">
                              !
                            </span>
                            Distribution Count
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={plan.distributionCount || ''}
                            onChange={(e) => handleDistributionCountChange(index, e.target.value)}
                            placeholder="Enter count"
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                              }
                            }}
                            className="h-8 bg-white text-gray-800 border-blue-200 focus:border-blue-400 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                        </div>
                      )}

                      {plan.tags.includes('FOC') && (
                        <div className="flex flex-col gap-1 bg-amber-50 p-2 rounded-md">
                          <label className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-200 text-amber-700 text-xs font-bold">
                              !
                            </span>
                            Clicks to Deliver
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={plan.clicksToBeDelivered || ''}
                            onChange={(e) => handleClicksToBeDeliveredChange(index, e.target.value)}
                            placeholder="Enter clicks"
                            onWheel={(e) => e.currentTarget.blur()}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                e.preventDefault();
                              }
                            }}
                            className="h-8 bg-white text-gray-800 border-amber-200 focus:border-amber-400 focus:ring focus:ring-amber-200 focus:ring-opacity-50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PlanTable;