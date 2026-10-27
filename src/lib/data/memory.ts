import type {
  ActivityRow, CustomerCreate, CustomerDetail, CustomerRow, DataService, DashboardRaw,
  DealCreate, DealRow, NodeRunCreate, NodeRunPatch, NodeRunRow, ProductRow, QuoteCreate,
  QuoteItemInput, QuoteItemRow, QuoteRow, QuoteUpdateBody, TaskCreate, TaskRow, UserRow,
  WorkflowCreate, WorkflowDetail, WorkflowRow, WorkflowRunRow, WfEdgeJson, WfNodeJson,
} from "./types";
import { buildSampleDataset, makeId } from "./sample";

// ─── Store سراسری (مقاوم در برابر HMR) ───
interface MemStore {
  users: (UserRow & { _seq: number })[];
  customers: MemCustomer[];
  deals: MemDeal[];
  activities: MemActivity[];
  tasks: MemTask[];
  products: ProductRow[];
  quotes: MemQuote[];
  workflows: MemWorkflow[];
  runs: MemRun[];
  nodeRuns: MemNodeRun[];
  seq: number;
}
type MemCustomer = Omit<CustomerRow, "_count">;
type MemDeal = DealRow & { customer: { id: string; company: string; name: string } | null };
type MemActivity = ActivityRow;
type MemTask = TaskRow;
type MemQuote = Omit<QuoteRow, "_count"> & { items: MemQuoteItem[] };
type MemQuoteItem = QuoteItemRow & { id: string; quoteId: string };
type MemWorkflow = { id: string; name: string; description?: string | null; isActive: boolean; nodes: WfNodeJson[]; edges: WfEdgeJson[]; createdAt: Date };
type MemRun = WorkflowRunRow;
type MemNodeRun = NodeRunRow & { id: string };

type MemCustomerWithContacts = MemCustomer & {
  _contacts: { id: string; customerId: string; name: string; position?: string | null; phone?: string | null; email?: string | null; isPrimary: boolean }[];
};

function createMemoryStore(): MemStore {
  const d = buildSampleDataset();
  return {
    users: d.users.map((u, i) => ({ ...u, _seq: i })),
    customers: d.customers.map((c) => ({ ...c })),
    deals: d.deals.map((x) => ({ ...x, customer: null })), // join در خواندن
    activities: d.activities.map((a) => ({ ...a })),
    tasks: d.tasks.map((t) => ({ ...t })),
    products: d.products.map((p) => ({ ...p })),
    quotes: d.quotes.map((q) => ({ ...q, customer: null })),
    workflows: d.workflows.map((w) => ({ ...w })),
    runs: [],
    nodeRuns: [],
    seq: 1000,
  };
}

const g = globalThis as unknown as { __roudinMem?: MemStore };
function store(): MemStore {
  if (!g.__roudinMem) g.__roudinMem = createMemoryStore();
  return g.__roudinMem;
}

// ─── helperها ───
const nextId = (s: MemStore, p: string) => `${p}_${(s.seq++).toString(36)}${makeId().slice(-4)}`;
const contains = (field: string | null | undefined, q: string) => (field ?? "").toLowerCase().includes(q);

function countFor(s: MemStore, customerId: string) {
  return {
    deals: s.deals.filter((d) => d.customerId === customerId).length,
    activity: s.activities.filter((a) => a.customerId === customerId).length,
    tasks: s.tasks.filter((t) => t.customerId === customerId).length,
    quotes: s.quotes.filter((q) => q.customerId === customerId).length,
    contacts: ((s.customers.find((c) => c.id === customerId) as MemCustomerWithContacts | undefined)?._contacts ?? []).length,
  };
}

function custRow(s: MemStore, c: MemCustomerWithContacts): CustomerRow {
  const { _contacts, ...rest } = c;
  return { ...rest, _count: countFor(s, c.id) };
}

function withCustomer<T extends { customerId?: string | null }>(s: MemStore, row: T) {
  const c = row.customerId ? s.customers.find((x) => x.id === row.customerId) : null;
  return c ? { ...row, customer: { id: c.id, company: c.company, name: c.name } } : { ...row, customer: null };
}

function withTaskJoins(s: MemStore, t: MemTask): TaskRow {
  const base = withCustomer(s, t) as TaskRow;
  const assignee = t.assigneeId ? s.users.find((u) => u.id === t.assigneeId) ?? null : null;
  const deal = t.dealId ? s.deals.find((d) => d.id === t.dealId) ?? null : null;
  return {
    ...base,
    assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email, role: assignee.role, color: assignee.color, phone: assignee.phone ?? null, createdAt: assignee.createdAt } : null,
    deal: deal ? { id: deal.id, title: deal.title } : null,
  };
}

function withActivityJoins(s: MemStore, a: MemActivity): ActivityRow {
  const base = withCustomer(s, a) as ActivityRow;
  const u = a.userId ? s.users.find((x) => x.id === a.userId) : null;
  const deal = a.dealId ? s.deals.find((d) => d.id === a.dealId) : null;
  return {
    ...base,
    user: u ? { id: u.id, name: u.name, color: u.color } : null,
    deal: deal ? { id: deal.id, title: deal.title } : null,
  };
}

function withQuoteJoins(s: MemStore, q: MemQuote, withItems = false): QuoteRow {
  const c = s.customers.find((x) => x.id === q.customerId);
  const { items, ...rest } = q;
  return {
    ...rest,
    customer: c ? { id: c.id, company: c.company, name: c.name, phone: c.phone } : null,
    _count: { items: items.length },
    ...(withItems ? { items: items.map((it) => ({ ...it, product: it.productId ? s.products.find((p) => p.id === it.productId) ?? null : null })) } : {}),
  } as QuoteRow;
}

function computeQuoteTotals(items: QuoteItemInput[], overallDiscountPercent: number) {
  const computed = items.map((it) => ({
    productId: it.productId ?? null,
    name: it.name,
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
    discount: Number(it.discount) || 0,
    lineTotal: Math.round((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discount) || 0) / 100)),
  }));
  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const afterLines = computed.reduce((s, it) => s + it.lineTotal, 0);
  const discount = Math.round((afterLines * (overallDiscountPercent ?? 0)) / 100);
  const tax = Math.round((afterLines - discount) * 0.1);
  return { computed, subtotal, discount, tax, total: afterLines - discount + tax };
}

function faYear(): string {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric" })
    .format(new Date())
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
}

// ─── پیاده‌سازی حافظه‌ای DataService ───
export const memoryService: DataService = {
  mode: "memory",

  async listCustomers(q?: string, status?: string) {
    const s = store();
    const query = (q ?? "").trim().toLowerCase();
    return s.customers
      .filter((c) => {
        if (status && c.status !== status) return false;
        if (!query) return true;
        return [c.name, c.company, c.phone, c.email, c.industry, c.city].some((f) => contains(f, query));
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((c) => custRow(s, c as MemCustomerWithContacts));
  },

  async getCustomer(id: string): Promise<CustomerDetail | null> {
    const s = store();
    const c = s.customers.find((x) => x.id === id) as MemCustomerWithContacts | undefined;
    if (!c) return null;
    const { _contacts, ...rest } = c;
    return {
      ...rest,
      _count: countFor(s, id),
      contacts: _contacts.map((ct) => ({ ...ct })),
      deals: s.deals.filter((d) => d.customerId === id).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map((d) => withCustomer(s, d)),
      activity: s.activities
        .filter((a) => a.customerId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 30)
        .map((a) => withActivityJoins(s, a)),
      tasks: s.tasks.filter((t) => t.customerId === id).sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0)).map((t) => withTaskJoins(s, t)),
      quotes: s.quotes.filter((q) => q.customerId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((q) => withQuoteJoins(s, q)),
    };
  },

  async createCustomer(data: CustomerCreate): Promise<CustomerRow> {
    const s = store();
    const c: MemCustomerWithContacts = {
      id: nextId(s, "cu"),
      name: data.name,
      company: data.company,
      phone: data.phone,
      email: data.email ?? null,
      address: data.address ?? null,
      industry: data.industry ?? null,
      city: data.city ?? null,
      status: data.status ?? "active",
      tags: data.tags ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
      _contacts: [{ id: nextId(s, "ct"), customerId: "", name: data.name, position: "مدیرعامل", phone: data.phone, email: data.email ?? null, isPrimary: true }],
    };
    c._contacts[0].customerId = c.id;
    s.customers.push(c);
    return custRow(s, c);
  },

  async updateCustomer(id, data) {
    const s = store();
    const c = s.customers.find((x) => x.id === id) as MemCustomerWithContacts | undefined;
    if (!c) return null;
    for (const k of ["name", "company", "phone", "email", "address", "industry", "city", "status", "tags", "notes"] as const) {
      if (k in data && data[k] !== undefined) (c as Record<string, unknown>)[k] = data[k];
    }
    return custRow(s, c);
  },

  async deleteCustomer(id) {
    const s = store();
    s.customers = s.customers.filter((c) => c.id !== id);
    s.deals = s.deals.filter((d) => d.customerId !== id);
    s.activities = s.activities.filter((a) => a.customerId !== id);
    s.tasks = s.tasks.filter((t) => t.customerId !== id);
    s.quotes = s.quotes.filter((q) => q.customerId !== id);
  },

  async createCustomerActivity(id, data) {
    const s = store();
    const a: MemActivity = {
      id: nextId(s, "a"),
      type: data.type,
      title: data.title,
      content: data.content ?? null,
      customerId: id,
      dealId: null,
      userId: data.userId ?? null,
      createdAt: new Date(),
    };
    s.activities.push(a);
    return withActivityJoins(s, a);
  },

  async listDeals(stage?: string) {
    const s = store();
    return s.deals
      .filter((d) => !stage || d.stage === stage)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((d) => withCustomer(s, d));
  },

  async createDeal(data: DealCreate) {
    const s = store();
    const d: MemDeal = {
      id: nextId(s, "d"),
      title: data.title,
      customerId: data.customerId,
      value: Number(data.value) || 0,
      stage: data.stage ?? "lead",
      probability: Number(data.probability) || 20,
      source: data.source ?? null,
      expectedClose: data.expectedClose ?? null,
      description: data.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: null,
    };
    s.deals.push(d);
    return withCustomer(s, d);
  },

  async updateDeal(id, data) {
    const s = store();
    const d = s.deals.find((x) => x.id === id);
    if (!d) return null;
    for (const k of ["title", "stage", "source", "description"] as const) if (k in data && data[k] !== undefined) d[k] = data[k] as never;
    if ("value" in data && data.value !== undefined) d.value = Number(data.value) || 0;
    if ("probability" in data && data.probability !== undefined) d.probability = Number(data.probability) || 0;
    if ("customerId" in data && data.customerId) d.customerId = data.customerId;
    if ("expectedClose" in data) d.expectedClose = data.expectedClose ?? null;
    d.updatedAt = new Date();
    return withCustomer(s, d);
  },

  async deleteDeal(id) {
    const s = store();
    s.deals = s.deals.filter((d) => d.id !== id);
    s.tasks = s.tasks.map((t) => (t.dealId === id ? { ...t, dealId: null } : t));
    s.activities = s.activities.map((a) => (a.dealId === id ? { ...a, dealId: null } : a));
  },

  async listTasks(status?: string, assigneeId?: string) {
    const s = store();
    return s.tasks
      .filter((t) => (!status || t.status === status) && (!assigneeId || t.assigneeId === assigneeId))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "done" ? 1 : b.status === "done" ? -1 : 0;
        return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
      })
      .map((t) => withTaskJoins(s, t));
  },

  async createTask(data: TaskCreate) {
    const s = store();
    const t: MemTask = {
      id: nextId(s, "t"),
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      dueDate: data.dueDate ?? null,
      assigneeId: data.assigneeId || null,
      customerId: data.customerId || null,
      dealId: data.dealId || null,
      createdAt: new Date(),
    };
    s.tasks.push(t);
    return withTaskJoins(s, t);
  },

  async updateTask(id, data) {
    const s = store();
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return null;
    for (const k of ["title", "description", "status", "priority"] as const) if (k in data && data[k] !== undefined) t[k] = data[k] as never;
    if ("assigneeId" in data) t.assigneeId = (data.assigneeId as string) || null;
    if ("customerId" in data) t.customerId = (data.customerId as string) || null;
    if ("dealId" in data) t.dealId = (data.dealId as string) || null;
    if ("dueDate" in data) t.dueDate = data.dueDate ?? null;
    return withTaskJoins(s, t);
  },

  async deleteTask(id) {
    const s = store();
    s.tasks = s.tasks.filter((t) => t.id !== id);
  },

  async listUsers() {
    const s = store();
    return s.users
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, phone: u.phone ?? null, createdAt: u.createdAt }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  async listProducts() {
    return store().products.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, "fa"));
  },

  async listQuotes() {
    const s = store();
    return s.quotes
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((q) => withQuoteJoins(s, q));
  },

  async getQuote(id) {
    const s = store();
    const q = s.quotes.find((x) => x.id === id);
    return q ? withQuoteJoins(s, q, true) : null;
  },

  async createQuote(data: QuoteCreate) {
    const s = store();
    const { computed, subtotal, discount, tax, total } = computeQuoteTotals(data.items, Number(data.discountPercent) || 0);
    const q: MemQuote = {
      id: nextId(s, "q"),
      number: `RF-${faYear()}-${String(s.quotes.length + 1).padStart(4, "0")}`,
      customerId: data.customerId,
      status: data.status ?? "draft",
      issueDate: new Date(),
      validUntil: data.validUntil ?? new Date(Date.now() + 30 * 86400000),
      subtotal,
      discount,
      tax,
      total,
      notes: data.notes ?? null,
      createdAt: new Date(),
      items: computed.map((it) => ({ ...it, id: nextId(s, "qi"), quoteId: "" })),
    };
    for (const it of q.items) it.quoteId = q.id;
    s.quotes.push(q);
    return withQuoteJoins(s, q, true);
  },

  async updateQuote(id, body: QuoteUpdateBody) {
    const s = store();
    const q = s.quotes.find((x) => x.id === id);
    if (!q) return null;
    // تغییر وضعیت ساده
    if (body.status && !body.items) {
      q.status = body.status;
      return withQuoteJoins(s, q, true);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) return withQuoteJoins(s, q, true);
    const { computed, subtotal, discount, tax, total } = computeQuoteTotals(body.items, Number(body.discountPercent) || 0);
    q.items = computed.map((it) => ({ ...it, id: nextId(s, "qi"), quoteId: q.id }));
    q.subtotal = subtotal;
    q.discount = discount;
    q.tax = tax;
    q.total = total;
    if (body.customerId) q.customerId = body.customerId;
    if (body.status) q.status = body.status;
    if ("validUntil" in body) q.validUntil = body.validUntil ?? null;
    if ("notes" in body) q.notes = body.notes ?? null;
    return withQuoteJoins(s, q, true);
  },

  async deleteQuote(id) {
    const s = store();
    s.quotes = s.quotes.filter((q) => q.id !== id);
  },

  async listWorkflows(): Promise<WorkflowRow[]> {
    const s = store();
    const list = s.workflows.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return list.map((w) => {
      const runs = s.runs.filter((r) => r.workflowId === w.id).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      const total = runs.length;
      const success = runs.filter((r) => r.status === "success").length;
      return {
        ...w,
        lastRun: runs[0] ? { id: runs[0].id, status: runs[0].status, startedAt: runs[0].startedAt } : null,
        runCount: total,
        successRate: total > 0 ? Math.round((success / total) * 100) : null,
      };
    });
  },

  async getWorkflow(id): Promise<WorkflowDetail | null> {
    const s = store();
    const w = s.workflows.find((x) => x.id === id);
    if (!w) return null;
    const runs = s.runs
      .filter((r) => r.workflowId === id)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 10)
      .map((r) => ({ ...r, nodeRuns: s.nodeRuns.filter((n) => n.runId === r.id).map((n) => ({ ...n })) }));
    return { ...w, runs };
  },

  async createWorkflow(data: WorkflowCreate) {
    const s = store();
    const w: MemWorkflow = {
      id: nextId(s, "w"),
      name: data.name,
      description: data.description ?? null,
      isActive: data.isActive ?? false,
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
      createdAt: new Date(),
    };
    s.workflows.push(w);
    return { ...w, lastRun: null, runCount: 0, successRate: null };
  },

  async updateWorkflow(id, data) {
    const s = store();
    const w = s.workflows.find((x) => x.id === id);
    if (!w) return null;
    if ("name" in data && data.name !== undefined) w.name = data.name;
    if ("description" in data) w.description = data.description ?? null;
    if ("isActive" in data && data.isActive !== undefined) w.isActive = data.isActive;
    if ("nodes" in data && data.nodes) w.nodes = data.nodes;
    if ("edges" in data && data.edges) w.edges = data.edges;
    return { ...w };
  },

  async deleteWorkflow(id) {
    const s = store();
    s.workflows = s.workflows.filter((w) => w.id !== id);
    const runIds = s.runs.filter((r) => r.workflowId === id).map((r) => r.id);
    s.runs = s.runs.filter((r) => r.workflowId !== id);
    s.nodeRuns = s.nodeRuns.filter((n) => !runIds.includes(n.runId));
  },

  async createRun(workflowId, testData) {
    const s = store();
    const run: MemRun = {
      id: nextId(s, "run"),
      workflowId,
      status: "running",
      testData: JSON.stringify(testData ?? {}),
      startedAt: new Date(),
      duration: null,
      finishedAt: null,
    };
    s.runs.push(run);
    return run.id;
  },

  async finishRun(runId, status, duration) {
    const s = store();
    const r = s.runs.find((x) => x.id === runId);
    if (r) {
      r.status = status;
      r.duration = duration;
      r.finishedAt = new Date();
    }
  },

  async createNodeRun(runId, data: NodeRunCreate) {
    const s = store();
    const nr: MemNodeRun = {
      id: nextId(s, "nr"),
      runId,
      nodeId: data.nodeId,
      nodeName: data.nodeName,
      nodeType: data.nodeType,
      status: data.status,
      logs: data.logs ?? null,
      error: data.error ?? null,
      output: data.output ?? null,
      startedAt: data.startedAt ?? new Date(),
      finishedAt: data.finishedAt ?? null,
    };
    s.nodeRuns.push(nr);
    return nr.id;
  },

  async updateNodeRun(id, patch: NodeRunPatch) {
    const s = store();
    const nr = s.nodeRuns.find((x) => x.id === id);
    if (!nr) return;
    if (patch.status !== undefined) nr.status = patch.status;
    if (patch.logs !== undefined) nr.logs = patch.logs;
    if (patch.error !== undefined) nr.error = patch.error;
    if (patch.output !== undefined) nr.output = patch.output;
    if (patch.finishedAt !== undefined) nr.finishedAt = patch.finishedAt;
  },

  async listNodeRuns(runId) {
    return store()
      .nodeRuns.filter((n) => n.runId === runId)
      .map((n) => ({ ...n }))
      .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
  },

  async getDashboardRaw(): Promise<DashboardRaw> {
    const s = store();
    return {
      customers: s.customers.map((c) => custRow(s, c as MemCustomerWithContacts)),
      deals: s.deals.map((d) => withCustomer(s, d)),
      tasks: s.tasks.map((t) => withTaskJoins(s, t)),
      quotes: s.quotes.map((q) => withQuoteJoins(s, q)),
      activities: s.activities.map((a) => withActivityJoins(s, a)),
      users: s.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, phone: u.phone ?? null, createdAt: u.createdAt })),
    };
  },

  async searchAll(q) {
    const s = store();
    const query = q.trim().toLowerCase();
    return {
      customers: s.customers
        .filter((c) => [c.company, c.name, c.phone, c.email].some((f) => contains(f, query)))
        .slice(0, 5)
        .map((c) => ({ id: c.id, company: c.company, name: c.name, phone: c.phone })),
      deals: s.deals
        .filter((d) => contains(d.title, query))
        .slice(0, 5)
        .map((d) => ({ ...withCustomer(s, d), customer: d.customerId ? { company: s.customers.find((c) => c.id === d.customerId)?.company ?? "" } : undefined })),
      tasks: s.tasks
        .filter((t) => contains(t.title, query))
        .slice(0, 5)
        .map((t) => ({ id: t.id, title: t.title, status: t.status, customer: t.customerId ? { company: s.customers.find((c) => c.id === t.customerId)?.company ?? "" } : undefined })),
      quotes: s.quotes
        .filter((q) => contains(q.number, query))
        .slice(0, 5)
        .map((q) => ({ id: q.id, number: q.number, total: q.total, status: q.status, customer: { company: s.customers.find((c) => c.id === q.customerId)?.company ?? "" } })),
    };
  },
};

export type { QuoteItemInput };
