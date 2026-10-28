/**
 * Hypothesis catalog: opportunity templates activated by specific Qloo tag / demographic / cross-domain signals.
 * Cuisine-agnostic. All human text is a dictionary key (hyp.<slug>.*, gen.*) so it renders in any locale.
 */
import type { LText } from "@/i18n/locales";
import type { MenuItemLite, RestaurantProfile } from "./types";

export interface TemplateRequirement {
  anyServiceFormat?: string[];
  menuKeywords?: string[];
  constraintBlockers?: string[];
  needsExtendedHours?: boolean;
  needsAlcohol?: boolean;
  needsDelivery?: boolean;
  extraLaborHoursPerWeek?: number;
}

export interface Offering { description: LText; deps: string[]; salePrice: number; foodCost: number; heroDish: LText }

export interface HypothesisTemplate {
  slug: string;
  title: string; // English fallback stored in DB; UI uses hyp.<slug>.title
  segment: string;
  summary: string;
  triggerTags: string[];
  triggerAgeBuckets?: string[];
  triggerCrossDomains?: string[];
  requirements: TemplateRequirement;
  operationalComplexity: 1 | 2 | 3;
  channelKeys: string[]; // gen.ch.<key>
  riskKeys: string[]; // gen.risk.<key>
  offeringTemplate: (menu: MenuItemLite[], profile: RestaurantProfile) => Offering;
}

const pick = (menu: MenuItemLite[], kws: string[]) => menu.filter((m) => kws.some((k) => m.name.toLowerCase().includes(k) || m.category.toLowerCase().includes(k)));
const signature = (menu: MenuItemLite[]) => menu.find((m) => m.isSignature) ?? menu[0];
const price = (m?: MenuItemLite) => Number(m?.price ?? 15);
const cost = (m?: MenuItemLite) => Number(m?.foodCost ?? price(m) * 0.32);
const r2 = (n: number) => Math.round(n * 100) / 100;
const nm = (m: MenuItemLite | undefined, fallbackKey: string): LText => m?.name ?? { key: `gen.${fallbackKey}` };

export const HYPOTHESIS_CATALOG: HypothesisTemplate[] = [
  {
    slug: "weekday-lunch-set", title: "Weekday lunch set", segment: "Workers and students, 25–34, within walking distance",
    summary: "A fixed-price set from a signature dish plus a small plate, for the weekday daytime crowd that over-indexes for this cuisine.",
    triggerTags: ["lunch_special", "lunch", "young professionals", "midday", "quick visit"], triggerAgeBuckets: ["25_to_29", "30_to_34"],
    requirements: { anyServiceFormat: ["dine_in", "takeout"], extraLaborHoursPerWeek: 0 }, operationalComplexity: 1,
    channelKeys: ["gbp", "signage", "office"], riskKeys: ["lunchCannib"],
    offeringTemplate: (menu) => { const s = signature(menu); const side = pick(menu, ["small", "salad", "pancake"])[0];
      return { description: { key: "gen.offLunch", params: { dish: nm(s, "signature"), side: nm(side, "smallPlate") } }, deps: [s?.name, side?.name].filter((x): x is string => !!x), salePrice: r2(price(s) + price(side) * 0.6), foodCost: r2(cost(s) + cost(side)), heroDish: nm(s, "signature") }; },
  },
  {
    slug: "vegetarian-line", title: "Plant-forward mini-menu", segment: "Vegetarian-leaning fans of your cuisine",
    summary: "Label and extend the vegetarian dishes you already have; the taste graph links your audience to vegetarian-friendly places nearby.",
    triggerTags: ["vegetarian", "vegan", "plant", "healthy"], requirements: { menuKeywords: ["vegetarian", "tofu", "vegetable", "cucumber", "vegan"] }, operationalComplexity: 1,
    channelKeys: ["menuRelabel", "instagram", "vegGroups"], riskKeys: ["vegLabel"],
    offeringTemplate: (menu) => { const v = pick(menu, ["vegetarian", "tofu", "vegetable", "cucumber", "vegan"]); const main = v.find((m) => m.category !== "small_plates") ?? v[0];
      return { description: { key: "gen.offVeg", params: { items: v.length ? v.map((m) => m.name).join(", ") : { key: "gen.vegDishes" } } }, deps: v.map((m) => m.name), salePrice: price(main), foodCost: cost(main), heroDish: nm(main, "vegDishes") }; },
  },
  {
    slug: "boba-study-pairing", title: "Boba + snack, 2–5 pm", segment: "Under-25 study crowd",
    summary: "Pair the drink program with a small plate in the afternoon lull; the youngest bucket over-indexes for this cuisine.",
    triggerTags: ["bubble_tea", "bubble tea", "boba", "study", "students", "young adults", "dessert"], triggerAgeBuckets: ["24_and_younger"], requirements: { menuKeywords: ["boba", "milk tea", "tea"], anyServiceFormat: ["dine_in", "takeout"] }, operationalComplexity: 1,
    channelKeys: ["campus", "story", "afternoonSignage"], riskKeys: ["lowTicket"],
    offeringTemplate: (menu) => { const d = pick(menu, ["boba", "milk tea", "tea"])[0]; const s = pick(menu, ["pancake", "small", "salad"])[0];
      return { description: { key: "gen.offBoba", params: { drink: nm(d, "drink"), snack: nm(s, "snack") } }, deps: [d?.name, s?.name].filter((x): x is string => !!x), salePrice: r2((price(d) + price(s)) * 0.9), foodCost: r2(cost(d) + cost(s)), heroDish: nm(d, "drink") }; },
  },
  {
    slug: "late-night-window", title: "Late-night takeout window", segment: "Late-night diners who favor this cuisine",
    summary: "Fri/Sat late hours with a short menu through a takeout window; late-night places score high for this audience nearby.",
    triggerTags: ["late_night", "late night"], requirements: { anyServiceFormat: ["takeout"], needsExtendedHours: true, extraLaborHoursPerWeek: 12, constraintBlockers: ["no extra staff", "without adding staff", "2 cooks"] }, operationalComplexity: 3,
    channelKeys: ["hoursUpdate", "lateListing", "bar"], riskKeys: ["lateLabor"],
    offeringTemplate: (menu) => { const s = signature(menu); return { description: { key: "gen.offLate", params: { dish: nm(s, "signature") } }, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s), foodCost: cost(s), heroDish: nm(s, "signature") }; },
  },
  {
    slug: "group-bundle", title: "Sharing bundle for 4", segment: "Groups and families",
    summary: "A sharing bundle that mirrors the group-friendly places this audience also likes.",
    triggerTags: ["groups", "family", "sharing", "children"], requirements: { anyServiceFormat: ["dine_in", "takeout"] }, operationalComplexity: 2,
    channelKeys: ["catering", "gbp", "community"], riskKeys: ["groupCapacity"],
    offeringTemplate: (menu) => { const mains = menu.filter((m) => m.category !== "drinks" && m.category !== "small_plates").slice(0, 3); const total = mains.reduce((a, m) => a + price(m), 0);
      return { description: { key: "gen.offGroup", params: { items: mains.length ? mains.map((m) => m.name).join(" + ") : { key: "gen.signature" } } }, deps: mains.map((m) => m.name), salePrice: r2(total * 0.9), foodCost: r2(mains.reduce((a, m) => a + cost(m), 0)), heroDish: nm(mains[0], "signature") }; },
  },
  {
    slug: "weekend-brunch", title: "Weekend brunch", segment: "Weekend brunch seekers",
    summary: "A brunch window; only worth it if the taste graph shows brunch affinity for this audience.",
    triggerTags: ["brunch", "breakfast"], requirements: { anyServiceFormat: ["dine_in"], needsExtendedHours: true, extraLaborHoursPerWeek: 10 }, operationalComplexity: 3,
    channelKeys: ["reservation", "instagram"], riskKeys: ["brunchUnproven"],
    offeringTemplate: (menu) => { const s = signature(menu); return { description: { key: "gen.offBrunch", params: { dish: nm(s, "signature") } }, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 4, foodCost: cost(s) + 1.5, heroDish: nm(s, "signature") }; },
  },
  {
    slug: "bar-program", title: "Bar program", segment: "Evening drinkers",
    summary: "Alcohol to lift ticket size; blocked without a liquor license.",
    triggerTags: ["full_bar", "full bar", "cocktail"], requirements: { needsAlcohol: true, constraintBlockers: ["no liquor license", "no alcohol"] }, operationalComplexity: 3,
    channelKeys: ["happyHour"], riskKeys: ["licensing"],
    offeringTemplate: () => ({ description: { key: "gen.offBar" }, deps: [], salePrice: 12, foodCost: 3.5, heroDish: { key: "gen.drink" } }),
  },
  {
    slug: "cross-domain-partnership", title: "Co-marketing with a high-affinity brand", segment: "Fans of the non-food brands and shows this audience loves",
    summary: "A bundle, mention or pop-up with a brand, podcast or artist the taste graph links to your fans. Exists only because of cross-domain affinity.",
    triggerTags: [], triggerCrossDomains: ["brand", "podcast", "artist", "tv_show"], requirements: { anyServiceFormat: ["dine_in", "takeout", "third_party_delivery"] }, operationalComplexity: 2,
    channelKeys: ["outreach", "cobrand", "popup"], riskKeys: ["partnerUnverified"],
    offeringTemplate: (menu) => { const s = signature(menu); return { description: { key: "gen.offPartner", params: { dish: nm(s, "signature") } }, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 5, foodCost: cost(s) + 1.4, heroDish: nm(s, "signature") }; },
  },
  {
    slug: "delivery-virtual-brand", title: "Delivery-only sub-brand", segment: "Delivery-app browsers within 3 miles",
    summary: "A narrow, travel-friendly menu under a second name on delivery apps.",
    triggerTags: ["delivery", "takeout"], requirements: { anyServiceFormat: ["third_party_delivery"], needsDelivery: true }, operationalComplexity: 2,
    channelKeys: ["virtual"], riskKeys: ["commission"],
    offeringTemplate: (menu) => { const s = pick(menu, ["rice", "noodle"])[0] ?? signature(menu); return { description: { key: "gen.offDelivery", params: { dish: nm(s, "signature") } }, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 2, foodCost: cost(s), heroDish: nm(s, "signature") }; },
  },
];
