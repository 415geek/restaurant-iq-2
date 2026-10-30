/**
 * Seeds the TasteFront fixture tenant: three synthetic brands on the demo workspace, sized 1 / 5 / 40 stores, each with a menu.
 * Names, menus and prices are invented; neighborhoods and coordinates are public geography. Idempotent (keyed by slug).
 * Usage: bun --env-file=.env.local scripts/seed-front.ts
 */
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ORG = "00000000-0000-4000-8000-000000000001";
const DEMO_RESTAURANT = "00000000-0000-4000-8000-000000000101";

type Item = [name: string, nameEn: string | null, desc: string | null, price: number, cat: string, costPct?: number];
const sichuan: Item[] = [
  ["夫妻肺片", "Sliced Beef and Tripe in Chili Oil", "Cold, numbing, sesame", 15, "Cold dishes"],
  ["口水鸡", "Mouthwatering Chicken", "Poached chicken, chili oil, peanuts", 15, "Cold dishes"],
  ["凉粉", "Cold Mung Bean Jelly", null, 8, "Cold dishes"],
  ["麻婆豆腐", "Mapo Tofu", "Silken tofu, fermented bean paste, Sichuan pepper", 14, "Mains"],
  ["水煮鱼", "Boiled Fish in Chili Oil", "Tender fish fillets, bean sprouts", 26, "Mains"],
  ["回锅肉", "Twice-Cooked Pork", "Pork belly, leeks, broad bean paste", 17, "Mains"],
  ["宫保鸡丁", "Kung Pao Chicken", "Peanuts, dried chili, scallion", 16, "Mains"],
  ["辣子鸡", "Chongqing Chili Chicken", "Crispy chicken buried in dried chilies", 19, "Mains"],
  ["干煸四季豆", "Dry-Fried Green Beans", "Vegan", 13, "Mains"],
  ["鱼香茄子", "Yu Xiang Eggplant", "Vegan, garlic, sweet-sour", 14, "Mains"],
  ["蒜泥白肉", "Garlic Pork Belly", null, 14, "Mains"],
  ["酸辣土豆丝", "Hot and Sour Potato Threads", "Vegan", 11, "Mains"],
  ["担担面", "Dan Dan Noodles", "Sesame, pork mince, chili oil", 13, "Noodles & dumplings"],
  ["钟水饺", "Zhong Dumplings", "Pork dumplings, sweet soy, garlic", 10, "Noodles & dumplings"],
  ["红油抄手", "Wontons in Chili Oil", null, 11, "Noodles & dumplings"],
  ["蛋炒饭", "Egg Fried Rice", null, 9, "Rice"],
  ["冰粉", "Ice Jelly Dessert", "Brown sugar, hawthorn", 6, "Dessert & drinks"],
  ["酸梅汤", "Sour Plum Drink", null, 4, "Dessert & drinks"],
];
const boba: Item[] = [
  ["Classic Milk Tea", null, "Black tea, milk, boba", 5.5, "Milk tea"],
  ["Brown Sugar Boba Milk", null, "No tea, fresh milk, warm boba", 6.5, "Milk tea"],
  ["Oolong Milk Tea", null, null, 5.75, "Milk tea"],
  ["Taro Milk Tea", null, "Real taro", 6, "Milk tea"],
  ["Thai Tea", null, null, 5.5, "Milk tea"],
  ["Hojicha Latte", null, "Roasted green tea, oat milk", 6.25, "Milk tea"],
  ["Jasmine Green Tea", null, null, 4.5, "Fruit & tea"],
  ["Mango Green Tea", null, "Mango chunks", 6, "Fruit & tea"],
  ["Passion Fruit Tea", null, null, 5.75, "Fruit & tea"],
  ["Lychee Jasmine", null, null, 5.75, "Fruit & tea"],
  ["Cheese Foam Oolong", null, "Salted cream top", 6.5, "Fruit & tea"],
  ["Strawberry Matcha Latte", null, "Ceremonial matcha", 6.75, "Fruit & tea"],
  ["Egg Waffle", null, "Hong Kong style", 6, "Snacks"],
  ["Popcorn Chicken", null, "Taiwanese, basil", 7.5, "Snacks"],
];
const bowl: Item[] = [
  ["Teriyaki Chicken Bowl", null, "Grilled thigh, steamed rice, pickles", 13, "Bowls"],
  ["Spicy Pork Bulgogi Bowl", null, "Gochujang, kimchi", 14, "Bowls"],
  ["Tofu Veggie Bowl", null, "Vegan, sesame greens", 12, "Bowls"],
  ["Garlic Shrimp Bowl", null, null, 15, "Bowls"],
  ["Miso Salmon Bowl", null, "Brown rice, avocado", 16, "Bowls"],
  ["Poke Bowl", null, "Ahi tuna, sushi rice", 16, "Bowls"],
  ["Katsu Curry", null, "Panko pork cutlet, Japanese curry", 14, "Plates"],
  ["Kimchi Fried Rice", null, "Fried egg on top", 12, "Plates"],
  ["Tonkotsu Ramen", null, "Pork bone broth, chashu", 15, "Plates"],
  ["Chicken Karaage", null, null, 8, "Sides"],
  ["Gyoza", null, "Pork and chive", 7, "Sides"],
  ["Edamame", null, "Vegan", 5, "Sides"],
  ["Seaweed Salad", null, "Vegan", 5, "Sides"],
  ["Mochi Ice Cream", null, null, 5, "Dessert & drinks"],
  ["Matcha Latte", null, null, 5, "Dessert & drinks"],
  ["Yuzu Lemonade", null, null, 4, "Dessert & drinks"],
];

type StoreSeed = { slug: string; name: string; address: string; lat: number; lng: number; neighborhood: string; city: string };
const single: StoreSeed[] = [{ slug: "chuan-lane-san-bruno", name: "Chuan Lane (sample)", address: "San Mateo Ave, San Bruno, CA", lat: 37.6305, lng: -122.4111, neighborhood: "Downtown San Bruno", city: "San Bruno" }];
const bobaStores: StoreSeed[] = [
  { slug: "cloud-nine-daly-city", name: "Cloud Nine Tea · Daly City", address: "Westlake, Daly City, CA", lat: 37.6971, lng: -122.4858, neighborhood: "Westlake", city: "Daly City" },
  { slug: "cloud-nine-cupertino", name: "Cloud Nine Tea · Cupertino", address: "Stevens Creek Blvd, Cupertino, CA", lat: 37.3230, lng: -122.0322, neighborhood: "Stevens Creek", city: "Cupertino" },
  { slug: "cloud-nine-berkeley", name: "Cloud Nine Tea · Berkeley", address: "Shattuck Ave, Berkeley, CA", lat: 37.8716, lng: -122.2687, neighborhood: "Downtown Berkeley", city: "Berkeley" },
  { slug: "cloud-nine-temescal", name: "Cloud Nine Tea · Temescal", address: "Telegraph Ave, Oakland, CA", lat: 37.8339, lng: -122.2628, neighborhood: "Temescal", city: "Oakland" },
  { slug: "cloud-nine-mission", name: "Cloud Nine Tea · Mission", address: "Valencia St, San Francisco, CA", lat: 37.7599, lng: -122.4214, neighborhood: "Mission District", city: "San Francisco" },
];
const bowlCities: Array<[string, string, number, number]> = [
  ["Financial District", "San Francisco", 37.7946, -122.3999], ["SoMa", "San Francisco", 37.7785, -122.4056], ["Marina", "San Francisco", 37.8021, -122.4382], ["Inner Richmond", "San Francisco", 37.7802, -122.4650], ["Castro", "San Francisco", 37.7609, -122.4350], ["Noe Valley", "San Francisco", 37.7502, -122.4337], ["Hayes Valley", "San Francisco", 37.7759, -122.4245], ["Outer Sunset", "San Francisco", 37.7536, -122.4945],
  ["Downtown", "Oakland", 37.8044, -122.2712], ["Rockridge", "Oakland", 37.8441, -122.2516], ["Jack London", "Oakland", 37.7955, -122.2730], ["Downtown", "Berkeley", 37.8700, -122.2680], ["Elmwood", "Berkeley", 37.8580, -122.2530], ["Downtown", "Walnut Creek", 37.8990, -122.0640], ["Downtown", "Pleasanton", 37.6624, -121.8747], ["Downtown", "Fremont", 37.5485, -121.9886],
  ["Downtown", "Palo Alto", 37.4443, -122.1598], ["Castro Street", "Mountain View", 37.3936, -122.0790], ["Downtown", "Sunnyvale", 37.3779, -122.0309], ["Santana Row", "San Jose", 37.3209, -121.9480], ["Japantown", "San Jose", 37.3486, -121.8950], ["Downtown", "San Jose", 37.3352, -121.8906], ["Downtown", "Campbell", 37.2872, -121.9500], ["Downtown", "Los Gatos", 37.2216, -121.9846], ["Downtown", "San Mateo", 37.5630, -122.3255], ["Downtown", "Burlingame", 37.5779, -122.3480], ["Downtown", "Redwood City", 37.4852, -122.2282], ["Downtown", "Millbrae", 37.5985, -122.3872],
  ["Midtown", "Sacramento", 38.5737, -121.4753], ["Downtown", "Davis", 38.5449, -121.7405], ["Downtown", "Santa Cruz", 36.9741, -122.0308], ["Downtown", "Monterey", 36.6002, -121.8947], ["Downtown", "Napa", 38.2975, -122.2869], ["Downtown", "Santa Rosa", 38.4404, -122.7141], ["Downtown", "San Rafael", 37.9735, -122.5311], ["Downtown", "Petaluma", 38.2324, -122.6367], ["Downtown", "Livermore", 37.6819, -121.7680], ["Downtown", "Concord", 37.9780, -122.0311], ["Downtown", "Vallejo", 38.1041, -122.2566], ["Downtown", "Modesto", 37.6391, -120.9969],
];
const bowlStores: StoreSeed[] = bowlCities.map(([n, c, lat, lng], i) => ({ slug: `bamboo-bowl-${String(i + 1).padStart(2, "0")}-${c.toLowerCase().replace(/\s+/g, "-")}-${n.toLowerCase().replace(/\s+/g, "-")}`.replace(/[^a-z0-9-]/g, "").slice(0, 60), name: `Bamboo Bowl · ${n === "Downtown" ? c : n}`, address: `${n}, ${c}, CA`, lat, lng, neighborhood: n, city: c }));

async function brand(slug: string, name: string, sizeClass: string, banned: string[]) {
  const { data, error } = await db.from("front_brands").upsert({ organization_id: ORG, name, slug, size_class: sizeClass }, { onConflict: "slug" }).select("id").single();
  if (error) throw error;
  await db.from("front_guardrails").upsert({ brand_id: data.id, banned_terms: banned, price_band_pct: 15, tone: "plain" });
  return data.id as string;
}
async function store(brandId: string, s: StoreSeed, cuisine: string, lang: "en" | "zh", restaurantId: string | null, menu: Item[]) {
  const { data, error } = await db.from("front_stores").upsert({ organization_id: ORG, brand_id: brandId, restaurant_id: restaurantId, name: s.name, slug: s.slug, address: s.address, lat: s.lat, lng: s.lng, neighborhood: s.neighborhood, city: s.city, cuisine, language: lang }, { onConflict: "slug" }).select("id").single();
  if (error) throw error;
  const sid = data.id as string;
  const { count } = await db.from("front_menu_items").select("id", { count: "exact", head: true }).eq("store_id", sid);
  if (count && count > 0) return sid;
  const { data: m, error: e2 } = await db.from("front_menus").insert({ store_id: sid, source: "seed" }).select("id").single();
  if (e2) throw e2;
  const rows = menu.map(([name, nameEn, desc, price, cat, costPct], i) => ({ menu_id: m.id, store_id: sid, name, name_en: nameEn, description: desc, price_cents: Math.round(price * 100), cost_cents: Math.round(price * 100 * (costPct ?? 0.32)), category: cat, sort_index: i }));
  const { error: e3 } = await db.from("front_menu_items").insert(rows);
  if (e3) throw e3;
  return sid;
}

const b1 = await brand("chuan-lane", "Chuan Lane (sample)", "single", ["authentic", "healthy", "best", "world-famous"]);
for (const s of single) await store(b1, s, "Sichuan", "zh", DEMO_RESTAURANT, sichuan);
const b2 = await brand("cloud-nine-tea", "Cloud Nine Tea (sample)", "small_chain", ["authentic", "healthy", "best", "sugar-free"]);
for (const s of bobaStores) await store(b2, s, "Bubble tea", "en", null, boba);
const b3 = await brand("bamboo-bowl", "Bamboo Bowl (sample)", "franchise", ["authentic", "healthy", "best", "organic", "gluten-free"]);
for (const s of bowlStores) await store(b3, s, "Asian fast casual", "en", null, bowl);
const { count } = await db.from("front_stores").select("id", { count: "exact", head: true }).eq("organization_id", ORG);
console.log("stores:", count);

// Demo settlement: an alternate-week holdout inside the synthetic sales range of the linked demo restaurant (Sep 14 – Oct 25, 2026).
// Change week Mon Oct 12 – Sun Oct 18, control week Oct 19 – 25 (Pacific). Labelled "sample" wherever it is shown.
const { data: chuan } = await db.from("front_stores").select("id").eq("slug", "chuan-lane-san-bruno").single();
if (chuan) {
  const { count: hc } = await db.from("front_holdouts").select("id", { count: "exact", head: true }).eq("store_id", chuan.id);
  if (!hc) {
    await db.from("front_holdouts").insert({ store_id: chuan.id, kind: "week_alternate", change_window: { start: "2026-10-12T07:00:00.000Z", end: "2026-10-19T07:00:00.000Z" }, control_window: { start: "2026-10-19T07:00:00.000Z", end: "2026-10-26T07:00:00.000Z" }, assignment: { change: [chuan.id], control: [], seed: 0 } });
    console.log("seeded demo holdout for chuan-lane-san-bruno");
  }
}
