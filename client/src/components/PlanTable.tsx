import React , { useState } from 'react';
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
import { X } from "lucide-react";

interface PlanTableProps {
  plans: Plan[];
  onPlanUpdate: (updatedPlan: Plan) => void;
}

const PlanTable: React.FC<PlanTableProps> = ({ plans, onPlanUpdate }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  console.log('PlanTable rendered with plans:', plans?.length);

  if (!plans || plans.length === 0) {
    console.log('No plans available');
    return (
      <div className="p-4 text-center text-black">
        No plan data available. Please upload inventory file.
      </div>
    );
  }

  // Handler for updating budget cap
  const handleBudgetChange = (index: number, value: string) => {
    const numericValue = parseFloat(value) || 0;
    console.log('Budget update:', { index, originalValue: value, parsedValue: numericValue });
    const updatedPlan = { ...plans[index], budgetCap: numericValue, isEdited: true };
    onPlanUpdate(updatedPlan);
  };

  const filteredPlans = plans.filter(plan => {
    const planIdMatch = plan.planId.toLowerCase().includes(searchQuery.toLowerCase());
    const subcategoryMatch = plan.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
    const brandNameMatch = plan.brand_name.toLowerCase().includes(searchQuery.toLowerCase());
    return planIdMatch || subcategoryMatch || brandNameMatch;
  });
  console.log('Filtered plans count:', filteredPlans.length);

  // Handler for updating publisher
  const handlePublisherChange = (index: number, publisher: typeof PREDEFINED_PUBLISHERS[number]) => {
    console.log('Publisher update:', { index, publisher });
    const currentPublishers = Array.isArray(plans[index].publisher) ? plans[index].publisher : [];
    let updatedPublishers;

    if (currentPublishers.includes(publisher)) {
      updatedPublishers = currentPublishers.filter(p => p !== publisher);
    } else {
      updatedPublishers = [...currentPublishers, publisher];
    }

    console.log('Updated publishers:', { 
      planId: plans[index].planId,
      previous: currentPublishers,
      updated: updatedPublishers
    });

    const updatedPlan = {
      ...plans[index],
      publisher: updatedPublishers,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  // Handler for selecting a single tag
  const handleTagSelect = (index: number, tag: typeof PREDEFINED_TAGS[number]) => {
    console.log('Tag selection:', { index, tag, currentTags: plans[index].tags });
    // If tag is already selected, do nothing (keep it selected)
    if (plans[index].tags.includes(tag) && plans[index].tags.length === 1) {
      console.log('Tag already selected and is the only tag');
      return;
    }

    // Otherwise set only the selected tag
    const updatedPlan = {
      ...plans[index],
      tags: [tag],
      isEdited: true
    };
    console.log('Updated plan tags:', { 
      planId: plans[index].planId,
      previousTags: plans[index].tags,
      newTags: updatedPlan.tags
    });
    onPlanUpdate(updatedPlan);
  };

  // Add handlers for the new numeric fields
  const handleDistributionCountChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    console.log('Distribution count update:', { 
      index, 
      originalValue: value, 
      parsedValue: numericValue 
    });
    const updatedPlan = {
      ...plans[index],
      distributionCount: numericValue,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  const handleClicksToBeDeliveredChange = (index: number, value: string) => {
    const numericValue = parseInt(value) || 0;
    console.log('Clicks to be delivered update:', { 
      index, 
      originalValue: value, 
      parsedValue: numericValue 
    });
    const updatedPlan = {
      ...plans[index],
      clicksToBeDelivered: numericValue,
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  // Add handlers for select all
  const handleSelectAllPublishers = (index: number) => {
    console.log('Selecting all publishers for plan:', plans[index].planId);
    const updatedPlan = {
      ...plans[index],
      publisher: [...PREDEFINED_PUBLISHERS],
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  const handleClearAllPublishers = (index: number) => {
    console.log('Clearing all publishers for plan:', plans[index].planId);
    const updatedPlan = {
      ...plans[index],
      publisher: [],
      isEdited: true
    };
    onPlanUpdate(updatedPlan);
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white w-full">
      <div className="p-4">
        {/* Search Bar */}
        <label className="text-gray-800 font-medium text-sm mb-2">Search by Plan ID or Subcategory</label>
        <Input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-4 w-full text-md py-2 px-2 bg-white text-gray-800"
        />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-black whitespace-nowrap">Plan ID</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Publisher</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Budget Cap</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Brand Name</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Subcategory</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Tags & Requirements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.map((plan, index) => (
              <TableRow key={plan.planId || index} className="hover:bg-gray-50">
                <TableCell className="font-medium text-black whitespace-nowrap">{plan.planId}</TableCell>
                <TableCell className="min-w-[200px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => handleSelectAllPublishers(index)}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleClearAllPublishers(index)}
                        className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {PREDEFINED_PUBLISHERS.map((pub) => (
                        <button
                          key={pub}
                          onClick={() => handlePublisherChange(index, pub)}
                          className={`inline-flex items-center px-2 py-1 rounded-md text-sm transition-colors
                            ${Array.isArray(plan.publisher) && plan.publisher.includes(pub)
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                          {pub}
                          {Array.isArray(plan.publisher) && plan.publisher.includes(pub) && (
                            <X size={14} className="ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-[150px]">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={plan.budgetCap || ''}
                    onChange={(e) => handleBudgetChange(index, e.target.value)}
                    placeholder="0"
                    className="bg-white text-black text-md py-2 px-2 w-full"
                  />
                </TableCell>
                <TableCell className="text-black whitespace-nowrap">{plan.brand_name}</TableCell>
                <TableCell className="text-black whitespace-nowrap">{plan.subcategory}</TableCell>
                <TableCell className="min-w-[300px]">
                  <div className="flex justify-between">
                    {/* Left side: Tags area */}
                    <div className="flex flex-wrap gap-2">
                      {PREDEFINED_TAGS.map((tag) => (
                        <div key={tag}>
                          <button
                            onClick={() => handleTagSelect(index, tag)}
                            className={`inline-flex items-center px-2 py-1 rounded-md text-sm transition-colors
              ${plan.tags.includes(tag)
                                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                          >
                            {tag}
                            {plan.tags.includes(tag) && (
                              <X size={14} className="ml-1" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Right side: Fixed position for input fields */}
                    <div className="w-48 flex flex-col space-y-2">
                      {plan.tags.includes('Mandatory') && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-600 font-medium">
                            Distribution Count
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={plan.distributionCount || ''}
                            onChange={(e) => handleDistributionCountChange(index, e.target.value)}
                            placeholder="Enter count"
                            className="w-full text-sm h-8 bg-white text-gray-700"
                          />
                        </div>
                      )}

                      {plan.tags.includes('FOC') && (
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-gray-600 font-medium">
                            Clicks to Deliver
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={plan.clicksToBeDelivered || ''}
                            onChange={(e) => handleClicksToBeDeliveredChange(index, e.target.value)}
                            placeholder="Enter clicks"
                            className="w-full text-sm h-8 bg-white text-gray-700"
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