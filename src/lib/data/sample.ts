// ─── داده نمونه رودین CRM — مشترک بین حالت حافظه و seed دیتابیس ───

const daysAgo = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d;
};
const daysAhead = (n: number, h = 10) => daysAgo(-n, h);

export function makeId(prefix = "c"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const USER_SEEDS = [
  { name: "سارا محمدی", email: "sara@roudin.ir", role: "admin", color: "#8b5cf6", phone: "0912-1112233" },
  { name: "امیر رضایی", email: "amir@roudin.ir", role: "manager", color: "#f59e0b", phone: "0912-2223344" },
  { name: "نگار کریمی", email: "negar@roudin.ir", role: "sales", color: "#10b981", phone: "0912-3334455" },
  { name: "پویا احمدی", email: "pouya@roudin.ir", role: "sales", color: "#ec4899", phone: "0912-4445566" },
];

export const CUSTOMER_SEEDS = [
  { name: "علی نادری", company: "پارس فناوران داده", phone: "021-88776655", email: "naderi@parsdata.ir", industry: "فناوری اطلاعات", city: "تهران", status: "active", tags: "کلیدی,VIP", notes: "مشتری کلیدی با سابقه ۳ ساله. بودجه سالانه خوب.", address: "تهران، خیابان ولیعصر، برج سایه" },
  { name: "مریم حسینی", company: "بازرگانی آرمان تجارت", phone: "021-77554433", email: "hosseini@arman.ir", industry: "بازرگانی", city: "تهران", status: "active", tags: "عمده", notes: "خریدهای فصلی حجم بالا.", address: "تهران، لاله‌زار نو" },
  { name: "حسین صادقی", company: "صنایع غذایی بهار", phone: "031-55667788", email: "sadeghi@baharfood.ir", industry: "مواد غذایی", city: "اصفهان", status: "active", tags: "صنعتی", notes: "نیازمند پیگیری فاکتور اسفند.", address: "اصفهان، شهرک صنعتی محمودآباد" },
  { name: "زهرا اکبری", company: "کلینیک سلامت پارس", phone: "051-44332211", email: "akbari@salamat.ir", industry: "سلامت", city: "مشهد", status: "active", tags: "خدماتی", notes: "علاقه‌مند به اتوماسیون نوبت‌دهی.", address: "مشهد، بلوار وکیل‌آباد" },
  { name: "رضا مقدم", company: "راه‌سازان البرز", phone: "026-33445566", email: "moghaddam@alborz.ir", industry: "راه و ساختمان", city: "کرج", status: "lead", tags: "جدید", notes: "سرنخ از نمایشگاه ساختمان.", address: "کرج، عظیمیه" },
  { name: "فاطمه یوسفی", company: "پوشاک ستاره", phone: "021-66778899", email: "yousefi@setareh.ir", industry: "مد و پوشاک", city: "تهران", status: "active", tags: "خرده‌فروشی", notes: "دنبال سیستم انبار و فروش.", address: "تهران، بازار تهران" },
  { name: "محمد قاسمی", company: "لجستیک سریع‌بر", phone: "041-55443322", email: "ghasemi@sarirbar.ir", industry: "حمل و نقل", city: "تبریز", status: "active", tags: "لجستیک", notes: "قرارداد سالانه در حال مذاکره.", address: "تبریز، جاده تهران" },
  { name: "شیرین مرادی", company: "آموزش‌گستر فردا", phone: "021-44556677", email: "moradi@farda.ir", industry: "آموزش", city: "تهران", status: "lead", tags: "جدید,وبسایت", notes: "فرم وبسایت پر شده. متقاضی CRM آموزشگاهی.", address: "تهران، سعادت‌آباد" },
  { name: "کامران وفایی", company: "پتروشیمی خلیج فارس", phone: "076-33221144", email: "vafaie@pgc.ir", industry: "انرژی", city: "عسلویه", status: "active", tags: "کلیدی,سازمانی", notes: "پروژه بزرگ اتوماسیون اداری.", address: "عسلویه، فاز ۲" },
  { name: "لیلا شریفی", company: "چاپ و نشر آریا", phone: "021-55667744", email: "sharifi@ariaprint.ir", industry: "چاپ", city: "تهران", status: "inactive", tags: "", notes: "کاهش تعامل طی ۶ ماه گذشته.", address: "تهران، خیابان انقلاب" },
];

export const PRODUCT_SEEDS = [
  { name: "نرم‌افزار CRM رودین - لایسنس کاربر", code: "CRM-USR", unit: "کاربر", price: 12_000_000, description: "لایسنس سالانه هر کاربر" },
  { name: "ماژول اتوماسیون اداری", code: "AUTO-01", unit: "سازمان", price: 180_000_000, description: "گردش کار، مکاتبات، فرم‌ساز" },
  { name: "ماژول گزارش‌ساز پیشرفته", code: "RPT-01", unit: "سازمان", price: 95_000_000, description: "داشبورد ساز و گزارش‌ساز گرافیکی" },
  { name: "ماژول انبار و موجودی", code: "INV-01", unit: "سازمان", price: 120_000_000, description: "مدیریت انبار چندگانه" },
  { name: "پیاده‌سازی و راه‌اندازی", code: "IMPL-01", unit: "پروژه", price: 85_000_000, description: "تحلیل، پیاده‌سازی، آموزش" },
  { name: "پشتیبانی سالانه طلایی", code: "SUP-G", unit: "سال", price: 65_000_000, description: "پشتیبانی ۲۴/۷ با SLA" },
  { name: "اپلیکیشن موبایل فروش", code: "APP-M", unit: "نسخه", price: 140_000_000, description: "اپ سفارشی iOS و Android" },
  { name: "یکپارچه‌سازی حسابداری", code: "INT-ACC", unit: "پروژه", price: 70_000_000, description: "اتصال به سپیدار، هلو و همکاران" },
  { name: "ماژول پیامک و اعلان", code: "SMS-01", unit: "سازمان", price: 25_000_000, description: "پیامک تراکنشی و اعلان داخلی" },
  { name: "سرور ابری اختصاصی", code: "SRV-C", unit: "ماه", price: 18_000_000, description: "هاست ابری اختصاصی در ایران" },
];

export const DEAL_SEEDS = [
  { title: "استقرار CRM سازمانی - ۵۰ کاربره", stage: "negotiation", value: 850_000_000, prob: 70, close: 12, source: "معرفی مشتری", cust: 3 },
  { title: "ماژول اتوماسیون اداری", stage: "proposal", value: 420_000_000, prob: 55, close: 25, source: "نمایشگاه", cust: 5 },
  { title: "سیستم فروش و انبار پوشاک", stage: "qualified", value: 310_000_000, prob: 40, close: 40, source: "وبسایت", cust: 1 },
  { title: "قرارداد سالانه پشتیبانی", stage: "won", value: 180_000_000, prob: 100, close: -20, source: "تماس سرد", cust: 0 },
  { title: "اتوماسیون نوبت‌دهی کلینیک", stage: "qualified", value: 260_000_000, prob: 35, close: 35, source: "وبسایت", cust: 3 },
  { title: "پلتفرم لجستیک هوشمند", stage: "negotiation", value: 640_000_000, prob: 65, close: 18, source: "معرفی مشتری", cust: 6 },
  { title: "پروژه اتوماسیون اداری کامل", stage: "proposal", value: 1_200_000_000, prob: 60, close: 30, source: "مناقصه", cust: 8 },
  { title: "CRM آموزشگاهی", stage: "lead", value: 95_000_000, prob: 15, close: 45, source: "وبسایت", cust: 7 },
  { title: "بازطراحی فرآیندهای فروش", stage: "won", value: 340_000_000, prob: 100, close: -45, source: "معرفی مشتری", cust: 2 },
  { title: "سرنخ نمایشگاه ساختمان", stage: "lead", value: 150_000_000, prob: 10, close: 60, source: "نمایشگاه", cust: 4 },
  { title: "ماژول گزارش‌ساز پیشرفته", stage: "won", value: 120_000_000, prob: 100, close: -70, source: "تماس سرد", cust: 9 },
  { title: "ادغام با نرم‌افزار حسابداری", stage: "lost", value: 220_000_000, prob: 0, close: -30, source: "مناقصه", cust: 2 },
  { title: "توسعه اپلیکیشن موبایل فروش", stage: "lost", value: 480_000_000, prob: 0, close: -55, source: "وبسایت", cust: 5 },
  { title: "سیستم پیگیری تولید", stage: "qualified", value: 275_000_000, prob: 30, close: 50, source: "تماس سرد", cust: 1 },
];

export function buildSampleDataset() {
  const users = USER_SEEDS.map((u, i) => ({
    id: `u_seed_${i}`,
    ...u,
    createdAt: daysAgo(200 - i * 5),
  }));

  const customers = CUSTOMER_SEEDS.map((c, i) => ({
    id: `cu_seed_${i}`,
    ...c,
    createdAt: daysAgo(180 - i * 15),
    contacts: [
      { id: `ct_seed_${i}a`, customerId: `cu_seed_${i}`, name: c.name, position: "مدیرعامل", phone: c.phone, email: c.email ?? null, isPrimary: true },
      { id: `ct_seed_${i}b`, customerId: `cu_seed_${i}`, name: ["نرگس توکلی", "سعید بیات", "الهه رستمی", "مهدی جعفری"][i % 4], position: "مدیر بازرگانی", phone: `0912-77${10000 + i * 137}`, email: `biz${i}@${(c.email ?? "a@b.ir").split("@")[1]}`, isPrimary: false },
    ],
  }));

  const deals = DEAL_SEEDS.map((d, i) => ({
    id: `d_seed_${i}`,
    title: d.title,
    customerId: customers[d.cust].id,
    value: d.value,
    stage: d.stage,
    probability: d.prob,
    source: d.source,
    expectedClose: daysAhead(d.close),
    description: "تماس‌های اولیه انجام شد. نیازمند پیگیری پیشنهاد فنی و اقتصادی.",
    createdAt: i < 8 ? daysAgo(150 - i * 12) : daysAgo(100 - i * 4),
    updatedAt: daysAgo(Math.max(0, 20 - i)),
  }));

  const types = ["call", "meeting", "email", "note"];
  const titles = ["تماس پیگیری", "جلسه دمو محصول", "ارسال پیشنهاد قیمت", "یادداشت جلسه", "جلسه مذاکره نهایی", "ارسال کاتالوگ"];
  const activities: {
    id: string; type: string; title: string; content: string; customerId: string; userId: string; createdAt: Date;
  }[] = [];
  for (let m = 0; m < 6; m++) {
    const count = 6 + m * 2;
    for (let j = 0; j < count; j++) {
      activities.push({
        id: `a_seed_${m}_${j}`,
        type: types[(m + j) % 4],
        title: titles[(m * 2 + j) % 6],
        content: "پیگیری روند مذاکره و هماهنگی مرحله بعد.",
        customerId: customers[(m * 7 + j * 3) % customers.length].id,
        userId: users[(j + m) % 4].id,
        createdAt: daysAgo(175 - m * 28 - (j % 24)),
      });
    }
  }

  const taskDefs = [
    { title: "تماس با مدیر بازرگانی پارس فناوران", priority: "urgent", status: "todo", due: 1, u: 0, c: 0 },
    { title: "ارسال نسخه نهایی پیش‌فاکتور به بهار", priority: "high", status: "in_progress", due: 2, u: 2, c: 2 },
    { title: "جلسه دمو با کلینیک سلامت پارس", priority: "high", status: "todo", due: 3, u: 1, c: 3 },
    { title: "پیگیری قرارداد لجستیک سریع‌بر", priority: "medium", status: "todo", due: 5, u: 3, c: 6 },
    { title: "آماده‌سازی گزارش ماهانه فروش", priority: "medium", status: "in_progress", due: 6, u: 1, c: null as number | null },
    { title: "به‌روزرسانی اطلاعات سرنخ‌های نمایشگاه", priority: "low", status: "todo", due: 8, u: 2, c: 4 },
    { title: "مذاکره نهایی پروژه عسلویه", priority: "urgent", status: "todo", due: 2, u: 0, c: 8 },
    { title: "تماس سرنخ آموزش‌گستر فردا", priority: "high", status: "done", due: -2, u: 3, c: 7 },
    { title: "ارسال قرارداد تمدید پشتیبانی", priority: "medium", status: "done", due: -5, u: 1, c: 1 },
    { title: "تحلیل دلایل رقابت‌های باخته", priority: "low", status: "todo", due: -1, u: 0, c: null as number | null },
  ];
  const tasks: { id: string; title: string; description: string | null; status: string; priority: string; dueDate: Date | null; assigneeId: string; customerId: string | null; dealId: string | null; createdAt: Date }[] = taskDefs.map((t, i) => ({
    id: `t_seed_${i}`,
    title: t.title,
    description: "جزئیات در جلسه هفتگی تیم فروش اعلام شده است.",
    status: t.status,
    priority: t.priority,
    dueDate: t.due >= 0 ? daysAhead(t.due) : daysAgo(-t.due),
    assigneeId: users[t.u].id,
    customerId: t.c === null ? null : customers[t.c].id,
    dealId: null,
    createdAt: daysAgo(30 - i),
  }));
  tasks.push(
    { id: "t_seed_x1", title: "پیگیری وصول مطالبات آرمان تجارت", description: null, status: "todo", priority: "high", dueDate: daysAgo(3), assigneeId: users[2].id, customerId: customers[1].id, dealId: null, createdAt: daysAgo(10) },
    { id: "t_seed_x2", title: "تماس قدردانی با چاپ و نشر آریا", description: null, status: "todo", priority: "low", dueDate: daysAgo(6), assigneeId: users[3].id, customerId: customers[9].id, dealId: null, createdAt: daysAgo(9) }
  );

  const products = PRODUCT_SEEDS.map((p, i) => ({ id: `p_seed_${i}`, ...p, active: true }));

  const quoteDefs = [
    { cust: 0, status: "approved", issued: 12, items: [0, 1, 4], discount: 5 },
    { cust: 2, status: "sent", issued: 6, items: [0, 2, 5], discount: 8 },
    { cust: 8, status: "sent", issued: 4, items: [0, 1, 2, 6], discount: 10 },
    { cust: 6, status: "draft", issued: 1, items: [0, 7], discount: 0 },
    { cust: 5, status: "rejected", issued: 25, items: [0, 3, 8], discount: 3 },
  ];
  const quotes = quoteDefs.map((q, qi) => {
    const items: { id: string; quoteId: string; productId: string; name: string; quantity: number; unitPrice: number; discount: number; lineTotal: number }[] = q.items.map((pi, ii) => ({
      id: `qi_seed_${qi}_${ii}`,
      quoteId: `q_seed_${qi}`,
      productId: products[pi].id,
      name: products[pi].name,
      quantity: 1 + ((pi * 7) % 40),
      unitPrice: products[pi].price,
      discount: pi % 3 === 0 ? 5 : 0,
      lineTotal: 0,
    }));
    for (const it of items) it.lineTotal = Math.round(it.quantity * it.unitPrice * (1 - it.discount / 100));
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const afterLines = items.reduce((s, it) => s + it.lineTotal, 0);
    const discount = Math.round((afterLines * q.discount) / 100);
    const taxed = afterLines - discount;
    const tax = Math.round(taxed * 0.1);
    return {
      id: `q_seed_${qi}`,
      number: `RF-1403-${String(qi + 1).padStart(4, "0")}`,
      customerId: customers[q.cust].id,
      status: q.status,
      issueDate: daysAgo(q.issued),
      validUntil: daysAhead(30 - q.issued > 0 ? 30 - q.issued : 5),
      subtotal,
      discount,
      tax,
      total: taxed + tax,
      notes: "قیمت‌ها تا پایان اعتبار پیش‌فاکتور معتبر است. پرداخت: ۵۰٪ پیش‌پرداخت.",
      createdAt: daysAgo(q.issued),
      items,
    };
  });

  const wfNodes1 = [
    { id: "start", type: "crm", position: { x: 60, y: 220 }, data: { label: "شروع", nodeType: "start", description: "ورود سرنخ جدید" } },
    { id: "cond", type: "crm", position: { x: 330, y: 200 }, data: { label: "فرصت بالای ۱۰۰ میلیون؟", nodeType: "condition", description: "بررسی ارزش فرصت", expression: "dealValue > 100000000" } },
    { id: "task1", type: "crm", position: { x: 630, y: 80 }, data: { label: "ایجاد وظیفه تماس فوری", nodeType: "create_task", description: "اولویت بالا برای سرنخ بزرگ", taskTitle: "تماس فوری با {{customerName}}", priority: "urgent" } },
    { id: "note1", type: "crm", position: { x: 930, y: 80 }, data: { label: "اعلان به مدیر فروش", nodeType: "notify", description: "اطلاع‌رسانی سرنخ کلیدی", message: "سرنخ بالای ۱۰۰ میلیون از {{customerName}} ثبت شد" } },
    { id: "note2", type: "crm", position: { x: 630, y: 350 }, data: { label: "ثبت در لیست پرورش", nodeType: "notify", description: "سرنخ کوچک‌تر به کمپین پرورش", message: "{{customerName}} به کمپین ایمیل مارکتینگ اضافه شد" } },
    { id: "act1", type: "crm", position: { x: 930, y: 260 }, data: { label: "ثبت فعالیت ورود سرنخ", nodeType: "add_activity", description: "در سوابق مشتری ثبت می‌شود", title: "سرنخ جدید دریافت شد" } },
    { id: "end", type: "crm", position: { x: 1220, y: 200 }, data: { label: "پایان", nodeType: "end", description: "" } },
  ];
  const wfEdges1 = [
    { id: "e1", source: "start", target: "cond", animated: true },
    { id: "e2", source: "cond", target: "task1", sourceHandle: "true", label: "بله" },
    { id: "e3", source: "cond", target: "note2", sourceHandle: "false", label: "خیر" },
    { id: "e4", source: "task1", target: "note1" },
    { id: "e5", source: "note1", target: "act1" },
    { id: "e6", source: "note2", target: "act1" },
    { id: "e7", source: "act1", target: "end", animated: true },
  ];
  const wfCarNodes = [
    { id: "car_start", type: "crm", position: { x: 40, y: 210 }, data: { label: "درخواست مشتری", nodeType: "start", description: "دریافت درخواست خرید خودرو" } },
    { id: "car_stock", type: "crm", position: { x: 330, y: 210 }, data: { label: "بررسی موجودی نمایشگاه", nodeType: "create_task", description: "بررسی موجودی خودروی درخواستی", taskTitle: "بررسی موجودی خودرو برای {{customerName}}", priority: "medium" } },
    { id: "car_cond", type: "crm", position: { x: 640, y: 195 }, data: { label: "خودرو آماده فروش هست؟", nodeType: "condition", description: "بررسی آماده بودن خودروی مورد نظر", expression: "carReady == true" } },
    { id: "car_finance", type: "crm", position: { x: 950, y: 60 }, data: { label: "بررسی مالی مشتری", nodeType: "create_task", description: "بررسی اعتبار و شرایط پرداخت", taskTitle: "بررسی مالی {{customerName}}", priority: "high" } },
    { id: "car_deliver", type: "crm", position: { x: 1250, y: 60 }, data: { label: "هماهنگی تحویل خودرو", nodeType: "notify", description: "زمان‌بندی آزمایش و تحویل", message: "قرار آزمایش و تحویل خودرو با {{customerName}} هماهنگ شد" } },
    { id: "car_info", type: "crm", position: { x: 950, y: 350 }, data: { label: "به مشتری اطلاع بده - ماشین به زودی می‌رسد", nodeType: "notify", description: "اطلاع‌رسانی زمان آماده شدن", message: "{{customerName}} عزیز، خودروی درخواستی به زودی به نمایشگاه می‌رسد" } },
    { id: "car_end", type: "crm", position: { x: 1550, y: 205 }, data: { label: "پایان", nodeType: "end", description: "" } },
  ];
  const wfCarEdges = [
    { id: "ce1", source: "car_start", target: "car_stock", animated: false },
    { id: "ce2", source: "car_stock", target: "car_cond", animated: false },
    { id: "ce3", source: "car_cond", target: "car_finance", sourceHandle: "true", label: "بله", animated: false },
    { id: "ce4", source: "car_cond", target: "car_info", sourceHandle: "false", label: "خیر", animated: false },
    { id: "ce5", source: "car_finance", target: "car_deliver", animated: false },
    { id: "ce6", source: "car_deliver", target: "car_end", animated: false },
    { id: "ce7", source: "car_info", target: "car_end", animated: false },
  ];
  const workflows = [
    {
      id: "w_seed_1",
      name: "فرآیند پیگیری سرنخ جدید",
      description: "نمونه فرآیند خودکار: بر اساس ارزش فرصت، وظیفه تماس فوری ساخته می‌شود یا سرنخ به کمپین پرورش ارسال می‌گردد.",
      isActive: true,
      nodes: wfNodes1,
      edges: wfEdges1,
      createdAt: daysAgo(20),
    },
    {
      id: "w_seed_2",
      name: "فرآیند تمدید قرارداد سالانه",
      description: "۳۰ روز مانده به انقضا → ساخت وظیفه پیگیری → ارسال اعلان → ثبت فعالیت.",
      isActive: false,
      nodes: [
        { id: "start2", type: "crm", position: { x: 100, y: 200 }, data: { label: "شروع", nodeType: "start", description: "نزدیک شدن انقضای قرارداد" } },
        { id: "cond2", type: "crm", position: { x: 400, y: 200 }, data: { label: "بیش از ۵۰ میلیون؟", nodeType: "condition", description: "قراردادهای مهم", expression: "contractValue > 50000000" } },
        { id: "task2", type: "crm", position: { x: 700, y: 100 }, data: { label: "وظیفه تماس تمدید", nodeType: "create_task", description: "", taskTitle: "پیگیری تمدید {{customerName}}", priority: "high" } },
        { id: "mail2", type: "crm", position: { x: 700, y: 330 }, data: { label: "ایمیل خودکار تمدید", nodeType: "notify", description: "", message: "ایمیل پیشنهاد تمدید برای {{customerName}} ارسال شد" } },
        { id: "end2", type: "crm", position: { x: 1000, y: 210 }, data: { label: "پایان", nodeType: "end", description: "" } },
      ],
      edges: [
        { id: "f1", source: "start2", target: "cond2" },
        { id: "f2", source: "cond2", target: "task2", sourceHandle: "true", label: "بله" },
        { id: "f3", source: "cond2", target: "mail2", sourceHandle: "false", label: "خیر" },
        { id: "f4", source: "task2", target: "end2" },
        { id: "f5", source: "mail2", target: "end2" },
      ],
      createdAt: daysAgo(18),
    },
    {
      id: "w_seed_3",
      name: "فروش خودرو (نمونه)",
      description: "نمونه فرآیند فروش خودرو: بررسی موجودی نمایشگاه، شاخه‌بندی بر اساس آماده بودن خودرو، بررسی مالی و هماهنگی تحویل یا اطلاع‌رسانی به مشتری.",
      isActive: true,
      nodes: wfCarNodes,
      edges: wfCarEdges,
      createdAt: daysAgo(15),
    },
  ];

  return { users, customers, deals, activities, tasks, products, quotes, workflows };
}
