// ─── لایه داده رودین CRM — قرارداد مشترک دو پیاده‌سازی (Prisma / حافظه) ───
// اگر دیتابیس در دسترس نباشد، برنامه به‌صورت خودکار در حالت حافظه اجرا می‌شود
// و همه بخش‌ها (مشتریان، فرصت‌ها، وظایف، پیش‌فاکتور، فرآیندساز، گزارش‌ساز) کامل کار می‌کنند.

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  phone?: string | null;
  createdAt: Date;
}

export interface CustomerRow {
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
  createdAt: Date;
  _count: { deals: number; activity: number; tasks: number; quotes: number; contacts: number };
}

export interface ContactRow {
  id: string;
  customerId: string;
  name: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: boolean;
}

export interface DealRow {
  id: string;
  title: string;
  customerId: string;
  value: number;
  stage: string;
  probability: number;
  source?: string | null;
  expectedClose?: Date | null;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: { id: string; company: string; name: string } | null;
}

export interface ActivityRow {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  userId?: string | null;
  createdAt: Date;
  customer?: { id: string; company: string } | null;
  user?: { id: string; name: string; color: string } | null;
  deal?: { id: string; title: string } | null;
}

export interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: Date | null;
  assigneeId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
  createdAt: Date;
  assignee?: UserRow | null;
  customer?: { id: string; company: string } | null;
  deal?: { id: string; title: string } | null;
}

export interface ProductRow {
  id: string;
  name: string;
  code: string;
  unit: string;
  price: number;
  description?: string | null;
  active: boolean;
}

export interface QuoteItemRow {
  id?: string;
  quoteId?: string;
  productId?: string | null;
  product?: ProductRow | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface QuoteRow {
  id: string;
  number: string;
  customerId: string;
  status: string;
  issueDate: Date;
  validUntil?: Date | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  createdAt: Date;
  customer?: { id: string; company: string; name: string; phone: string } | null;
  _count?: { items: number };
  items?: QuoteItemRow[];
}

export interface CustomerDetail extends Omit<CustomerRow, "_count"> {
  _count: { deals: number; activity: number; tasks: number; quotes: number; contacts: number };
  contacts: ContactRow[];
  deals: DealRow[];
  activity: ActivityRow[];
  tasks: TaskRow[];
  quotes: QuoteRow[];
}

export interface WfNodeJson {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown> & { label?: string; nodeType?: string };
}
export interface WfEdgeJson {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  animated?: boolean;
}

export interface WorkflowRunRow {
  id: string;
  workflowId: string;
  status: string;
  testData?: string | null;
  duration?: number | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export interface NodeRunRow {
  id: string;
  runId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: string;
  logs?: string | null;
  error?: string | null;
  output?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface WorkflowRow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  nodes: WfNodeJson[];
  edges: WfEdgeJson[];
  createdAt: Date;
  lastRun?: { id: string; status: string; startedAt: Date } | null;
  runCount?: number;
  successRate?: number | null;
}

export interface WorkflowDetail extends Omit<WorkflowRow, "lastRun" | "runCount" | "successRate"> {
  runs: (WorkflowRunRow & { nodeRuns: NodeRunRow[] })[];
}

export interface DashboardRaw {
  customers: CustomerRow[];
  deals: DealRow[];
  tasks: TaskRow[];
  quotes: QuoteRow[];
  activities: ActivityRow[];
  users: UserRow[];
}

export interface CustomerCreate {
  name: string;
  company: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  industry?: string | null;
  city?: string | null;
  status?: string;
  tags?: string | null;
  notes?: string | null;
}

export interface DealCreate {
  title: string;
  customerId: string;
  value?: number;
  stage?: string;
  probability?: number;
  source?: string | null;
  expectedClose?: Date | null;
  description?: string | null;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: Date | null;
  assigneeId?: string | null;
  customerId?: string | null;
  dealId?: string | null;
}

export interface QuoteItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface QuoteCreate {
  customerId: string;
  status?: string;
  validUntil?: Date | null;
  notes?: string | null;
  items: QuoteItemInput[];
  discountPercent?: number;
}

export interface QuoteUpdateBody extends Partial<QuoteCreate> {
  status?: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string | null;
  isActive?: boolean;
  nodes?: WfNodeJson[];
  edges?: WfEdgeJson[];
}

export interface NodeRunCreate {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: string;
  logs?: string | null;
  error?: string | null;
  output?: string | null;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface NodeRunPatch {
  status?: string;
  logs?: string | null;
  error?: string | null;
  output?: string | null;
  finishedAt?: Date;
}

export interface DataService {
  readonly mode: "prisma" | "memory";

  // ── مشتریان ──
  listCustomers(q?: string, status?: string): Promise<CustomerRow[]>;
  getCustomer(id: string): Promise<CustomerDetail | null>;
  createCustomer(data: CustomerCreate): Promise<CustomerRow>;
  updateCustomer(id: string, data: Partial<CustomerCreate>): Promise<CustomerRow | null>;
  deleteCustomer(id: string): Promise<void>;
  createCustomerActivity(id: string, data: { type: string; title: string; content?: string | null; userId?: string | null }): Promise<ActivityRow>;

  // ── فرصت‌ها ──
  listDeals(stage?: string): Promise<DealRow[]>;
  createDeal(data: DealCreate): Promise<DealRow>;
  updateDeal(id: string, data: Partial<DealCreate & { stage: string; probability: number }>): Promise<DealRow | null>;
  deleteDeal(id: string): Promise<void>;

  // ── وظایف ──
  listTasks(status?: string, assigneeId?: string): Promise<TaskRow[]>;
  createTask(data: TaskCreate): Promise<TaskRow>;
  updateTask(id: string, data: Partial<TaskCreate> & { status?: string; priority?: string }): Promise<TaskRow | null>;
  deleteTask(id: string): Promise<void>;

  // ── مرجع ──
  listUsers(): Promise<UserRow[]>;
  listProducts(): Promise<ProductRow[]>;

  // ── پیش‌فاکتور ──
  listQuotes(): Promise<QuoteRow[]>;
  getQuote(id: string): Promise<QuoteRow | null>;
  createQuote(data: QuoteCreate): Promise<QuoteRow>;
  updateQuote(id: string, body: QuoteUpdateBody): Promise<QuoteRow | null>;
  deleteQuote(id: string): Promise<void>;

  // ── فرآیندها ──
  listWorkflows(): Promise<WorkflowRow[]>;
  getWorkflow(id: string): Promise<WorkflowDetail | null>;
  createWorkflow(data: WorkflowCreate): Promise<WorkflowRow>;
  updateWorkflow(id: string, data: Partial<WorkflowCreate>): Promise<WorkflowRow | null>;
  deleteWorkflow(id: string): Promise<void>;

  // ── موتور اجرا ──
  createRun(workflowId: string, testData: unknown): Promise<string>;
  finishRun(runId: string, status: string, duration: number): Promise<void>;
  createNodeRun(runId: string, data: NodeRunCreate): Promise<string>;
  updateNodeRun(id: string, patch: NodeRunPatch): Promise<void>;
  listNodeRuns(runId: string): Promise<NodeRunRow[]>;

  // ── داشبورد/گزارش/جستجو ──
  getDashboardRaw(): Promise<DashboardRaw>;
  searchAll(q: string): Promise<{
    customers: { id: string; company: string; name: string; phone: string }[];
    deals: { id: string; title: string; value: number; stage: string; customer?: { company: string } }[];
    tasks: { id: string; title: string; status: string; customer?: { company: string } }[];
    quotes: { id: string; number: string; total: number; status: string; customer?: { company: string } }[];
  }>;
}
