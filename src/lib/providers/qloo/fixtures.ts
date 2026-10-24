/**
 * SYNTHETIC sample dataset. These are NOT Qloo responses (hackathon rule: never store Qloo
 * response data in a public repo). Entity names, ids and values are invented to exercise the
 * product flow deterministically. Every consumer labels this as
 * "Sample dataset — illustrative, not live Qloo data".
 */
import type { AudienceAffinity, CulturalSignal, HeatmapCell, TagSignal } from "./types";

export const SAMPLE_LABEL = "Sample dataset — illustrative, not live Qloo data";

const sid = (n: number) => `sample-entity-${n.toString().padStart(4, "0")}`;

export const samplePlaceSignals: CulturalSignal[] = [
  {
    entityId: sid(1), name: "Sample Late-Night Dumpling Bar", domain: "place", subtype: "urn:entity:place",
    popularity: 0.71, affinity: 0.86,
    tags: [
      { id: "urn:tag:genre:place:restaurant:chinese", name: "Chinese" },
      { id: "urn:tag:amenity:place:late_night", name: "Late night" },
      { id: "urn:tag:offerings:place:dumplings", name: "Dumplings" },
    ],
    properties: { city: "San Francisco", neighborhood: "Inner Sunset", priceLevel: 2, businessRating: 4.4 },
  },
  {
    entityId: sid(2), name: "Sample Plant-Forward Noodle Shop", domain: "place", subtype: "urn:entity:place",
    popularity: 0.64, affinity: 0.81,
    tags: [
      { id: "urn:tag:genre:place:restaurant:taiwanese", name: "Taiwanese" },
      { id: "urn:tag:dietary:place:vegetarian_friendly", name: "Vegetarian friendly" },
      { id: "urn:tag:offerings:place:lunch_specials", name: "Lunch specials" },
    ],
    properties: { city: "San Francisco", neighborhood: "Inner Sunset", priceLevel: 2, businessRating: 4.5 },
  },
  {
    entityId: sid(3), name: "Sample Boba & Dessert Lounge", domain: "place", subtype: "urn:entity:place",
    popularity: 0.77, affinity: 0.74,
    tags: [
      { id: "urn:tag:offerings:place:bubble_tea", name: "Bubble tea" },
      { id: "urn:tag:amenity:place:study_friendly", name: "Study friendly" },
    ],
    properties: { city: "San Francisco", neighborhood: "Inner Sunset", priceLevel: 1, businessRating: 4.3 },
  },
  {
    entityId: sid(4), name: "Sample Hot Pot House", domain: "place", subtype: "urn:entity:place",
    popularity: 0.69, affinity: 0.63,
    tags: [
      { id: "urn:tag:genre:place:restaurant:hot_pot", name: "Hot pot" },
      { id: "urn:tag:amenity:place:groups", name: "Good for groups" },
    ],
    properties: { city: "San Francisco", neighborhood: "Sunset District", priceLevel: 3, businessRating: 4.2 },
  },
  {
    entityId: sid(5), name: "Sample Weekend Brunch Café", domain: "place", subtype: "urn:entity:place",
    popularity: 0.58, affinity: 0.41,
    tags: [
      { id: "urn:tag:offerings:place:brunch", name: "Brunch" },
      { id: "urn:tag:amenity:place:outdoor_seating", name: "Outdoor seating" },
    ],
    properties: { city: "San Francisco", neighborhood: "Inner Sunset", priceLevel: 2, businessRating: 4.1 },
  },
];

/** Cross-domain signals: what people with affinity for the restaurant's cuisine tags also like. */
export const sampleCrossDomainSignals: CulturalSignal[] = [
  {
    entityId: sid(11), name: "Sample Indie Food Podcast", domain: "podcast", subtype: "urn:entity:podcast",
    popularity: 0.55, affinity: 0.83, tags: [{ id: "urn:tag:genre:podcast:food", name: "Food" }], properties: {},
  },
  {
    entityId: sid(12), name: "Sample Trail-Running Apparel Brand", domain: "brand", subtype: "urn:entity:brand",
    popularity: 0.62, affinity: 0.79, tags: [{ id: "urn:tag:category:brand:outdoor", name: "Outdoor" }], properties: {},
  },
  {
    entityId: sid(13), name: "Sample Lo-fi Beats Artist", domain: "artist", subtype: "urn:entity:artist",
    popularity: 0.73, affinity: 0.77, tags: [{ id: "urn:tag:genre:music:lofi", name: "Lo-fi" }], properties: {},
  },
  {
    entityId: sid(14), name: "Sample Campus Comedy Series", domain: "tv_show", subtype: "urn:entity:tv_show",
    popularity: 0.68, affinity: 0.72, tags: [{ id: "urn:tag:genre:media:comedy", name: "Comedy" }], properties: {},
  },
  {
    entityId: sid(15), name: "Sample Specialty Coffee Roaster", domain: "brand", subtype: "urn:entity:brand",
    popularity: 0.6, affinity: 0.7, tags: [{ id: "urn:tag:category:brand:coffee", name: "Coffee" }], properties: {},
  },
];

export const sampleTagSignals: TagSignal[] = [
  { tagId: "urn:tag:dietary:place:vegetarian_friendly", name: "Vegetarian friendly", subtype: "urn:tag:dietary:place", affinity: 0.84 },
  { tagId: "urn:tag:amenity:place:late_night", name: "Late night", subtype: "urn:tag:amenity:place", affinity: 0.79 },
  { tagId: "urn:tag:offerings:place:lunch_specials", name: "Lunch specials", subtype: "urn:tag:offerings:place", affinity: 0.76 },
  { tagId: "urn:tag:offerings:place:bubble_tea", name: "Bubble tea", subtype: "urn:tag:offerings:place", affinity: 0.71 },
  { tagId: "urn:tag:amenity:place:groups", name: "Good for groups", subtype: "urn:tag:amenity:place", affinity: 0.58 },
  { tagId: "urn:tag:offerings:place:brunch", name: "Brunch", subtype: "urn:tag:offerings:place", affinity: 0.39 },
  { tagId: "urn:tag:offerings:place:full_bar", name: "Full bar", subtype: "urn:tag:offerings:place", affinity: 0.22 },
];

export const sampleDemographics: AudienceAffinity[] = [
  {
    signalId: "urn:tag:genre:place:restaurant:taiwanese",
    age: { "24_and_younger": 0.31, "25_to_29": 0.42, "30_to_34": 0.18, "35_to_44": -0.05, "45_to_54": -0.22, "55_and_older": -0.34 },
    gender: { male: -0.04, female: 0.04 },
  },
];

export const sampleHeatmap: HeatmapCell[] = [
  { lat: 37.7636, lon: -122.4661, geohash: "9q8yu", affinity: 0.92, affinityRank: 0.95, popularity: 0.7 },
  { lat: 37.7749, lon: -122.4194, geohash: "9q8yy", affinity: 0.77, affinityRank: 0.8, popularity: 0.9 },
  { lat: 37.7599, lon: -122.4148, geohash: "9q8yv", affinity: 0.69, affinityRank: 0.7, popularity: 0.85 },
  { lat: 37.7858, lon: -122.4364, geohash: "9q8yz", affinity: 0.48, affinityRank: 0.5, popularity: 0.6 },
];

export const sampleCuisineTags: TagSignal[] = [
  { tagId: "urn:tag:genre:place:restaurant:taiwanese", name: "Taiwanese", subtype: "urn:tag:genre:place" },
  { tagId: "urn:tag:genre:place:restaurant:chinese", name: "Chinese", subtype: "urn:tag:genre:place" },
];
