import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const daysAgo = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d;
};
const daysAhead = (n: number, h = 10) => daysAgo(-n, h);

async function main() {
  console.log("🌱 Seeding رودین CRM ...");

  // Clean (order matters for FK)
  await db.workflowNodeRun.deleteMany();
  await db.workflowRun.deleteMany();
  await db.workflow.deleteMany();
  await db.quoteItem.deleteMany();
  await db.quote.deleteMany();
  await db.product.deleteMany();
  await db.task.deleteMany();
  await db.activity.deleteMany();
  await db.deal.deleteMany();
  await db.contact.deleteMany();
  await db.customer.deleteMany();
  await db.user.deleteMany();

  // ─── Users ───
  const users = await Promise.all(
    [
      { name: "سارا محمدی", email: "sara@roudin.ir", role: "admin", color: "#8b5cf6", phone: "0912-1112233" },
      { name: "امیر رضایی", email: "amir@roudin.ir", role: "manager", color: "#f59e0b", phone: "0912-2223344" },
      { name: "نگار کریمی", email: "negar@roudin.ir", role: "sales", color: "#10b981", phone: "0912-3334455" },
      { name: "پویا احمدی", email: "pouya@roudin.ir", role: "sales", color: "#ec4899", phone: "0912-4445566" },
    ].map((u) => db.user.create({ data: u }))
  );
  const [sara, amir, negar, pouya] = users;

  // ─── Customers ───
  const customerData = [
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

  const customers = [] as { id: string; company: string }[];
  for (let i = 0; i < customerData.length; i++) {
    const c = customerData[i];
    const cust = await db.customer.create({
      data: {
        ...c,
        createdAt: daysAgo(180 - i * 15),
        contacts: {
          create: [
            { name: c.name, position: "مدیرعامل", phone: c.phone, email: c.email, isPrimary: true },
            { name: ["نرگس توکلی", "سعید بیات", "الهه رستمی", "مهدی جعفری"][i % 4], position: "مدیر بازرگانی", phone: "0912-77" + (100000 + i * 137).toString().slice(0, 5), email: `biz${i}@${c.email!.split("@")[1]}` },
          ],
        },
      },
    });
    customers.push({ id: cust.id, company: cust.company });
  }

  // ─── Deals ───
  const dealDefs = [
    { title: "استقرار CRM سازمانی - ۵۰ کاربره", stage: "negotiation", value: 850_000_000, prob: 70, close: 12, source: "معرفی مشتری" },
    { title: "ماژول اتوماسیون اداری", stage: "proposal", value: 420_000_000, prob: 55, close: 25, source: "نمایشگاه" },
    { title: "سیستم فروش و انبار پوشاک", stage: "qualified", value: 310_000_000, prob: 40, close: 40, source: "وبسایت" },
    { title: "قرارداد سالانه پشتیبانی", stage: "won", value: 180_000_000, prob: 100, close: -20, source: "تماس سرد" },
    { title: "اتوماسیون نوبت‌دهی کلینیک", stage: "qualified", value: 260_000_000, prob: 35, close: 35, source: "وبسایت" },
    { title: "پلتفرم لجستیک هوشمند", stage: "negotiation", value: 640_000_000, prob: 65, close: 18, source: "معرفی مشتری" },
    { title: "پروژه اتوماسیون اداری کامل", stage: "proposal", value: 1_200_000_000, prob: 60, close: 30, source: "مناقصه" },
    { title: "CRM آموزشگاهی", stage: "lead", value: 95_000_000, prob: 15, close: 45, source: "وبسایت" },
    { title: "بازطراحی فرآیندهای فروش", stage: "won", value: 340_000_000, prob: 100, close: -45, source: "معرفی مشتری" },
    { title: "سرنخ نمایشگاه ساختمان", stage: "lead", value: 150_000_000, prob: 10, close: 60, source: "نمایشگاه" },
    { title: "ماژول گزارش‌ساز پیشرفته", stage: "won", value: 120_000_000, prob: 100, close: -70, source: "تماس سرد" },
    { title: "ادغام با نرم‌افزار حسابداری", stage: "lost", value: 220_000_000, prob: 0, close: -30, source: "مناقصه" },
    { title: "توسعه اپلیکیشن موبایل فروش", stage: "lost", value: 480_000_000, prob: 0, close: -55, source: "وبسایت" },
    { title: "سیستم پیگیری تولید", stage: "qualified", value: 275_000_000, prob: 30, close: 50, source: "تماس سرد" },
  ];
  const stageAssign = [3, 5, 1, 0, 3, 6, 8, 7, 2, 4, 9, 2, 5, 1];
  for (let i = 0; i < dealDefs.length; i++) {
    const d = dealDefs[i];
    const created = i < 8 ? daysAgo(150 - i * 12) : daysAgo(100 - i * 4);
    await db.deal.create({
      data: {
        title: d.title,
        customerId: customers[stageAssign[i]].id,
        value: d.value,
        stage: d.stage,
        probability: d.prob,
        source: d.source,
        expectedClose: daysAhead(d.close),
        description: "تماس‌های اولیه انجام شد. نیازمند پیگیری پیشنهاد فنی و اقتصادی.",
        createdAt: created,
        updatedAt: daysAgo(Math.max(0, 20 - i)),
      },
    });
  }

  // ─── Activities (۶ ماه گذشته برای نمودار روند) ───
  const types = ["call", "meeting", "email", "note"];
  const titles = ["تماس پیگیری", "جلسه دمو محصول", "ارسال پیشنهاد قیمت", "یادداشت جلسه", "جلسه مذاکره نهایی", "ارسال کاتالوگ"];
  for (let m = 0; m < 6; m++) {
    const count = 6 + m * 2; // روند صعودی
    for (let j = 0; j < count; j++) {
      const ci = (m * 7 + j * 3) % customers.length;
      await db.activity.create({
        data: {
          type: types[(m + j) % 4],
          title: titles[(m * 2 + j) % 6],
          content: "پیگیری روند مذاکره و هماهنگی مرحله بعد.",
          customerId: customers[ci].id,
          userId: users[(j + m) % 4].id,
          createdAt: daysAgo(175 - m * 28 - (j % 24)),
        },
      });
    }
  }

  // ─── Tasks ───
  const taskDefs = [
    { title: "تماس با مدیر بازرگانی پارس فناوران", priority: "urgent", status: "todo", due: 1, u: 0, c: 0 },
    { title: "ارسال نسخه نهایی پیش‌فاکتور به بهار", priority: "high", status: "in_progress", due: 2, u: 2, c: 2 },
    { title: "جلسه دمو با کلینیک سلامت پارس", priority: "high", status: "todo", due: 3, u: 1, c: 3 },
    { title: "پیگیری قرارداد لجستیک سریع‌بر", priority: "medium", status: "todo", due: 5, u: 3, c: 6 },
    { title: "آماده‌سازی گزارش ماهانه فروش", priority: "medium", status: "in_progress", due: 6, u: 1, c: null },
    { title: "به‌روزرسانی اطلاعات سرنخ‌های نمایشگاه", priority: "low", status: "todo", due: 8, u: 2, c: 4 },
    { title: "مذاکره نهایی پروژه عسلویه", priority: "urgent", status: "todo", due: 2, u: 0, c: 8 },
    { title: "تماس سرنخ آموزش‌گستر فردا", priority: "high", status: "done", due: -2, u: 3, c: 7 },
    { title: "ارسال قرارداد تمدید پشتیبانی", priority: "medium", status: "done", due: -5, u: 1, c: 1 },
    { title: "تحلیل دلایل رقابت‌های باخته", priority: "low", status: "todo", due: -1, u: 0, c: null },
  ];
  for (const t of taskDefs) {
    await db.task.create({
      data: {
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.due === null ? null : t.due >= 0 ? daysAhead(t.due) : daysAgo(-t.due),
        assigneeId: users[t.u].id,
        customerId: t.c === null ? null : customers[t.c].id,
        description: "جزئیات در جلسه هفتگی تیم فروش اعلام شده است.",
      },
    });
  }
  // چند وظیفه سررسید گذشته
  await db.task.create({ data: { title: "پیگیری وصول مطالبات آرمان تجارت", status: "todo", priority: "high", dueDate: daysAgo(3), assigneeId: negar.id, customerId: customers[1].id } });
  await db.task.create({ data: { title: "تماس قدردانی با چاپ و نشر آریا", status: "todo", priority: "low", dueDate: daysAgo(6), assigneeId: pouya.id, customerId: customers[9].id } });

  // ─── Products ───
  const productDefs = [
    { name: "نرم‌افزار CRM رودین - لایسنس کاربر", code: "CRM-USR", unit: "کاربر", price: 12_000_000, description: "لایسنس سالانه هر کاربر" },
    { name: "ماژول اتوماسیون اداری", code: "AUTO-01", unit: "سازمان", price: 180_000_000, description: "گردش کار، مکاتبات، فرم‌ساز" },
    { name: "ماژول گزارش‌ساز پیشرفته", code: "RPT-01", unit: "سازمان", price: 95_000_000, description: "داشبورد ساز و گزارش‌ساز گرافیکی" },
    { name: "ماژول انبار و موجودی", code: "INV-01", unit: "سازمان", price: 120_000_000, description: "مدیریت انبار چندگانه" },
    { name: "پیاده‌سازی و راه‌اندازی", code: "IMPL-01", unit: "پروژه", price: 85_000_000, description: "تحلیل، پیاده‌سازی، آموزش" },
    { name: "پشتیبانی سالانه طلایی", code: "SUP-G", unit: "سال", price: 65_000_000, description: "پشتیبانی ۲۴/۷ با SLA" },
    { name: "اپلیکیشن موبایل فروش", code: "APP-M", unit: "نسخه", price: 140_000_000, description: "اپ سفارشی iOS و Android" },
    { name: "یکپارچه‌سازی حسابداری", code: "INT-ACC", unit: "پروژه", price: 70_000_000, description: "اتصال به سپیدار، هلو و همکاران" },
    { name: "ماژول پیامک و اعلان", code: "SMS-01", unit: "سازمان", price: 25_000_000, description: "پیامک транاکتسی و اعلان داخلی" },
    { name: "سرور ابری اختصاصی", code: "SRV-C", unit: "ماه", price: 18_000_000, description: "هاست ابری اختصاصی در ایران" },
  ];
  const products: { id: string; name: string; price: number; unit: string; code: string }[] = [];
  for (const p of productDefs) {
    const pr = await db.product.create({ data: p });
    products.push({ id: pr.id, name: pr.name, price: pr.price, unit: pr.unit, code: pr.code });
  }

  // ─── Quotes (پیش‌فاکتورها) ───
  const quoteDefs = [
    { cust: 0, status: "approved", issued: 12, items: [0, 1, 4], discount: 5 },
    { cust: 2, status: "sent", issued: 6, items: [0, 2, 5], discount: 8 },
    { cust: 8, status: "sent", issued: 4, items: [0, 1, 2, 6], discount: 10 },
    { cust: 6, status: "draft", issued: 1, items: [0, 7], discount: 0 },
    { cust: 5, status: "rejected", issued: 25, items: [0, 3, 8], discount: 3 },
  ];
  let qNum = 1;
  for (const q of quoteDefs) {
    const itemsData = q.items.map((pi) => ({
      productId: products[pi].id,
      name: products[pi].name,
      quantity: 1 + ((pi * 7) % 40),
      unitPrice: products[pi].price,
      discount: pi % 3 === 0 ? 5 : 0,
    }));
    const subtotal = itemsData.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const afterItems = itemsData.reduce((s, it) => s + it.quantity * it.unitPrice * (1 - it.discount / 100), 0);
    const disc = Math.round((afterItems * q.discount) / 100);
    const taxed = afterItems - disc;
    const tax = Math.round(taxed * 0.1);
    await db.quote.create({
      data: {
        number: `RF-1403-${String(qNum).padStart(4, "0")}`,
        customerId: customers[q.cust].id,
        status: q.status,
        issueDate: daysAgo(q.issued),
        validUntil: daysAhead(30 - q.issued > 0 ? 30 - q.issued : 5),
        items: { create: itemsData.map((it) => ({ ...it, lineTotal: Math.round(it.quantity * it.unitPrice * (1 - it.discount / 100)) })) },
        subtotal,
        discount: disc,
        tax,
        total: taxed + tax,
        notes: "قیمت‌ها تا پایان اعتبار پیش‌فاکتور معتبر است. پرداخت: ۵۰٪ پیش‌پرداخت.",
      },
    });
    qNum++;
  }

  // ─── Sample Workflow (فرآیند نمونه) ───
  const wfNodes = [
    { id: "start", type: "crm", position: { x: 60, y: 220 }, data: { label: "شروع", nodeType: "start", description: "ورود سرنخ جدید" } },
    { id: "cond", type: "crm", position: { x: 330, y: 200 }, data: { label: "فرصت بالای ۱۰۰ میلیون؟", nodeType: "condition", description: "بررسی ارزش فرصت", expression: "dealValue > 100000000" } },
    { id: "task1", type: "crm", position: { x: 630, y: 80 }, data: { label: "ایجاد وظیفه تماس فوری", nodeType: "create_task", description: "اولویت بالا برای سرنخ بزرگ", taskTitle: "تماس فوری با {{customerName}}", priority: "urgent" } },
    { id: "note1", type: "crm", position: { x: 930, y: 80 }, data: { label: "اعلان به مدیر فروش", nodeType: "notify", description: "اطلاع‌رسانی سرنخ کلیدی", message: "سرنخ بالای ۱۰۰ میلیون از {{customerName}} ثبت شد" } },
    { id: "note2", type: "crm", position: { x: 630, y: 350 }, data: { label: "ثبت در لیست پرورش", nodeType: "notify", description: "سرنخ کوچک‌تر به کمپین پرورش", message: "{{customerName}} به کمپین ایمیل مارکتینگ اضافه شد" } },
    { id: "act1", type: "crm", position: { x: 930, y: 260 }, data: { label: "ثبت فعالیت ورود سرنخ", nodeType: "add_activity", description: "در سوابق مشتری ثبت می‌شود", title: "سرنخ جدید دریافت شد" } },
    { id: "end", type: "crm", position: { x: 1220, y: 200 }, data: { label: "پایان", nodeType: "end", description: "" } },
  ];
  const wfEdges = [
    { id: "e1", source: "start", target: "cond", animated: true },
    { id: "e2", source: "cond", target: "task1", sourceHandle: "true", label: "بله" },
    { id: "e3", source: "cond", target: "note2", sourceHandle: "false", label: "خیر" },
    { id: "e4", source: "task1", target: "note1" },
    { id: "e5", source: "note1", target: "act1" },
    { id: "e6", source: "note2", target: "act1" },
    { id: "e7", source: "act1", target: "end", animated: true },
  ];
  await db.workflow.create({
    data: {
      name: "فرآیند پیگیری سرنخ جدید",
      description: "نمونه فرآیند خودکار: بر اساس ارزش فرصت، وظیفه تماس فوری ساخته می‌شود یا سرنخ به کمپین پرورش ارسال می‌گردد.",
      isActive: true,
      nodes: JSON.stringify(wfNodes),
      edges: JSON.stringify(wfEdges),
    },
  });
  await db.workflow.create({
    data: {
      name: "فرآیند تمدید قرارداد سالانه",
      description: "۳۰ روز مانده به انقضا → ساخت وظیفه پیگیری → ارسال اعلان → ثبت فعالیت.",
      isActive: false,
      nodes: JSON.stringify([
        { id: "start2", type: "crm", position: { x: 100, y: 200 }, data: { label: "شروع", nodeType: "start", description: "نزدیک شدن انقضای قرارداد" } },
        { id: "cond2", type: "crm", position: { x: 400, y: 200 }, data: { label: "بیش از ۵۰ میلیون؟", nodeType: "condition", description: "قراردادهای مهم", expression: "contractValue > 50000000" } },
        { id: "task2", type: "crm", position: { x: 700, y: 100 }, data: { label: "وظیفه تماس تمدید", nodeType: "create_task", description: "", taskTitle: "پیگیری تمدید {{customerName}}", priority: "high" } },
        { id: "mail2", type: "crm", position: { x: 700, y: 330 }, data: { label: "ایمیل خودکار تمدید", nodeType: "notify", description: "", message: "ایمیل پیشنهاد تمدید برای {{customerName}} ارسال شد" } },
        { id: "end2", type: "crm", position: { x: 1000, y: 210 }, data: { label: "پایان", nodeType: "end", description: "" } },
      ]),
      edges: JSON.stringify([
        { id: "f1", source: "start2", target: "cond2" },
        { id: "f2", source: "cond2", target: "task2", sourceHandle: "true", label: "بله" },
        { id: "f3", source: "cond2", target: "mail2", sourceHandle: "false", label: "خیر" },
        { id: "f4", source: "task2", target: "end2" },
        { id: "f5", source: "mail2", target: "end2" },
      ]),
    },
  });

  const counts = {
    users: await db.user.count(),
    customers: await db.customer.count(),
    deals: await db.deal.count(),
    activities: await db.activity.count(),
    tasks: await db.task.count(),
    products: await db.product.count(),
    quotes: await db.quote.count(),
    workflows: await db.workflow.count(),
  };
  console.log("✅ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
