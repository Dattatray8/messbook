export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export type Category = MealType | 'EXTRA';
export type BillingType = 'PAY_PER_MEAL' | 'WEEKLY' | 'MONTHLY';

export interface Mess {
  _id: string;
  name: string;
  phone?: string | null;
  mealTypes: MealType[];
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  isActive: boolean;
  billingType: BillingType;
  planAmount: number;
  outstanding?: number;
}

export interface MenuItem {
  _id: string;
  name: string;
  category: Category;
  price: number;
  unit: string;
  isActive: boolean;
}

export interface MealRecord {
  _id: string;
  customerId: string;
  customerName?: string;
  mealType: MealType;
  mealName: string;
  mealQuantity: number;
  mealUnitPrice: number;
  totalAmount: number;
  mealDate: string;
  category?: Category | null;
  billId?: string | null;
}

export interface BillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Bill {
  _id: string;
  customerId: string;
  customerName: string;
  billingType: BillingType;
  items: BillItem[];
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  status: 'Generated' | 'PAID';
  paidAt?: string | null;
  createdAt: string;
}

export interface BillPreview {
  preview: true;
  customerId: string;
  customerName: string;
  billingType: BillingType;
  periodStart: string;
  periodEnd: string;
  items: BillItem[];
  totalAmount: number;
  mealCount: number;
  coveredByPlanCount: number;
  alreadyBilled: boolean;
}

export interface DashboardData {
  totalCustomers: number;
  activeCustomers: number;
  todayMeals: number;
  todayRevenue: number;
  mealsByType: Record<MealType, number>;
  pendingAmount: number;
  pendingBillsCount: number;
  unbilledAmount: number;
  collectedAmount: number;
  topPending: { customerId: string; name: string; amount: number }[];
}

export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
export const CATEGORIES: Category[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'EXTRA'];
export const BILLING_LABEL: Record<BillingType, string> = {
  PAY_PER_MEAL: 'Pay per meal',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};
export const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
