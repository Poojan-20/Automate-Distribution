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

  // Handler for toggling tags
  const handleTagToggle = (index: number, tag: typeof PREDEFINED_TAGS[number]) => {
    const currentTags = plans[index].tags;
    let updatedTags;
    
    if (currentTags.includes(tag)) {
      updatedTags = currentTags.filter(t => t !== tag);
    } else {
      updatedTags = [...currentTags, tag];
    }
    
    const updatedPlan = { 
      ...plans[index], 
      tags: updatedTags,
      isEdited: true 
    };
    onPlanUpdate(updatedPlan);
  };

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold text-black">Plan ID</TableHead>
              <TableHead className="font-semibold text-black">Publisher</TableHead>
              <TableHead className="font-semibold text-black">Budget Cap</TableHead>
              <TableHead className="font-semibold text-black">Subcategory</TableHead>
              <TableHead className="font-semibold text-black">Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan, index) => (
              <TableRow key={plan.planId || index} className="hover:bg-gray-50">
                <TableCell className="font-medium text-black">{plan.planId}</TableCell>
                <TableCell>
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
                <TableCell>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={plan.budgetCap || ''} 
                    onChange={(e) => handleBudgetChange(index, e.target.value)}
                    placeholder="0.00"
                    className="bg-white text-black border-gray-200"
                  />
                </TableCell>
                <TableCell className="text-black">{plan.subcategory}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {PREDEFINED_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(index, tag)}
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