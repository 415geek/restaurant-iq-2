/**
 * Hypothesis catalog: opportunity templates activated by specific Qloo tag / demographic / cross-domain signals.
 * Templates are cuisine-agnostic; menu dependencies are matched by keyword.
 */
import type { MenuItemLite, RestaurantProfile } from "./types";

export interface TemplateRequirement {
  anyServiceFormat?: string[];
  menuKeywords?: string[]; // at least one menu item must match
  constraintBlockers?: string[]; // substring in constraints → disqualify
  needsExtendedHours?: boolean;
  needsAlcohol?: boolean;
  needsDelivery?: boolean;
  extraLaborHoursPerWeek?: number;
}

export interface HypothesisTemplate {
  slug: string;
  title: string;
  segment: string;
  summary: string;
  triggerTags: string[]; // tag id substrings (e.g. "vegetarian")
  triggerAgeBuckets?: string[]; // demographic buckets that strengthen the case
  triggerCrossDomains?: string[]; // entity domains (podcast, brand, artist, tv_show)
  requirements: TemplateRequirement;
  operationalComplexity: 1 | 2 | 3; // 1 low, 3 high
  genericPriority: number; // baseline ranking without Qloo (0..1): what a generic consultant would say
  channelNames: string[];
  riskNotes: string[];
  offeringTemplate: (menu: MenuItemLite[], profile: RestaurantProfile) => { description: string; deps: string[]; salePrice: number; foodCost: number };
}

const pick = (menu: MenuItemLite[], kws: string[]) =>
  menu.filter((m) => kws.some((k) => m.name.toLowerCase().includes(k) || m.category.toLowerCase().includes(k)));
const signature = (menu: MenuItemLite[]) => menu.find((m) => m.isSignature) ?? menu[0];
const price = (m?: MenuItemLite) => Number(m?.price ?? 15);
const cost = (m?: MenuItemLite) => Number(m?.foodCost ?? price(m) * 0.32);

export const HYPOTHESIS_CATALOG: HypothesisTemplate[] = [
  {
    slug: "weekday-lunch-set",
    title: "Weekday lunch set for nearby workers and students",
    segment: "Weekday lunch crowd (25–34) within walking distance",
    summary: "A fixed-price lunch set built from a signature dish plus a small plate, aimed at the weekday daytime segment that over-indexes for this cuisine.",
    triggerTags: ["lunch_special", "lunch"],
    triggerAgeBuckets: ["25_to_29", "30_to_34"],
    requirements: { anyServiceFormat: ["dine_in", "takeout"], extraLaborHoursPerWeek: 0 },
    operationalComplexity: 1,
    genericPriority: 0.8,
    channelNames: ["Google Business Profile post", "In-store signage", "Office-lunch group order outreach"],
    riskNotes: ["Lunch set may cannibalize full-price orders from existing regulars."],
    offeringTemplate: (menu) => {
      const s = signature(menu);
      const side = pick(menu, ["small", "salad", "pancake"])[0];
      return {
        description: `${s?.name ?? "Signature dish"} + ${side?.name ?? "small plate"} lunch set, weekdays 11:00–14:00`,
        deps: [s?.name, side?.name].filter((x): x is string => !!x),
        salePrice: Math.round((price(s) + price(side) * 0.6) * 100) / 100,
        foodCost: Math.round((cost(s) + cost(side)) * 100) / 100,
      };
    },
  },
  {
    slug: "vegetarian-line",
    title: "Plant-forward line extension",
    segment: "Vegetarian-leaning diners who already like this cuisine",
    summary: "Promote and extend existing vegetarian dishes into a clearly labeled plant-forward mini-menu, because the taste graph links this cuisine's fans to vegetarian-friendly places nearby.",
    triggerTags: ["vegetarian", "vegan", "plant"],
    requirements: { menuKeywords: ["vegetarian", "tofu", "vegetable", "cucumber", "vegan"] },
    operationalComplexity: 1,
    genericPriority: 0.45,
    channelNames: ["Menu relabel + delivery app menu update", "Instagram post", "Local vegetarian community groups"],
    riskNotes: ["Cross-contamination claims: label as vegetarian, not vegan, unless verified."],
    offeringTemplate: (menu) => {
      const v = pick(menu, ["vegetarian", "tofu", "vegetable", "cucumber", "vegan"]);
      const main = v.find((m) => m.category !== "small_plates") ?? v[0];
      return {
        description: `"Plant-forward" mini-menu: ${v.map((m) => m.name).join(", ") || "vegetarian dishes"}`,
        deps: v.map((m) => m.name),
        salePrice: price(main),
        foodCost: cost(main),
      };
    },
  },
  {
    slug: "boba-study-pairing",
    title: "Boba + snack pairing for the under-25 study crowd",
    segment: "Students and under-25s who pair bubble tea with snacks",
    summary: "Bundle the drink program with a small plate for afternoon off-peak hours, targeting the youngest bucket that over-indexes for this cuisine.",
    triggerTags: ["bubble_tea", "boba", "study"],
    triggerAgeBuckets: ["24_and_younger"],
    requirements: { menuKeywords: ["boba", "milk tea", "tea"], anyServiceFormat: ["dine_in", "takeout"] },
    operationalComplexity: 1,
    genericPriority: 0.3,
    channelNames: ["Campus flyer / student org partnership", "Instagram story", "In-store afternoon signage"],
    riskNotes: ["Low ticket size; depends on off-peak seat availability."],
    offeringTemplate: (menu) => {
      const d = pick(menu, ["boba", "milk tea", "tea"])[0];
      const s = pick(menu, ["pancake", "small", "salad"])[0];
      return {
        description: `${d?.name ?? "Drink"} + ${s?.name ?? "snack"} afternoon pairing (14:00–17:00)`,
        deps: [d?.name, s?.name].filter((x): x is string => !!x),
        salePrice: Math.round((price(d) + price(s)) * 0.9 * 100) / 100,
        foodCost: Math.round((cost(d) + cost(s)) * 100) / 100,
      };
    },
  },
  {
    slug: "late-night-window",
    title: "Late-night takeout window (Fri/Sat)",
    segment: "Late-night diners who favor this cuisine",
    summary: "Extend Friday/Saturday hours with a reduced late-night menu through a takeout window, because late-night places score high for this taste profile nearby.",
    triggerTags: ["late_night", "late"],
    requirements: { anyServiceFormat: ["takeout"], needsExtendedHours: true, extraLaborHoursPerWeek: 12, constraintBlockers: ["no extra staff", "without adding staff", "2 cooks"] },
    operationalComplexity: 3,
    genericPriority: 0.35,
    channelNames: ["Google Business Profile hours update", "Delivery app late-night listing", "Nearby bar partnership"],
    riskNotes: ["Requires added labor and a safety plan for late hours."],
    offeringTemplate: (menu) => {
      const s = signature(menu);
      return { description: `Reduced late-night menu led by ${s?.name ?? "signature dish"}, Fri/Sat 21:00–00:00`, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s), foodCost: cost(s) };
    },
  },
  {
    slug: "group-bundle",
    title: "Group / family sharing bundle",
    segment: "Groups and families who choose shareable formats",
    summary: "A sharing bundle for 4 that mirrors the 'good for groups' places this audience also likes.",
    triggerTags: ["groups", "family", "sharing"],
    requirements: { anyServiceFormat: ["dine_in", "takeout"] },
    operationalComplexity: 2,
    genericPriority: 0.5,
    channelNames: ["Catering/large order page", "Google Business Profile", "WeChat/community groups"],
    riskNotes: ["Needs table capacity at peak; packaging cost for takeout bundles."],
    offeringTemplate: (menu) => {
      const mains = menu.filter((m) => m.category !== "drinks" && m.category !== "small_plates").slice(0, 3);
      const total = mains.reduce((a, m) => a + price(m), 0);
      return { description: `Sharing bundle for 4: ${mains.map((m) => m.name).join(" + ")}`, deps: mains.map((m) => m.name), salePrice: Math.round(total * 0.9 * 100) / 100, foodCost: Math.round(mains.reduce((a, m) => a + cost(m), 0) * 100) / 100 };
    },
  },
  {
    slug: "weekend-brunch",
    title: "Weekend brunch service",
    segment: "Weekend brunch seekers",
    summary: "Add a weekend brunch window; only worth it if the taste graph shows brunch affinity for this audience.",
    triggerTags: ["brunch"],
    requirements: { anyServiceFormat: ["dine_in"], needsExtendedHours: true, extraLaborHoursPerWeek: 10 },
    operationalComplexity: 3,
    genericPriority: 0.4,
    channelNames: ["Reservation platform listing", "Instagram"],
    riskNotes: ["New daypart with unproven demand for this cuisine."],
    offeringTemplate: (menu) => {
      const s = signature(menu);
      return { description: `Weekend brunch set around ${s?.name ?? "signature dish"}`, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 4, foodCost: cost(s) + 1.5 };
    },
  },
  {
    slug: "bar-program",
    title: "Full bar / cocktail program",
    segment: "Evening drinkers",
    summary: "Add alcohol to raise ticket size; blocked when the restaurant has no liquor license.",
    triggerTags: ["full_bar", "cocktail", "bar"],
    requirements: { needsAlcohol: true, constraintBlockers: ["no liquor license", "no alcohol"] },
    operationalComplexity: 3,
    genericPriority: 0.6,
    channelNames: ["Happy-hour listing"],
    riskNotes: ["Licensing lead time and cost."],
    offeringTemplate: () => ({ description: "Beer/wine or cocktail program", deps: [], salePrice: 12, foodCost: 3.5 }),
  },
  {
    slug: "cross-domain-partnership",
    title: "Co-marketing with a high-affinity local brand or show",
    segment: "Fans of the non-food brands and media this audience also loves",
    summary: "Partner with a brand, podcast or artist that the taste graph links to this cuisine's fans: a bundle, a mention, or a pop-up night. This only exists because of cross-domain affinity.",
    triggerTags: [],
    triggerCrossDomains: ["brand", "podcast", "artist", "tv_show"],
    requirements: { anyServiceFormat: ["dine_in", "takeout", "third_party_delivery"] },
    operationalComplexity: 2,
    genericPriority: 0.1,
    channelNames: ["Partner outreach (email/DM)", "Co-branded social post", "Pop-up event listing"],
    riskNotes: ["Partner interest is unverified until contacted; affinity is not a partnership agreement."],
    offeringTemplate: (menu) => {
      const s = signature(menu);
      return { description: `Partner-themed bundle featuring ${s?.name ?? "signature dish"} + drink`, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 5, foodCost: cost(s) + 1.4 };
    },
  },
  {
    slug: "delivery-virtual-brand",
    title: "Delivery-only virtual brand",
    segment: "Delivery-app browsers in a 3-mile radius",
    summary: "List a narrow, delivery-friendly sub-menu under a second brand name on delivery apps.",
    triggerTags: ["delivery", "takeout"],
    requirements: { anyServiceFormat: ["third_party_delivery"], needsDelivery: true },
    operationalComplexity: 2,
    genericPriority: 0.7,
    channelNames: ["DoorDash / Uber Eats virtual brand program"],
    riskNotes: ["Commission-heavy economics; dish must travel well."],
    offeringTemplate: (menu) => {
      const s = pick(menu, ["rice", "noodle"])[0] ?? signature(menu);
      return { description: `Delivery-only sub-menu led by ${s?.name ?? "signature dish"}`, deps: [s?.name ?? ""].filter(Boolean), salePrice: price(s) + 2, foodCost: cost(s) };
    },
  },
];
