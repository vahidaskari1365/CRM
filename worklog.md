# Worklog — رودین CRM (نرم‌افزار CRM و اتوماسیون سازمانی)

---
Task ID: 1-5
Agent: orchestrator (Z.ai Code main)
Task: راه‌اندازی زیرساخت کامل پروژه — اسکیل‌ها، دیتابیس، API، تم

Work Log:
- کلون ۱۵ اسکیل درخواستی از GitHub در /home/z/skills (taste-skill-plugin, ui-ux-pro-max, claude-seo, magicui*, awesome-copilot, OmniRoute, awesome-free-llm-apis, Agent-Reach, ECC, mattpocock-skills, ai-engineering-hub)
- اسکیل‌های داخلی بارگذاری شد: impeccable (Operate mode), awesome-design-md (Linear reference), LLM (z-ai-web-dev-sdk)
- نصب @xyflow/react@12 برای فرآیندساز بصری
- Prisma schema کامل: User, Customer, Contact, Deal, Activity, Task, Product, Quote, QuoteItem, Workflow, WorkflowRun, WorkflowNodeRun → db:push انجام شد
- Seed با داده واقع‌گرایانه فارسی: ۴ کاربر، ۱۰ مشتری، ۱۴ فرصت، ~۸۰ فعالیت در ۶ ماه، ۱۲ وظیفه، ۱۰ محصول، ۵ پیش‌فاکتور، ۲ فرآیند نمونه
- Design system: «Quiet Precision» الهام از Linear — سطوح خنثی، hairline borders، یک رنگ تأکیدی (accent قابل تغییر ۸ رنگ از طریق store)، Vazirmatn، RTL کامل، تم تاریک پیش‌فرض
- globals.css: tokens + orb animations + shimmer + workflow node states (success/failed/running) + kanban styles + print styles پیش‌فاکتور
- src/lib/format.ts: توابع فرمت فارسی (faNum, faMoney, faDate شمسی, faRelativeDue, DEAL_STAGES, TASK_PRIORITIES, ACTIVITY_TYPES, QUOTE_STATUS + helperهای label/color)
- src/lib/crm-store.ts: zustand store (section, accent, sidebar, openCustomerId, navigate)
- src/lib/types.ts: تمام قراردادهای API (DTOها + WfNode/WfEdge/RunDto + WF_NODE_TYPES)
- src/components/crm/providers.tsx: next-themes (dark پیش‌فرض) + TanStack Query + accent sync روی CSS vars

API Routes (همگی آماده):
- GET /api/dashboard → DashboardDto (kpis, stageStats, monthly{key,revenue,newDeals,activities}, topCustomers, sources, taskStats, activityTypes, recentActivities, upcomingTasks, insights[])
- POST /api/ai/insights → {analysis: string} (LLM تحلیل فارسی، ممکن است ۵-۱۵ ثانیه طول بکشد؛ خطای 503 در صورت عدم دسترس)
- GET/POST /api/customers, GET/PUT/DELETE /api/customers/[id], POST /api/customers/[id]/activities
- GET/POST /api/deals, PUT/DELETE /api/deals/[id] (stage با drag&drop آپدیت می‌شود)
- GET/POST /api/tasks, PUT/DELETE /api/tasks/[id]
- GET /api/users، GET /api/products
- GET/POST /api/quotes (POST: items[], discountPercent → محاسبه خودکار مالیات ۱۰٪), GET/PUT/DELETE /api/quotes/[id] (PUT با status فقط = تغییر وضعیت)
- GET/POST /api/workflows, GET/PUT/DELETE /api/workflows/[id] (GET شامل runs اخیر با nodeRuns)
- POST /api/workflows/[id]/run body:{testData: object} → RunDto کامل با nodeRuns مرتب‌شده (اجرای واقعی: ساخت وظیفه/فعالیت واقعی در DB، شرط با داده تستی ارزیابی می‌شود، خطاها به فارسی)
- POST /api/reports/preview body:ReportRequest → ReportResponse (rows[{label,value}])
- GET /api/search?q= → {customers,deals,tasks,quotes}

Stage Summary:
- قراردادها در src/lib/types.ts — کامپوننت‌ها فقط با این DTOها کار کنند
- فرمت‌ها از src/lib/format.ts (اعداد/تاریخ فارسی)
- Accent از useCrmStore((s)=>s.accent) و رنگ اصلی با کلاس‌های primary Tailwind
- کامپوننت‌های shadcn در src/components/ui آماده (کل ست New York)
- فرآیند نمونه «فرآیند پیگیری سرنخ جدید» با شرط dealValue > 100000000 سید شده — testData پیش‌فرض: {dealValue: 150000000, customerName: "شرکت پارس فناوری", customerId: <اولین مشتری>}

---
Task ID: 6-a
Agent: general-purpose (dashboard)
Task: ماژول داشبورد گرافیکی

Work Log:
- مطالعه worklog، قرارداد DashboardDto در src/lib/types.ts، helperهای src/lib/format.ts و crm-store (navigate با payload customerId)
- بررسی APIهای /api/dashboard (GET، refetchInterval=60s) و /api/ai/insights (فقط GET exported — طبق دستور با GET صدا زده شد)
- ساخت src/components/crm/dashboard.tsx (تک‌فایل، ~۹۴۱ خط، strict typing بدون any):
  1) هیرو: گرادیان from-primary/10 + سه orb متحرک (.orb/.orb-2/.orb-3)، تاریخ شمسی امروز (faDateLong با useSyncExternalStore برای جلوگیری از hydration mismatch)، دکمه تحلیل هوشمند (Sparkles) و رفرش (RefreshCw با animate-spin هنگام isFetching)
  2) پنل تحلیل هوشمند: useQuery با enabled روی aiOpen و staleTime 5min؛ هنگام لود shimmer؛ رندر مارک‌داون‌مانند (خط با "- " → آیتم بولت‌دار، **x** → <strong>)؛ خطا → toast.error سونر + کارت داخلی تلاش مجدد؛ data.insights قانون‌محور با آیکون Lightbulb و ورود staggered
  3) ردیف KPI شش‌گانه (grid 2/3/6): مشتریان فعال (+X سرنخ)، ارزش قیف باز (openDeals فرصت)، فروش ماه جاری، نرخ تبدیل (رینگ SVG متحرک + آیکون Percent)، وظایف باز (+X فوری destructive)، پیش‌فاکتورهای فعال؛ هوک useCountUp با animate(0, value, {duration:1.2, onUpdate}) از framer-motion؛ هر کارت clickable → navigate به بخش مربوط (با role=button و کیبورد)
  4) شبکه نمودارها (lg:grid-cols-2، همه داخل dir=ltr با ResponsiveContainer h=280 و tick فارسی fontSize 11):
     - AreaChart روند فروش/فرصت جدید از data.monthly (faMonth(key+"-01")) با tooltip فارسی و دکمه دانلود CSV (Blob + BOM، هدر لاتین)
     - دونات ترکیب قیف از stageStats با stageColor و برچسب مرکزی faMoney + لجند chip قابل کلیک (toggle برش‌ها با aria-pressed)
     - BarChart ارزش به تفکیک مرحله با رنگ مرحله، radius بالا و LabelList با faMoney
     - HorizontalBar مشتریان برتر (layout=vertical) + Badge تعداد کل فرصت‌ها و LabelList faMoney فشرده
     - RadarChart کانال‌های ورودی از sources (fallback BarChart در صورت <3 کانال)
     - دونات وضعیت وظایف (#f59e0b/#06b6d4/#10b981) + دونات انواع فعالیت با رنگ‌های ACTIVITY_TYPES
  5) دو ستون پایانی: تایم‌لاین فعالیت‌های اخیر (نقطه رنگی per type، چیپ شرکت clickable → navigate("customers",{customerId})، زمان نسبی «X ساعت پیش» + faDateLong) و وظایف پیش‌رو (نوار رنگ اولویت، بج faRelativeDue با destructive/amber، آواتار دایره‌ای رنگ مسئول با حرف اول، کلیک → navigate("tasks"))
  6) Skeleton با shimmer هم‌چیدمان هنگام isLoading و کارت خطا با دکمه تلاش مجدد هنگام خطای fetch
- پالت نمودار از getComputedStyle روی --chart-1..5 (+fallback کملیست) با همگام‌سازی روی تغییر accent؛ tooltipها کامپوننت فارسی مستقل؛ تست: tsc --noEmit صفر خطا برای این فایل و eslint exit 0

Stage Summary:
- خروجی: src/components/crm/dashboard.tsx (default export DashboardModule، 'use client') — آماده mount در app shell (Task 7: section==="dashboard")
- قراردادهای مورد اتکا: GET /api/dashboard → DashboardDto کامل (kpis، stageStats، monthly{key،revenue،newDeals،activities}، topCustomers، sources، taskStats، activityTypes، recentActivities(8)، upcomingTasks(6)، insights[])؛ GET /api/ai/insights → {analysis: string} (احتمال 503 و کندی ۵-۱۵ثانیه هندل شده)
- تصمیم‌ها: فقط یک فایل ساخته/دستکاری شد (بدون تغییر فایل‌های موجود)؛ navigating فقط از طریق useCrmStore.navigate؛ رنگ‌ها فقط از توکن‌های primary/chart + stageColor/priorityColor — بدون indigo/blue؛ اعداد و تاریخ‌ها با helperهای فارسی format.ts
---
Task ID: 6-c
Agent: general-purpose (workflows)
Task: فرآیندساز بصری n8n-like با تست واقعی

Work Log:
- مطالعه قراردادها در src/lib/types.ts (WfNode/WfEdge/WorkflowDto/RunDto/NodeRunDto/WF_NODE_TYPES)، فرمت‌های src/lib/format.ts، کلاس‌های .wf-node-*/.pulse-dot در globals.css و هر سه route ی workflows (لیست/جزئیات با runs/run با موتور واقعی)
- ساخت تک‌فایل src/components/crm/workflows.tsx (default export WorkflowsModule) — ۸۷۵ خط، بدون تغییر سایر فایل‌ها
- LIST: هدر + کارت‌های stagger شده (faNum/faPercent/faDateTime + دات وضعیت آخرین اجرا + Badge فعال/غیرفعال)، ویرایش/اجرای تست/حذف با AlertDialog، Empty state با pulse-dot، Skeleton لودینگ
- EDITOR: پالت ۹ نوع گره (آیکون lucide از رشته + رنگ WF_NODE_TYPES)، بوم React Flow v12 در div dir="ltr" با Background دات‌ها/Controls/MiniMap ماسک‌شده، نود سفارشی «crm» با chip آیکونی، هندل شرط true/false («بله» زمردی/«خیر» قرمز)، نوار ابزار (نام/توضیح inline، ذخیره با اعتبارسنجی «فرآیند بدون گره شروع قابل ذخیره نیست»، اجراهای اخیر، اجرای تست، بازگشت با ArrowRight)
- پنل تنظیمات inline زیر پالت (framer-motion): فیلدهای نوع‌محور — شرط (عبارت mono + chip متغیرها)، create_task ({{customerName}} + اولویت)، notify، add_activity، update_deal (مرحله/احتمال)، http، delay (max 3000)، دکمه اعمال/حذف گره
- RUN دیالوگ (sm:max-w-5xl، h-[90vh]، موبایل تمام‌ارتفاع): داده تستی JSON با تمپلیت پیش‌فرض + customerId اولین مشتری از /api/customers، اجرای واقعی POST /run، پخش انیمیشنی playIndex با گام ۵۰۰ms، وضعیت گره‌ها از طریق NodeStatusContext به بوم تزریق می‌شود (wf-node-running/success/failed)، پنل «مسیر اجرا» سمت راست با کانکتور خطی، لاگ‌های بازشدنی، مدت هر گره، Alert خطا + failureHint + دکمه «رفتن به ویرایشگر و اصلاح این گره»، بنر موفقیت/شکست + chip آثار ساخته‌شده (createdTaskTitle/notified/dealStage) + کانتکست نهایی، invalidate ["workflows"]
- Drawer تاریخچه اجراها (GET /api/workflows/[id]) با بازشدن nodeRuns و دات‌های رنگی
- رفع خطاهای lint: import مقداری WF_NODE_TYPES، حذف ref-update در رندر (template با useMemo)، حذف setState داخل effect (ریست با remount از طریق key، انتخاب گره خطادار با state اولیه)، دسترسی مستقیم به ICONS به‌جای فراخوانی helper در رندر
- tsc --noEmit و eslint هر دو برای این فایل clean شدند

Stage Summary:
- تنها فایل ساخته‌شده: src/components/crm/workflows.tsx (default export WorkflowsModule) — list/editor/run همگی در همین فایل
- پخش اجرا: playIndex در RunDialog؛ نگاشت nodeId→success/failed/running با Context به نودهای بوم ویرایشگر (حتی از حالت list)
- مقادیر successRate بک‌اند ۰-۱۰۰ است؛ drawer تاریخچه از GET detail (runs + nodeRuns) استفاده می‌کند
- دیالوگ تست با key={runOpen} remount می‌شود تا state هر بار ریست شود؛ فرآیند جدید با isActive:true ذخیره می‌شود
---
Task ID: 6-b
Agent: general-purpose (customers/deals/tasks)
Task: ماژول‌های مشتریان، فرصت فروش (کانبان)، وظایف

Work Log:
- customers.tsx (867 خط): جدول دسکتاپ + کارت موبایل (hidden md:block / md:hidden)، جستجوی debounce ۳۰۰ms با ?q= و تب وضعیت (همه/فعال/سرنخ/غیرفعال)، دیالوگ افزودن/ویرایش (۱۰ فیلد + Select صنعت ۱۱گانه)، AlertDialog حذف، شیت جزئیات sm:max-w-xl با ۴ تب (نمای کلی/فرصت‌ها/سوابق ارتباط/وظایف-پیش‌فاکتورها)، تایم‌لاین فعالیت با آیکون Phone/Calendar/Mail/StickyNote و فرم inline «افزودن فعالیت» → POST /api/customers/[id]/activities. شیت با store (openCustomerId) باز می‌شود و row-click هم همان مسیر.
- deals.tsx (750 خط): کانبان ۶ ستونه DEAL_STAGES با min-w-[260px] و اسکرول افقی؛ درگ‌اند‌دراپ HTML5 بومی — نکته فنی: framer-motion رویداد onDragStart بومی را فیلتر می‌کند بنابراین draggable روی div بیرونی و انیمیشن layout/entrance روی motion داخلی؛ آپدیت optimistic مرحله با onMutate + rollback در onError + invalidate و توست «فرصت به مرحله X منتقل شد»؛ پالس scale برای won. کارت: عنوان line-clamp-2، چیپ مشتری → navigate("customers",{customerId})، faMoney، Progress احتمال، بوردر بالایی ۴px به رنگ مرحله. تب کانبان/جدول با مرتب‌سازی (ارزش/مرحله/سررسید) + کارت موبایل. دیالوگ فرصت با Select مشتری، مبلغ لاتین ltr با پسوند «تومان»، Slider احتمال، منشأ، تاریخ میلادی ltr.
- tasks.tsx (783 خط): ۴ کارت آمار کلیک‌پذیر (عقب‌افتاده/امروز/این هفته/انجام‌شده این هفته) با فیلتر quickFilter قابل لغو؛ تب‌های وضعیت + فوری و Select مسئول از /api/users؛ گروه‌بندی سطلی: عقب‌افتاده (destructive)/امروز و فردا/این هفته/بعداً/بدون سررسید/انجام‌شده (تاشو با ChevronDown)؛ سطر وظیفه با دکمه سفارشی Circle/CheckCircle2 (toggle done↔todo با optimistic + motion scale)، بج اولویت با نقطه رنگی از priorityColor، بج faRelativeDue (overdue→destructive، soon→amber)، چیپ مشتری → navigate، آواتار مسئول با user.color. دیالوگ کامل با Selectهای کاربر/مشتری/فرصت.
- هر ۳ فایل: 'use client'، بدون any، فرچ با الگوی قرارداد پروژه (throw on !r.ok)، Skeletons با کلاس shimmer، ErrorCard با تلاش مجدد، ورود stagger با framer-motion، توست‌های sonner فارسی، اهداف لمسی ≥44px و aria-label فارسی. tsxها از eslint (react-hooks v6) و tsc بدون خطا گذشتند.

Stage Summary:
- دیالوگ‌ها با الگوی Wrapper+Body کلیددار (key=editing?.id) بازسازی شدند تاsetState داخل useEffect لازم نشود (سازگار با قاعده react-hooks/set-state-in-effect در Next 16)
- شیت مشتری مستقیماً از openCustomerId استور مشتق می‌شود (بدون state محلی open) و placeholderData:(prev)=>prev مانع پرش به اسکلتون در انیمیشن بستن است
- وضعیت مشتری: active|lead|inactive مطابق schema.prisma؛ بج‌ها emerald/amber/muted
- bucket «انجام‌شده این هفته» آمار بر اساس createdAt (TaskDto فیلد updatedAt ندارد) — فرض ثبت‌شده
- کلیدهای کوئری مشترک: ["customers", q, status] / ["customer", id] / ["deals"] / ["tasks", assigneeId] / ["users"] تا کش بین ماژول‌ها و دیالوگ‌ها به‌اشتراک گذاشته شود؛ حذف/ویرایش، ["dashboard"] را هم invalidate می‌کند
