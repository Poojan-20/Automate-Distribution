import React from 'react';
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
  if (!plans || plans.length === 0) {
    return (
      <div className="p-4 text-center text-black">
        No plan data available. Please upload inventory file.
      </div>
    );
  }

  // Handler for updating budget cap
  const handleBudgetChange = (index: number, value: string) => {
    const numericValue = parseFloat(value) || 0;
    const updatedPlan = { ...plans[index], budgetCap: numericValue, isEdited: true };
    onPlanUpdate(updatedPlan);
  };

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
      return;
    }
    
    // Otherwise set only the selected tag
    const updatedPlan = { 
      ...plans[index], 
      tags: [tag],
      isEdited: true 
    };
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

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white w-full">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-black whitespace-nowrap">Plan ID</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Publisher</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Budget Cap</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Subcategory</TableHead>
              <TableHead className="font-semibold text-black whitespace-nowrap">Tags & Requirements</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan, index) => (
              <TableRow key={plan.planId || index} className="hover:bg-gray-50">
                <TableCell className="font-medium text-black whitespace-nowrap">{plan.planId}</TableCell>
                <TableCell className="min-w-[200px]">
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
                <TableCell className="text-black whitespace-nowrap">{plan.subcategory}</TableCell>
                <TableCell className="min-w-[300px]">
                  <div className="flex flex-wrap gap-4">
                    {PREDEFINED_TAGS.map((tag) => (
                      <div key={tag} className="flex flex-col gap-2">
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
                        
                        {/* Conditional input fields with labels */}
                        {plan.tags.includes('Mandatory') && tag === 'Mandatory' && (
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
                              className="w-40 text-sm h-8 bg-white text-gray-700"
                            />
                          </div>
                        )}
                        
                        {plan.tags.includes('FOC') && tag === 'FOC' && (
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
                              className="w-40 text-sm h-8 bg-white text-gray-700"
                            />
                          </div>
                        )}
                      </div>
                    ))}
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