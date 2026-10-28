import * as XLSX from "xlsx";
import Papa from "papaparse";

/**
 * Turn an uploaded file into tables of strings. Spreadsheets (xlsx, xls, ods, numbers), CSV/TSV/TXT and JSON are parsed here;
 * PDF and images are documents that need AI extraction and are reported as such.
 */
export interface Table { name: string; headers: string[]; rows: string[][] }
export type ParsedFile = { kind: "table"; tables: Table[] } | { kind: "document"; mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif" } | { kind: "unsupported"; reason: string };

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // one file per request; Vercel caps request bodies at ~4.5 MB
export const MAX_FILES = 10;
export const MAX_ROWS = 50_000;
const SHEET_EXT = /\.(xlsx|xlsm|xls|ods|numbers|xlsb)$/i;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString().replace(/\.000Z$/, "").replace("T", " ") : "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, 300);
}
/** Find the header row: the first row in the top 15 with at least 2 non-empty cells and mostly text. */
function toTable(name: string, grid: unknown[][]): Table | null {
  const rows = grid.map((r) => (Array.isArray(r) ? r.map(cell) : []));
  let hi = rows.slice(0, 15).findIndex((r) => r.filter(Boolean).length >= 2 && r.filter((c) => c && !/^[\d$.,()-]+$/.test(c)).length >= Math.ceil(r.filter(Boolean).length * 0.6));
  if (hi < 0) hi = 0;
  const raw = rows[hi] ?? [];
  const seen = new Map<string, number>();
  const headers = raw.map((h, i) => { const b = h || `Column ${i + 1}`; const n = (seen.get(b) ?? 0) + 1; seen.set(b, n); return n > 1 ? `${b} (${n})` : b; });
  const body = rows.slice(hi + 1).filter((r) => r.some(Boolean)).slice(0, MAX_ROWS).map((r) => headers.map((_, i) => r[i] ?? ""));
  return headers.length >= 2 && body.length ? { name, headers, rows: body } : null;
}

export function parseFile(name: string, mime: string, buf: Buffer): ParsedFile {
  const lower = name.toLowerCase();
  if (/\.pdf$/.test(lower) || mime === "application/pdf") return { kind: "document", mediaType: "application/pdf" };
  const img = lower.match(/\.(png|jpe?g|webp|gif)$/);
  if (img || mime.startsWith("image/")) {
    const t = img ? (img[1] === "jpg" ? "jpeg" : img[1]) : mime.slice(6);
    if (["png", "jpeg", "webp", "gif"].includes(t)) return { kind: "document", mediaType: `image/${t}` as "image/png" };
    return { kind: "unsupported", reason: "image_type" };
  }
  try {
    if (SHEET_EXT.test(lower)) {
      const wb = XLSX.read(buf, { type: "buffer", dense: true }); // formatted text (cell.w) keeps dates as the owner sees them, no server time-zone shift
      const tables = wb.SheetNames.map((s) => toTable(s, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, raw: false, defval: "" }))).filter((t): t is Table => !!t);
      return tables.length ? { kind: "table", tables } : { kind: "unsupported", reason: "empty" };
    }
    const text = buf.toString("utf8").replace(/^﻿/, "");
    if (/\.json$/.test(lower) || /^\s*[[{]/.test(text)) {
      const j = JSON.parse(text) as unknown;
      const arr = Array.isArray(j) ? j : Object.values(j as Record<string, unknown>).find(Array.isArray) ?? [];
      const objs = (arr as unknown[]).filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && !Array.isArray(o)).slice(0, MAX_ROWS);
      const headers = [...new Set(objs.slice(0, 200).flatMap((o) => Object.keys(o)))];
      const t = toTable(name, [headers, ...objs.map((o) => headers.map((h) => (typeof o[h] === "object" ? JSON.stringify(o[h]) : o[h])))]);
      return t ? { kind: "table", tables: [t] } : { kind: "unsupported", reason: "empty" };
    }
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true, delimiter: "" });
    const t = toTable(name, parsed.data);
    return t ? { kind: "table", tables: [t] } : { kind: "unsupported", reason: "empty" };
  } catch {
    return { kind: "unsupported", reason: "unreadable" };
  }
}
