import { createHash } from "node:crypto";
import type { ColumnMapping, Platform, Target } from "./schema";

/** Deterministic column recognition: header synonyms from common POS and delivery exports, checked against the values. */
/** Common Spanish and Chinese headers are translated to English keywords before matching. */
const I18N: Array<[RegExp, string]> = [
  [/fecha y hora|日期时间|下单时间/g, "date time"], [/fecha|日期/g, "date"], [/hora|时间/g, "time"], [/n[uú]mero de pedido|pedido|订单号|订单编号|单号/g, "order id"],
  [/art[ií]culo|producto|platillo|菜品|商品|品名/g, "item"], [/cantidad|数量/g, "qty"], [/descuento|折扣|优惠/g, "discount"], [/impuesto|税/g, "tax"], [/propina|小费/g, "tip"],
  [/comisi[oó]n|佣金|平台费|手续费/g, "commission"], [/pago neto|实收|到账|结算金额/g, "payout"], [/reembolso|退款/g, "refund"], [/estado|状态/g, "status"],
  [/canal|渠道|就餐方式/g, "channel"], [/plataforma|平台/g, "platform"], [/ventas netas|净销售额/g, "net sales"], [/subtotal|小计/g, "subtotal"], [/total|总计|金额|合计|营业额/g, "total"],
  [/cliente|顾客|客户|姓名/g, "customer name"], [/tel[eé]fono|电话|手机/g, "phone"], [/direcci[oó]n|地址/g, "address"], [/correo|邮箱/g, "email"],
];
export const normHeader = (h: string) => I18N.reduce((s, [re, en]) => s.replace(re, ` ${en} `), h.toLowerCase()).replace(/[_\-./#()]+/g, " ").replace(/[^a-z0-9 %]+/g, "").replace(/\s+/g, " ").trim();

// Order matters: earlier rules win. Each target is used once (except ignore/pii).
const RULES: Array<[Target, RegExp]> = [
  ["pii", /\b(customer|guest|client|cardholder|dasher|driver|courier|recipient)\b.*\b(name|phone|email|address)\b|^(customer|guest|cardholder) ?(name)?$|\b(phone|e ?mail|email address|street|address|zip|postal|card last ?4|last 4|pan)\b/],
  ["order_id", /\b(order|transaction|receipt|check|ticket|payment|delivery) ?(id|number|no|uuid|#)\b|^(order|check|receipt|ticket)$|^order ?#$/],
  ["ordered_at", /\b(created|placed|ordered|opened|closed|completed|accepted)\b.*\b(at|time|date|datetime|timestamp)\b|\btimestamp\b|\bdate ?time\b|\bdatetime\b/],
  ["ordered_date", /\b(order|transaction|business|sale|sales|payment)? ?date\b|^day$/],
  ["ordered_time", /\b(order|transaction|sale)? ?time\b|^hour$/],
  ["item_name", /\b(item|product|menu item|dish|article)( name)?\b|^(name|description|sku name)$/],
  ["quantity", /\b(qty|quantity|units|count|items sold|# sold|sold)\b/],
  ["platform_fees", /\b(commission|marketplace fee|service fee|processing fee|platform fee|fees?|marketing fee|ads? fee)\b/],
  ["payout", /\b(payout|net payout|net total|deposit|paid out|net payable|amount paid|net earnings|total payout)\b/],
  ["refunds", /\b(refund|refunds|error charge|adjustment|chargeback)s?\b/],
  ["discounts", /\b(discount|promo|promotion|coupon|comp|comps|merchant funded)s?\b/],
  ["tip", /\b(tip|tips|gratuity)\b/],
  ["tax", /\b(tax|taxes|vat|gst)\b/],
  ["net_sales", /\bnet sales\b|^net$/],
  ["gross_sales", /\b(gross sales|subtotal|sub total|sales|item subtotal|food sales|gross|amount|total sales|price|total|revenue)\b/],
  ["status", /\b(status|state|order status)\b/],
  ["channel", /\b(channel|order type|dining option|fulfillment|fulfilment|service type|order source|dining)\b/],
  ["platform", /\b(platform|marketplace|provider|app)\b/],
];

const PLATFORM_HINTS: Array<[Platform, RegExp]> = [
  ["doordash", /doordash|dasher|\bdd\b/],
  ["ubereats", /uber ?eats|\buber\b|workflow uuid/],
  ["grubhub", /grubhub|seamless/],
  ["toast", /\btoast\b/],
  ["clover", /\bclover\b/],
  ["square", /\bsquare\b/],
];
export function detectPlatform(fileName: string, headers: string[]): Platform {
  const hay = `${fileName.toLowerCase()} ${headers.map(normHeader).join(" ")}`;
  for (const [p, re] of PLATFORM_HINTS) if (re.test(hay)) return p;
  return "other";
}

export function headerFingerprint(headers: string[]): string {
  return createHash("sha256").update([...headers.map(normHeader)].sort().join("|")).digest("hex").slice(0, 32);
}

// ---------- value checks ----------
const MONEY_RE = /^\(?-?\s*[$€£¥]?\s*-?[\d,]*\.?\d+\s*\)?$/;
const DATE_RE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9} \d{1,2},? \d{4})/;
const TIME_RE = /\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/i;
export function valueKind(samples: string[]): "money" | "datetime" | "date" | "time" | "text" | "empty" {
  const s = samples.map((v) => v.trim()).filter(Boolean);
  if (!s.length) return "empty";
  const share = (f: (v: string) => boolean) => s.filter(f).length / s.length;
  if (share((v) => DATE_RE.test(v) && TIME_RE.test(v)) >= 0.6) return "datetime";
  if (share((v) => DATE_RE.test(v)) >= 0.6) return "date";
  if (share((v) => /^\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i.test(v)) >= 0.6) return "time";
  if (share((v) => MONEY_RE.test(v.replace(/\s/g, ""))) >= 0.8) return "money";
  return "text";
}

/** Several columns may feed one of these; transform.ts adds them up (e.g. Commission + Marketing fees). */
export const SUMMABLE = new Set<Target>(["platform_fees", "discounts", "tax", "tip", "refunds"]);
/** Propose a target for every column. Values must agree with the header (a "Date" column must hold dates, money must be numeric). */
export function ruleMapping(headers: string[], rows: string[][]): ColumnMapping[] {
  const used = new Set<Target>();
  return headers.map((h, i) => {
    const n = normHeader(h);
    const kind = valueKind(rows.slice(0, 50).map((r) => r[i] ?? ""));
    if (!n) return { column: h, target: "ignore", confidence: 1, method: "rules", reason: "empty header" };
    for (const [target, re] of RULES) {
      if (!re.test(n)) continue;
      if (target === "pii") return { column: h, target, confidence: 0.95, method: "rules", reason: "personal data: never stored" };
      let t: Target = target;
      if ((t === "ordered_at" || t === "ordered_date" || t === "ordered_time") && kind !== "empty") {
        t = kind === "datetime" ? "ordered_at" : kind === "date" ? "ordered_date" : kind === "time" ? "ordered_time" : t;
        if (kind === "money" || kind === "text") continue;
      }
      if (["item_name", "status", "channel", "platform"].includes(t) && (kind === "money" || kind === "datetime" || kind === "date")) continue;
      if (["gross_sales", "discounts", "net_sales", "tax", "tip", "platform_fees", "payout", "refunds", "quantity"].includes(t) && kind !== "money" && kind !== "empty") continue;
      if (used.has(t) && !SUMMABLE.has(t)) return { column: h, target: "ignore", confidence: 0.5, method: "rules", reason: `duplicate of an earlier ${t} column` };
      used.add(t);
      return { column: h, target: t, confidence: 0.85, method: "rules" };
    }
    if (kind === "datetime" && !used.has("ordered_at")) { used.add("ordered_at"); return { column: h, target: "ordered_at", confidence: 0.6, method: "rules", reason: "values look like timestamps" }; }
    return { column: h, target: "ignore", confidence: 0.4, method: "rules", reason: "not recognized" };
  });
}

export function mappingGaps(m: ColumnMapping[]): string[] {
  const has = (t: Target) => m.some((c) => c.target === t);
  const gaps: string[] = [];
  if (!has("ordered_at") && !has("ordered_date")) gaps.push("no_date");
  if (!["gross_sales", "net_sales", "payout"].some((t) => has(t as Target))) gaps.push("no_amount");
  return gaps;
}

/**
 * Redact before anything leaves the server: whole columns the rules flagged as personal data, plus any cell that looks like
 * an email, phone number or card number. Used for the samples sent to the AI mapper.
 */
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;
const CARD = /\b(?:\d[ -]?){13,19}\b/;
export function redactSample(headers: string[], rows: string[][], mapping: ColumnMapping[]): string[][] {
  const pii = new Set(mapping.filter((m) => m.target === "pii").map((m) => m.column));
  return rows.map((r) => r.map((v, i) => (pii.has(headers[i]) ? "[redacted]" : EMAIL.test(v) || CARD.test(v) || (PHONE.test(v) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(v) && !/^\$?[\d,]+(\.\d+)?$/.test(v.trim())) ? "[redacted]" : v)));
}
