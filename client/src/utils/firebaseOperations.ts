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
    // Only include distributionCount and clicksToBeDelivered if they exist and are valid
    const planRecord: PlanRecord = {
      planId: plan.planId,
      budgetCap: plan.budgetCap,
      tags: plan.tags,
      publisher: plan.publisher,
      subcategory: plan.subcategory,
      brand_name: plan.brand_name,
      timestamp: Timestamp.now()
    };

    // Add distributionCount only if it exists and tag is Mandatory
    if (plan.tags.includes('Mandatory') && plan.distributionCount && plan.distributionCount > 0) {
      planRecord.distributionCount = plan.distributionCount;
    }

    // Add clicksToBeDelivered only if it exists and tag is FOC
    if (plan.tags.includes('FOC') && plan.clicksToBeDelivered && plan.clicksToBeDelivered > 0) {
      planRecord.clicksToBeDelivered = plan.clicksToBeDelivered;
    }

    // Validate if the plan should be saved
    if (!plan.publisher || plan.publisher.length === 0 || plan.budgetCap <= 0) {
      throw new Error(`Plan ${plan.planId} is missing required fields`);
    }

    // Additional validation for tag-specific requirements
    if (plan.tags.includes('Mandatory') && (!planRecord.distributionCount || planRecord.distributionCount <= 0)) {
      throw new Error(`Plan ${plan.planId} is missing distribution count for Mandatory tag`);
    }

    if (plan.tags.includes('FOC') && (!planRecord.clicksToBeDelivered || planRecord.clicksToBeDelivered <= 0)) {
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
      return {
        planId: data.planId,
        budgetCap: data.budgetCap,
        tags: data.tags || [],
        publisher: data.publisher || [],
        subcategory: data.subcategory,
        brand_name: data.brand_name || '',
        distributionCount: data.distributionCount || 0,
        clicksToBeDelivered: data.clicksToBeDelivered || 0,
        isEdited: false
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching plan from Firebase:', error);
    return null;
  }
}; 