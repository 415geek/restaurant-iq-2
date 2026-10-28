/**
 * Generates SYNTHETIC sample exports for the demo uploader (no real customers, no real platform data).
 * Usage: bun scripts/make-sample-data.ts
 */
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";

let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const MENU: Array<[string, number]> = [["Beef Noodle Soup", 18.5], ["Dan Dan Noodles", 15], ["Scallion Pancake", 8], ["Three Cup Chicken", 19], ["Braised Pork Rice", 14.5], ["Cucumber Salad", 7], ["Boba Milk Tea", 6.5], ["Vegetarian Mapo Tofu", 15.5]];
const NAMES = ["Sample Guest A", "Sample Guest B", "Sample Guest C", "Sample Guest D", "Sample Guest E"];
// expected orders per hour (11..21) by weekday; Tue/Wed afternoons are deliberately quiet
const curve = (wd: number, h: number) => { const base = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 6, 5, 2, 1.5, 2, 4, 7, 6, 4, 2][h] ?? 0; const day = [1.3, 0.8, 0.7, 0.75, 0.9, 1.3, 1.4][wd]; const dip = (wd === 2 || wd === 3) && h >= 14 && h <= 16 ? 0.15 : 1; return base * day * dip; };
const pois = (l: number) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= rnd(); } while (p > L); return k - 1; };
const pad = (n: number) => String(n).padStart(2, "0");
const start = Date.UTC(2026, 8, 14); // 2026-09-14
const days = 42;
const money = (n: number) => n.toFixed(2);

const square: string[][] = [["Date", "Time", "Time Zone", "Category", "Item", "Qty", "Gross Sales", "Discounts", "Net Sales", "Tax", "Transaction ID", "Dining Option", "Customer Name"]];
const dd: string[][] = [["Timestamp Local Date", "Timestamp Local Time", "DoorDash Order ID", "Customer Name", "Dasher Name", "Subtotal", "Tax Subtotal", "Commission", "Marketing Fees", "Net Total", "Order Status"]];
const es: unknown[][] = [["Fecha", "Hora", "Pedido", "Platillo", "Cantidad", "Total", "Canal", "Teléfono del cliente"]];
let tx = 1000, ddId = 5000, esId = 1;
for (let d = 0; d < days; d++) {
  const t = new Date(start + d * 86400_000); const wd = t.getUTCDay(); const ymd = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; const mdy = `${t.getUTCMonth() + 1}/${t.getUTCDate()}/${t.getUTCFullYear()}`;
  for (let h = 11; h <= 21; h++) {
    for (let o = pois(curve(wd, h) * 0.75); o > 0; o--) {
      const id = `T${tx++}`; const min = pad(Math.floor(rnd() * 60)); const dining = pick(["Dine In", "Dine In", "Takeout"]);
      for (let i = 1 + Math.floor(rnd() * 3); i > 0; i--) { const [name, price] = pick(MENU); const q = rnd() < 0.15 ? 2 : 1; const g = price * q; const disc = rnd() < 0.08 ? -1.5 : 0; square.push([mdy, `${h > 12 ? h - 12 : h}:${min} ${h >= 12 ? "PM" : "AM"}`, "Pacific Time (US & Canada)", "Food", name, String(q), `$${money(g)}`, disc ? `($${money(-disc)})` : "$0.00", `$${money(g + disc)}`, `$${money((g + disc) * 0.08625)}`, id, dining, pick(NAMES)]); }
    }
    for (let o = pois(curve(wd, h) * 0.35); o > 0; o--) {
      const sub = 18 + rnd() * 30; const comm = sub * 0.25; const mkt = rnd() < 0.2 ? 3 : 0;
      dd.push([ymd, `${pad(h)}:${pad(Math.floor(rnd() * 60))}`, `DD-${ddId++}`, pick(NAMES), pick(NAMES), money(sub), money(sub * 0.08625), `-${money(comm)}`, mkt ? `-${money(mkt)}` : "0.00", money(sub - comm - mkt), rnd() < 0.03 ? "Cancelled" : "Delivered"]);
    }
    if (d >= days - 14) for (let o = pois(curve(wd, h) * 0.2); o > 0; o--) { const [name, price] = pick(MENU); es.push([`${pad(t.getUTCDate())}/${pad(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`, `${pad(h)}:${pad(Math.floor(rnd() * 60))}`, `P-${esId++}`, name, 1, price, pick(["Para llevar", "En el local", "Recoger"]), "555-0100"]); }
  }
}
const csv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
writeFileSync("public/samples/square-item-sales-sample.csv", csv(square));
writeFileSync("public/samples/doordash-orders-sample.csv", csv(dd));
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(es), "Ventas");
writeFileSync("public/samples/ventas-muestra.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("square lines", square.length - 1, "doordash orders", dd.length - 1, "es rows", es.length - 1);
