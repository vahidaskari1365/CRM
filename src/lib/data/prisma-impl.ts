import { PrismaClient } from "@prisma/client";
import type {
  ActivityRow, CustomerCreate, CustomerDetail, CustomerRow, DataService, DashboardRaw,
  DealCreate, DealRow, NodeRunCreate, NodeRunPatch, NodeRunRow, ProductRow, QuoteCreate,
  QuoteItemInput, QuoteRow, QuoteUpdateBody, TaskCreate, TaskRow, UserRow, WorkflowCreate,
  WorkflowDetail, WorkflowRow,
} from "./types";

const g = globalThis as unknown as { __roudinPrisma?: PrismaClient };
function client(): PrismaClient {
  if (!g.__roudinPrisma) g.__roudinPrisma = new PrismaClient();
  return g.__roudinPrisma;
}

const db = () => client();

function faYear(): string {
  return new Intl.DateTimeFormat("fa-IR", { year: "numeric" })
    .format(new Date())
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\D/g, "");
}

interface ItemInput {
  productId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

function computeTotals(items: ItemInput[], overallDiscountPercent: number) {
  const computed = items.map((it) => ({ ...it, lineTotal: Math.round(it.quantity * it.unitPrice * (1 - (it.discount ?? 0) / 100)) }));
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const afterLines = computed.reduce((s, it) => s + it.lineTotal, 0);
  const discount = Math.round((afterLines * (overallDiscountPercent ?? 0)) / 100);
  const tax = Math.round((afterLines - discount) * 0.1);
  return { computed, subtotal, discount, tax, total: afterLines - discount + tax };
}

export const prismaService: DataService = {
  mode: "prisma",

  async listCustomers(q?: string, status?: string): Promise<CustomerRow[]> {
    const query = (q ?? "").trim();
    const where = query
      ? {
          OR: [
            { name: { contains: query } }, { company: { contains: query } },
            { phone: { contains: query } }, { email: { contains: query } },
            { industry: { contains: query } }, { city: { contains: query } },
          ],
        }
      : {};
    const rows = await db().customer.findMany({
      where: status ? { ...where, status } : where,
      include: { _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows as unknown as CustomerRow[];
  },

  async getCustomer(id): Promise<CustomerDetail | null> {
    const c = await db().customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        deals: { orderBy: { updatedAt: "desc" }, include: { customer: { select: { id: true, company: true, name: true } } } },
        activity: { include: { user: { select: { id: true, name: true, color: true } }, deal: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
        tasks: { include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } }, orderBy: { dueDate: "asc" } },
        quotes: { orderBy: { createdAt: "desc" }, include: { customer: { select: { id: true, company: true, name: true, phone: true } }, _count: { select: { items: true } } } },
        _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } },
      },
    });
    return c as unknown as CustomerDetail | null;
  },

  async createCustomer(data: CustomerCreate) {
    return db().customer.create({ data: { ...data, createdAt: new Date() }, include: { _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } } } }) as unknown as CustomerRow;
  },

  async updateCustomer(id, data) {
    return db().customer.update({ where: { id }, data, include: { _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } } } }) as unknown as CustomerRow;
  },

  async deleteCustomer(id) {
    await db().customer.delete({ where: { id } });
  },

  async createCustomerActivity(id, data) {
    return db().activity.create({
      data: { type: data.type, title: data.title, content: data.content ?? null, customerId: id, userId: data.userId ?? null },
      include: { user: { select: { id: true, name: true, color: true } }, customer: { select: { id: true, company: true } } },
    }) as unknown as ActivityRow;
  },

  async listDeals(stage?: string): Promise<DealRow[]> {
    return db().deal.findMany({
      where: stage ? { stage } : {},
      include: { customer: { select: { id: true, company: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }) as unknown as DealRow[];
  },

  async createDeal(data: DealCreate) {
    return db().deal.create({
      data: {
        title: data.title,
        customerId: data.customerId,
        value: Number(data.value) || 0,
        stage: data.stage ?? "lead",
        probability: Number(data.probability) || 20,
        source: data.source ?? null,
        expectedClose: data.expectedClose ?? null,
        description: data.description ?? null,
      },
      include: { customer: { select: { id: true, company: true, name: true } } },
    }) as unknown as DealRow;
  },

  async updateDeal(id, data) {
    const d: Record<string, unknown> = {};
    for (const k of ["title", "stage", "source", "description"]) if (k in data && data[k as keyof typeof data] !== undefined) d[k] = data[k as keyof typeof data];
    if ("value" in data && data.value !== undefined) d.value = Number(data.value) || 0;
    if ("probability" in data && data.probability !== undefined) d.probability = Number(data.probability) || 0;
    if ("customerId" in data && data.customerId) d.customerId = data.customerId;
    if ("expectedClose" in data) d.expectedClose = data.expectedClose ?? null;
    return db().deal.update({ where: { id }, data: d, include: { customer: { select: { id: true, company: true, name: true } } } }) as unknown as DealRow;
  },

  async deleteDeal(id) {
    await db().deal.delete({ where: { id } });
  },

  async listTasks(status?: string, assigneeId?: string): Promise<TaskRow[]> {
    return db().task.findMany({
      where: { ...(status ? { status } : {}), ...(assigneeId ? { assigneeId } : {}) },
      include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }) as unknown as TaskRow[];
  },

  async createTask(data: TaskCreate) {
    return db().task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "todo",
        priority: data.priority ?? "medium",
        dueDate: data.dueDate ?? null,
        assigneeId: data.assigneeId || null,
        customerId: data.customerId || null,
        dealId: data.dealId || null,
      },
      include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } },
    }) as unknown as TaskRow;
  },

  async updateTask(id, data) {
    const d: Record<string, unknown> = {};
    for (const k of ["title", "description", "status", "priority", "assigneeId", "customerId", "dealId"]) {
      if (k in data && data[k as keyof typeof data] !== undefined) d[k] = (data[k as keyof typeof data] as string) === "" ? null : data[k as keyof typeof data];
    }
    if ("dueDate" in data) d.dueDate = data.dueDate ?? null;
    return db().task.update({
      where: { id }, data: d,
      include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } },
    }) as unknown as TaskRow;
  },

  async deleteTask(id) {
    await db().task.delete({ where: { id } });
  },

  async listUsers(): Promise<UserRow[]> {
    return db().user.findMany({ orderBy: { createdAt: "asc" } }) as unknown as UserRow[];
  },

  async listProducts(): Promise<ProductRow[]> {
    return db().product.findMany({ where: { active: true }, orderBy: { name: "asc" } }) as unknown as ProductRow[];
  },

  async listQuotes(): Promise<QuoteRow[]> {
    return db().quote.findMany({
      include: { customer: { select: { id: true, company: true, name: true, phone: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }) as unknown as QuoteRow[];
  },

  async getQuote(id) {
    return db().quote.findUnique({ where: { id }, include: { customer: true, items: { include: { product: true } } } }) as unknown as QuoteRow | null;
  },

  async createQuote(data: QuoteCreate) {
    const { computed, subtotal, discount, tax, total } = computeTotals(data.items as ItemInput[], Number(data.discountPercent) || 0);
    const count = await db().quote.count();
    return db().quote.create({
      data: {
        number: `RF-${faYear()}-${String(count + 1).padStart(4, "0")}`,
        customerId: data.customerId,
        status: data.status ?? "draft",
        validUntil: data.validUntil ?? new Date(Date.now() + 30 * 86400000),
        notes: data.notes ?? null,
        items: {
          create: computed.map((it: ItemInput & { lineTotal: number }) => ({
            productId: it.productId || null, name: it.name,
            quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0,
            discount: Number(it.discount) || 0, lineTotal: it.lineTotal,
          })),
        },
        subtotal, discount, tax, total,
      },
      include: { items: true, customer: true },
    }) as unknown as QuoteRow;
  },

  async updateQuote(id, body: QuoteUpdateBody) {
    const current = await db().quote.findUnique({ where: { id }, include: { items: true } });
    if (!current) return null;
    if (body.status && !("items" in body)) {
      return db().quote.update({ where: { id }, data: { status: body.status } }) as unknown as QuoteRow;
    }
    if (!Array.isArray(body.items) || body.items.length === 0) return current as unknown as QuoteRow;
    const { computed, subtotal, discount, tax, total } = computeTotals(body.items as ItemInput[], Number(body.discountPercent) || 0);
    await db().quoteItem.deleteMany({ where: { quoteId: id } });
    return db().quote.update({
      where: { id },
      data: {
        customerId: body.customerId ?? current.customerId,
        status: body.status ?? current.status,
        validUntil: "validUntil" in body ? body.validUntil : current.validUntil,
        notes: "notes" in body ? body.notes : current.notes,
        items: {
          create: computed.map((it: ItemInput & { lineTotal: number }) => ({
            productId: it.productId || null, name: it.name,
            quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0,
            discount: Number(it.discount) || 0, lineTotal: it.lineTotal,
          })),
        },
        subtotal, discount, tax, total,
      },
      include: { items: true, customer: true },
    }) as unknown as QuoteRow;
  },

  async deleteQuote(id) {
    await db().quoteItem.deleteMany({ where: { quoteId: id } });
    await db().quote.delete({ where: { id } });
  },

  async listWorkflows(): Promise<WorkflowRow[]> {
    const rows = await db().workflow.findMany({ include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "asc" } });
    const withStats = await Promise.all(
      rows.map(async (w) => {
        const total = await db().workflowRun.count({ where: { workflowId: w.id } });
        const success = await db().workflowRun.count({ where: { workflowId: w.id, status: "success" } });
        return {
          ...w,
          nodes: JSON.parse(w.nodes) as never,
          edges: JSON.parse(w.edges) as never,
          lastRun: w.runs[0] ? { id: w.runs[0].id, status: w.runs[0].status, startedAt: w.runs[0].startedAt } : null,
          runCount: total,
          successRate: total > 0 ? Math.round((success / total) * 100) : null,
        };
      })
    );
    return withStats as unknown as WorkflowRow[];
  },

  async getWorkflow(id): Promise<WorkflowDetail | null> {
    const wf = await db().workflow.findUnique({
      where: { id },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 10, include: { nodeRuns: true } } },
    });
    if (!wf) return null;
    const runs = wf.runs
      .map((r) => ({ ...r, nodeRuns: r.nodeRuns.slice().sort((a, b) => new Date(a.startedAt ?? a.id).getTime() - new Date(b.startedAt ?? b.id).getTime()) }))
      .map((r) => ({ ...r })) as unknown as WorkflowDetail["runs"];
    return { ...wf, nodes: JSON.parse(wf.nodes), edges: JSON.parse(wf.edges), runs } as unknown as WorkflowDetail;
  },

  async createWorkflow(data: WorkflowCreate) {
    const wf = await db().workflow.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive ?? false,
        nodes: JSON.stringify(data.nodes ?? []),
        edges: JSON.stringify(data.edges ?? []),
      },
    });
    return { ...wf, nodes: JSON.parse(wf.nodes), edges: JSON.parse(wf.edges) } as unknown as WorkflowRow;
  },

  async updateWorkflow(id, data) {
    const d: Record<string, unknown> = {};
    if ("name" in data && data.name !== undefined) d.name = data.name;
    if ("description" in data) d.description = data.description;
    if ("isActive" in data && data.isActive !== undefined) d.isActive = data.isActive;
    if ("nodes" in data && data.nodes) d.nodes = JSON.stringify(data.nodes);
    if ("edges" in data && data.edges) d.edges = JSON.stringify(data.edges);
    const wf = await db().workflow.update({ where: { id }, data: d });
    return { ...wf, nodes: JSON.parse(wf.nodes), edges: JSON.parse(wf.edges) } as unknown as WorkflowRow;
  },

  async deleteWorkflow(id) {
    await db().workflow.delete({ where: { id } });
  },

  async createRun(workflowId, testData) {
    const run = await db().workflowRun.create({ data: { workflowId, testData: JSON.stringify(testData ?? {}), status: "running" } });
    return run.id;
  },

  async finishRun(runId, status, duration) {
    await db().workflowRun.update({ where: { id: runId }, data: { status, finishedAt: new Date(), duration } });
  },

  async createNodeRun(runId, data: NodeRunCreate) {
    const nr = await db().workflowNodeRun.create({
      data: {
        runId, nodeId: data.nodeId, nodeName: data.nodeName, nodeType: data.nodeType, status: data.status,
        logs: data.logs ?? null, error: data.error ?? null, output: data.output ?? null,
        startedAt: data.startedAt ?? new Date(), finishedAt: data.finishedAt ?? null,
      },
    });
    return nr.id;
  },

  async updateNodeRun(id, patch: NodeRunPatch) {
    await db().workflowNodeRun.update({ where: { id }, data: patch });
  },

  async listNodeRuns(runId): Promise<NodeRunRow[]> {
    const rows = await db().workflowNodeRun.findMany({ where: { runId }, orderBy: { startedAt: "asc" } });
    return rows.slice().sort((a, b) => new Date(a.startedAt ?? a.id).getTime() - new Date(b.startedAt ?? b.id).getTime()) as unknown as NodeRunRow[];
  },

  async getDashboardRaw(): Promise<DashboardRaw> {
    const [customers, deals, tasks, quotes, activities, users] = await Promise.all([
      db().customer.findMany({ include: { _count: { select: { deals: true, activity: true, tasks: true, quotes: true, contacts: true } } } }),
      db().deal.findMany({ include: { customer: { select: { id: true, company: true, name: true } } } }),
      db().task.findMany({ include: { assignee: true, customer: { select: { id: true, company: true } }, deal: { select: { id: true, title: true } } } }),
      db().quote.findMany({ include: { customer: { select: { id: true, company: true, name: true, phone: true } }, _count: { select: { items: true } } } }),
      db().activity.findMany({
        include: { customer: { select: { id: true, company: true } }, user: { select: { id: true, name: true, color: true } }, deal: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db().user.findMany(),
    ]);
    return { customers, deals, tasks, quotes, activities, users } as unknown as DashboardRaw;
  },

  async searchAll(q) {
    const query = q.trim();
    const [customers, deals, tasks, quotes] = await Promise.all([
      db().customer.findMany({ where: { OR: [{ company: { contains: query } }, { name: { contains: query } }, { phone: { contains: query } }, { email: { contains: query } }] }, take: 5, select: { id: true, company: true, name: true, phone: true } }),
      db().deal.findMany({ where: { title: { contains: query } }, take: 5, include: { customer: { select: { company: true } } } }),
      db().task.findMany({ where: { title: { contains: query } }, take: 5, include: { customer: { select: { company: true } } } }),
      db().quote.findMany({ where: { number: { contains: query } }, take: 5, include: { customer: { select: { company: true } } } }),
    ]);
    return { customers, deals, tasks, quotes } as unknown as DataService["searchAll"] extends Promise<infer T> ? T : never;
  },
};

export type { QuoteItemInput };
