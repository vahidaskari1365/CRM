// ─── Shared API contracts (frontend ↔ backend) ───────────────────

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type QuoteStatus = "draft" | "sent" | "approved" | "rejected";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  phone?: string | null;
  createdAt?: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  industry?: string | null;
  city?: string | null;
  status: string;
  tags?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { deals: number; activity: number; tasks: number; quotes: number; contacts: number };
}

export interface ContactDto {
  id: string;
  customerId: string;
  name: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
}

export interface ActivityDto {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  userId?: string | null;
  createdAt: string;
  customer?: { id: string; company: string } | null;
  user?: { id: string; name: string; color: string } | null;
  deal?: { id: string; title: string } | null;
}

export interface DealDto {
  id: string;
  title: string;
  customerId: string;
  value: number;
  stage: DealStage;
  probability: number;
  source?: string | null;
  expectedClose?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; company: string; name: string } | null;
}

export interface TaskDto {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  createdAt: string;
  assignee?: UserDto | null;
  customer?: { id: string; company: string } | null;
  deal?: { id: string; title: string } | null;
}

export interface QuoteItemDto {
  id?: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  unit?: string;
}

export interface QuoteDto {
  id: string;
  number: string;
  customerId: string;
  status: QuoteStatus;
  issueDate: string;
  validUntil?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  createdAt: string;
  customer?: CustomerDto | null;
  items?: QuoteItemDto[];
}

export interface ProductDto {
  id: string;
  name: string;
  code: string;
  unit: string;
  price: number;
  description?: string | null;
}

// ─── Dashboard ───
export interface DashboardDto {
  kpis: {
    customers: number;
    activeCustomers: number;
    openDeals: number;
    pipelineValue: number;
    wonValue: number;
    wonCount: number;
    lostCount: number;
    conversionRate: number;
    overdueTasks: number;
    dueSoonTasks: number;
    openTasks: number;
    quotesSent: number;
    monthlyRevenue: number;
    avgDealSize: number;
  };
  stageStats: { stage: string; count: number; value: number }[];
  monthly: { key: string; revenue: number; newDeals: number; activities: number }[];
  topCustomers: { name: string; value: number; deals: number }[];
  sources: { source: string; count: number; value: number }[];
  taskStats: { status: string; count: number }[];
  activityTypes: { type: string; count: number }[];
  recentActivities: ActivityDto[];
  upcomingTasks: TaskDto[];
  insights: string[];
}

// ─── Report builder ───
export interface ReportRequest {
  entity: "deals" | "customers" | "tasks" | "quotes" | "activities";
  groupBy: string;
  metric: string; // count | sum_value | sum_total
  chartType: "bar" | "line" | "pie" | "area" | "radar";
  filters?: { field: string; value: string }[];
  title?: string;
}
export interface ReportResponse {
  title: string;
  rows: { label: string; value: number }[];
  total: number;
  entity: string;
  groupBy: string;
  metric: string;
  generatedAt: string;
}

// ─── Workflow ───
export interface WfNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string;
    description?: string;
    expression?: string;
    taskTitle?: string;
    priority?: string;
    message?: string;
    title?: string;
    url?: string;
    ms?: number;
    [k: string]: unknown;
  };
}
export interface WfEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
}
export interface WorkflowDto {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  nodes: WfNode[];
  edges: WfEdge[];
  createdAt: string;
  lastRun?: { id: string; status: string; startedAt: string } | null;
  runCount?: number;
  successRate?: number;
}
export interface NodeRunDto {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  logs?: string | null; // JSON string[]
  error?: string | null;
  output?: string | null; // JSON
  startedAt?: string | null;
  finishedAt?: string | null;
}
export interface RunDto {
  id: string;
  workflowId: string;
  status: "running" | "success" | "failed";
  testData?: string | null;
  duration?: number | null;
  startedAt: string;
  finishedAt?: string | null;
  nodeRuns: NodeRunDto[];
}

export const WF_NODE_TYPES: { type: string; label: string; icon: string; color: string; desc: string }[] = [
  { type: "start", label: "شروع", icon: "Play", color: "#10b981", desc: "نقطه آغاز فرآیند" },
  { type: "end", label: "پایان", icon: "Square", color: "#6b7280", desc: "پایان فرآیند" },
  { type: "condition", label: "شرط", icon: "GitBranch", color: "#f59e0b", desc: "شاخه‌بندی بر اساس داده تستی" },
  { type: "create_task", label: "ساخت وظیفه", icon: "ListTodo", color: "#8b5cf6", desc: "ایجاد وظیفه واقعی در سیستم" },
  { type: "notify", label: "اعلان", icon: "Bell", color: "#06b6d4", desc: "ارسال اعلان/پیام" },
  { type: "add_activity", label: "ثبت فعالیت", icon: "History", color: "#ec4899", desc: "ثبت در سوابق مشتری" },
  { type: "update_deal", label: "به‌روزرسانی فرصت", icon: "TrendingUp", color: "#f97316", desc: "تغییر مرحله فرصت" },
  { type: "http", label: "درخواست HTTP", icon: "Globe", color: "#14b8a6", desc: "فراخوانی سرویس بیرونی" },
  { type: "delay", label: "تأخیر", icon: "Timer", color: "#a855f7", desc: "انتظار مشخص" },
];
