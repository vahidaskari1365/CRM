// ─────────────────────────────────────────────────────────────────
// wf-defaults — داده تستی هوشمند فرایندها (مشترک بین کلاینت و سرور)
// هدف: هیچ تستی به‌خاطر «متغیر تعریف‌نشده در داده تستی» شکست نخورد.
// متغیرهای عبارت شرط‌ها به‌صورت خودکار با مقدار پیش‌فرض منطقی پر می‌شوند.
// ─────────────────────────────────────────────────────────────────

/** حداقل شکل گره موردنیاز (هم WfNode و هم گره‌های بوم React Flow را می‌پذیرد) */
export interface WfLikeNode {
  data: {
    nodeType?: unknown;
    expression?: unknown;
    [k: string]: unknown;
  };
}

/** کلمات رزرو شده JS — نباید به‌عنوان متغیر/پارامتر در نظر گرفته شوند */
const RESERVED_WORDS = new Set([
  "true", "false", "null", "undefined", "this", "super",
  "new", "typeof", "instanceof", "in", "of", "void", "delete",
  "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
  "function", "return", "class", "extends", "const", "let", "var",
  "import", "export", "from", "as", "try", "catch", "finally", "throw",
  "yield", "await", "async", "enum", "implements", "interface", "package", "private", "protected", "public", "static",
]);

/** مقادیر پیش‌فرض منطقی برای متغیرهای شناخته‌شده فرایندهای نمونه */
export const KNOWN_TEST_VARS: Record<string, unknown> = {
  dealValue: 150000000,
  contractValue: 60000000,
  carReady: true,
  stockCount: 2,
  daysLeft: 25,
};

/** نام متغیر boolean-مانند؟ (isX/hasX/canX یا پسوندهای وضعیت) → پیش‌فرض true */
function looksBoolean(name: string): boolean {
  return /^(is|has|can|should)[A-Z_]/.test(name) || /(Ready|Active|Enabled|Available|Ok|Done|Exists|Valid)$/i.test(name);
}

/** نام متغیر متنی-مانند؟ (وضعیت/نام/نوع و…) → پیش‌فرض رشته */
const STRINGISH_VAR = /^(status|state|name|title|type|kind|stage|category|email|phone|city|note|text|label|code)$/i;

/** مقدار پیش‌فرض منطقی برای یک متغیر شرط */
export function defaultForVar(name: string): unknown {
  if (name in KNOWN_TEST_VARS) return KNOWN_TEST_VARS[name];
  if (looksBoolean(name)) return true;
  if (STRINGISH_VAR.test(name)) return "نمونه";
  return 100000000;
}

/**
 * همه شناسه‌های استفاده‌شده در عبارت شرط‌های فرایند را جمع می‌کند
 * (پشتیبانی از شناسه‌های لاتین و یونیکد مثل فارسی؛ true/false/null و کلمات رزرو حذف می‌شوند)
 */
export function collectExpressionVars(nodes: WfLikeNode[]): string[] {
  const out = new Set<string>();
  for (const n of nodes ?? []) {
    if (String(n?.data?.nodeType ?? "") !== "condition") continue;
    const expr = String(n?.data?.expression ?? "");
    for (const m of expr.match(/[\p{L}$_][\p{L}\p{N}_$]*/gu) ?? []) {
      if (RESERVED_WORDS.has(m)) continue;
      out.add(m);
    }
  }
  return [...out];
}

/**
 * داده تستی کاربر را با متغیرهای گمشده عبارت شرط‌ها «تکمیلی» پر می‌کند —
 * مقادیر خود کاربر همیشه اولویت دارند و چیزی بازنویسی نمی‌شود.
 */
export function ensureConditionVars(
  testData: Record<string, unknown>,
  nodes: WfLikeNode[]
): { data: Record<string, unknown>; added: string[] } {
  const data: Record<string, unknown> = { ...testData };
  const added: string[] = [];
  for (const v of collectExpressionVars(nodes)) {
    if (v in data) continue;
    data[v] = defaultForVar(v);
    added.push(v);
  }
  return { data, added };
}

/** ساخت داده تستی پیش‌فرض از روی گره‌های فرایند (برای دکمه «درج پیش‌فرض» و مقدار اولیه) */
export function buildDefaultTestData(nodes: WfLikeNode[], firstCustomerId?: string): string {
  const obj: Record<string, unknown> = { customerName: "مشتری نمونه" };
  if (firstCustomerId) obj.customerId = firstCustomerId;
  for (const v of collectExpressionVars(nodes)) {
    if (v in obj) continue;
    obj[v] = defaultForVar(v);
  }
  return JSON.stringify(obj, null, 2);
}
