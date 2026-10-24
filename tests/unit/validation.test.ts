import { describe, it, expect } from "vitest";
import { canTransition, parseMenuText, restaurantInputSchema } from "@/lib/validation/schemas";

describe("validation", () => {
  it("parses menu text lines and ignores junk", () => {
    const m = parseMenuText("Beef Noodle Soup | noodles | 18.5 | 6.4\n\nScallion Pancake|small_plates|8\nOnlyName\n");
    expect(m).toHaveLength(3);
    expect(m[0]).toEqual({ name: "Beef Noodle Soup", category: "noodles", price: 18.5, foodCost: 6.4 });
    expect(m[1].foodCost).toBeNull();
    expect(m[2].category).toBe("main");
  });

  it("validates restaurant input with defaults", () => {
    const r = restaurantInputSchema.parse({ name: "X", cuisine: "Thai", serviceFormats: ["dine_in"] });
    expect(r.city).toBe("San Francisco");
    expect(r.avgTicket).toBe(24);
    expect(() => restaurantInputSchema.parse({ name: "", cuisine: "Thai", serviceFormats: ["dine_in"] })).toThrow();
    expect(() => restaurantInputSchema.parse({ name: "X", cuisine: "Thai", serviceFormats: [] })).toThrow();
  });

  it("enforces action state machine and approval gate", () => {
    expect(canTransition("draft", "ready", { requiresApproval: true, hasApproval: false }).ok).toBe(false);
    expect(canTransition("draft", "ready", { requiresApproval: false, hasApproval: false }).ok).toBe(true);
    expect(canTransition("needs_approval", "ready", { requiresApproval: true, hasApproval: false }).ok).toBe(false);
    expect(canTransition("needs_approval", "ready", { requiresApproval: true, hasApproval: true }).ok).toBe(true);
    expect(canTransition("ready", "completed", { requiresApproval: false, hasApproval: false }).ok).toBe(false);
    expect(canTransition("in_progress", "completed", { requiresApproval: false, hasApproval: false }).ok).toBe(true);
    expect(canTransition("completed", "canceled", { requiresApproval: false, hasApproval: false }).ok).toBe(false);
    expect(canTransition("in_progress", "canceled", { requiresApproval: false, hasApproval: false }).ok).toBe(true);
  });
});
