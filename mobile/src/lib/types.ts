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

export interface AppNotification {
  _id: string;
  type: 'AUTO_BILLS_GENERATED' | 'AUTOMATION_ERROR' | 'MANUAL_BILLS_GENERATED';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedType?: 'bill' | 'bills' | 'automation' | null;
  relatedId?: string | null;
}

export interface NotificationsPage {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export type AutomationStatus = 'DISABLED' | 'AWAITING_CONFIGURATION' | 'AWAITING_FIRST_RUN' | 'ERROR' | 'ACTIVE';

export interface AutomationSettings {
  enabled: boolean;
  timezone: string;
  status: AutomationStatus;
  schedulerConfigured: boolean;
  lastScheduledRunAt: string | null;
  lastRun: {
    status?: string | null;
    finishedAt?: string | null;
    created: number;
    skipped: number;
    failed: number;
    errorSummary?: string | null;
  } | null;
  nextPeriodCloses: { weekly: string; monthly: string };
}

export interface AutomationRunRow {
  runId: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  created: number;
  skippedAlreadyBilled: number;
  skippedNothingToBill: number;
  failed: number;
  errorSummary?: string | null;
}

export interface GenerateNowResult {
  runId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  created: number;
  skippedAlreadyBilled: number;
  skippedNothingToBill: number;
  failed: number;
  hasMore: boolean;
  failures: { customerId: string; customerName?: string; reason: string }[];
}

export interface GenerateNowPreview {
  dryRun: true;
  eligibleCustomers: number;
  alreadyBilled: number;
  toProcess: number;
}
