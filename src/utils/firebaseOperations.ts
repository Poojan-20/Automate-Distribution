import { db } from '@/app/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Plan } from './excelParser';

interface PlanRecord extends Omit<Plan, 'isEdited'> {
  timestamp: Timestamp;
  distributionCount?: number;
  clicksToBeDelivered?: number;
}

export const savePlanToFirebase = async (plan: Plan) => {
  try {
    // Base plan record without budgetCap initially
    const planRecord: PlanRecord = {
      planId: plan.planId,
      tags: plan.tags,
      publisher: plan.publisher,
      subcategory: plan.subcategory,
      brand_name: plan.brand_name,
      timestamp: Timestamp.now()
    };

    // Only include budgetCap if tag is Paid
    if (plan.tags.includes('Paid')) {
      // Allow explicit zero values but not undefined
      planRecord.budgetCap = plan.budgetCap !== undefined ? plan.budgetCap : 0;
    }

    // Add distributionCount if tag is Mandatory (allowing 0 as valid value)
    if (plan.tags.includes('Mandatory') && plan.distributionCount !== undefined) {
      planRecord.distributionCount = plan.distributionCount;
    }

    // Add clicksToBeDelivered if tag is FOC (allowing 0 as valid value)
    if (plan.tags.includes('FOC') && plan.clicksToBeDelivered !== undefined) {
      planRecord.clicksToBeDelivered = plan.clicksToBeDelivered;
    }

    // Validate if the plan has a publisher (required for all plans)
    if (!plan.publisher || plan.publisher.length === 0) {
      throw new Error(`Plan ${plan.planId} is missing publisher`);
    }

    // Validate based on tag type
    if (plan.tags.includes('Paid') && planRecord.budgetCap === undefined) {
      throw new Error(`Plan ${plan.planId} is missing budget cap for Paid tag`);
    }

    if (plan.tags.includes('Mandatory') && (planRecord.distributionCount === undefined)) {
      throw new Error(`Plan ${plan.planId} is missing distribution count for Mandatory tag`);
    }

    if (plan.tags.includes('FOC') && (planRecord.clicksToBeDelivered === undefined)) {
      throw new Error(`Plan ${plan.planId} is missing clicks to be delivered for FOC tag`);
    }

    // Create a new document in the plans collection
    const plansRef = collection(db, 'plans');
    await addDoc(plansRef, planRecord);

    return true;
  } catch (error) {
    console.error('Error saving plan to Firebase:', error);
    throw error; // Propagate the error to handle it in the UI
  }
};

export const getLatestPlanData = async (planId: string): Promise<Plan | null> => {
  try {
    const plansRef = collection(db, 'plans');
    const q = query(
      plansRef,
      where('planId', '==', planId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      // Base plan data
      const plan: Plan = {
        planId: data.planId,
        tags: data.tags || [],
        publisher: data.publisher || [],
        subcategory: data.subcategory || '',
        brand_name: data.brand_name || '',
        isEdited: false
      };
      
      // Add fields based on tag type
      if (data.tags && data.tags.includes('Paid')) {
        plan.budgetCap = data.budgetCap !== undefined ? data.budgetCap : undefined;
      }
      
      if (data.tags && data.tags.includes('Mandatory')) {
        plan.distributionCount = data.distributionCount;
      }
      
      if (data.tags && data.tags.includes('FOC')) {
        plan.clicksToBeDelivered = data.clicksToBeDelivered;
      }
      
      return plan;
    }
    return null;
  } catch (error) {
    console.error('Error fetching plan from Firebase:', error);
    return null;
  }
}; 