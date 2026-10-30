import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { QlooProvider } from "@/lib/providers/qloo";
import { scoreLift } from "./lift";
import { applyGuardrails, applyMoves, deterministicProposal, identityItems, proposalSchema, type ProposalInput } from "./moves";
import { CallLog, compareRival, neighborhoodProfile, placeSets, rankFeatures } from "./qloo";
import type { Guardrails, ItemLift, MenuItem, Move, NeighborhoodProfile, QlooCallRecord, RunEvent, Store, StorefrontVersion, VersionSource } from "./types";

/**
 * The TasteFront agent for one store. Deterministic code gathers and scores (neighborhood profile, crowd-vs-city lift,
 * feature ranking, rival contrast); the model chooses among candidates and writes copy through the `propose_moves` tool;
 * the verifier and guardrails run after it. The "baseline" variant runs the same prompt with every Qloo tool replaced by
 * a neutral stub, so the public page can flip between "Qloo on" and "Qloo off".
 */
export interface AgentInput { store: Store; items: MenuItem[]; guardrails: Guardrails; singleStore: boolean; provider: QlooProvider; variant: VersionSource; emit?: (e: RunEvent) => void; model?: string; anthropic?: Anthropic | null }
export interface AgentOutput { calls: QlooCallRecord[]; moves: Move[]; items: StorefrontVersion["items"]; caveats: string[]; profile: NeighborhoodProfile | null; lifts: ItemLift[]; modelUsed: string | null; events: RunEvent[] }

export const SYSTEM_PROMPT = `You are TasteFront, the agent that tunes one restaurant's public menu to its neighborhood.
Rules you never break:
- Use only tool outputs as facts. Never invent a tag, a score, an ingredient, an origin, a health or allergen claim.
- Cite names and scores exactly as the tools returned them (callId + name + score). The server verifies every citation.
- Affinity and lift mean "this crowd leans toward"; never call them demand, prediction or proof of sales.
- When a tool returns empty or an error, say so in caveats instead of guessing.
- Keep the source-language item name; add or keep an English name; descriptions are at most 14 words and lean on at most two neighborhood tags named plainly.
- Respect the guardrails you are given (banned terms, renamable items, caps: 1-3 features, at most 1 promote, at most 1 pass, at most 7 moves).
- Your final answer is exactly one propose_moves call. No prose after it.`;

function anthropicClient(explicit?: Anthropic | null): Anthropic | null {
  if (explicit !== undefined) return explicit;
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
}

export async function runStorefrontAgent(input: AgentInput): Promise<AgentOutput> {
  const { store, items, guardrails, singleStore, provider, variant } = input;
  const events: RunEvent[] = []; const t0 = Date.now();
  const emit = (step: string, detail: string, callId?: string) => { const e: RunEvent = { t: Date.now() - t0, step, detail, ...(callId ? { callId } : {}) }; events.push(e); input.emit?.(e); };
  const log = new CallLog();
  const caveats: string[] = [];
  const qloo = variant === "qloo";

  emit("resolve_store", `${store.name} · ${store.neighborhood}, ${store.city} · ${items.length} menu items`);
  // 1) neighborhood profile (location signal)
  let profile: NeighborhoodProfile | null = null;
  if (qloo) {
    profile = await neighborhoodProfile(provider, store, log);
    caveats.push(...profile.caveats);
    const top = profile.tags.slice(0, 5).map((t) => `${t.name}${t.affinity !== null ? ` ${t.affinity}` : ""}`).join(", ");
    emit("neighborhood_profile", top ? `This crowd leans toward: ${top}` : "No neighborhood tags returned", log.calls[0]?.id);
  } else emit("neighborhood_profile", "Qloo off: neutral prior, no neighborhood tags");
  // 2) crowd-vs-city lift
  let lifts: ItemLift[] = items.map((i) => ({ itemId: i.id, lift: null, terms: [], lowCount: false, reason: "no_terms" as const }));
  if (qloo) {
    const sets = await placeSets(provider, store, log);
    caveats.push(...sets.caveats);
    const scored = scoreLift({ crowd: sets.crowd, city: sets.city, items });
    lifts = scored.items;
    const withLift = lifts.filter((l) => l.lift !== null).sort((a, b) => (b.lift ?? 0) - (a.lift ?? 0));
    const nameOf = new Map(items.map((i) => [i.id, i.nameEn ?? i.name]));
    // lift terms become a verifiable record of their own (computed in code from the two place sets above)
    const terms = new Map<string, number>(); for (const l of lifts) for (const t of l.terms) terms.set(t.term, t.lift);
    const liftRec = sets.crowdCall ? log.add("rank", { ...sets.crowdCall.provenance, endpoint: "lift.ts (crowd-vs-city from /v2/insights place sets)" }, [...terms.entries()].map(([name, score]) => ({ name, score }))) : null;
    emit("dish_lift", `${sets.crowd.length} crowd menus vs ${sets.city.length} city menus · ${withLift.slice(0, 3).map((l) => `${nameOf.get(l.itemId)} ×${l.lift}`).join(", ") || "no menu terms matched"}`, liftRec?.id ?? sets.crowdCall?.id);
  } else emit("dish_lift", "Qloo off: no contrast computed");
  // 3) rank + rival
  const liftMap = Object.fromEntries(lifts.map((l) => [l.itemId, l.lift]));
  const ranked = profile ? rankFeatures(items, profile, liftMap) : items.map((i) => ({ itemId: i.id, score: null, tags: [], lift: null }));
  const nameOf = new Map(items.map((i) => [i.id, i.nameEn ?? i.name]));
  emit("rank_features", ranked.filter((r) => r.lift !== null || r.score !== null).slice(0, 3).map((r) => `${nameOf.get(r.itemId)}${r.lift !== null ? ` ×${r.lift}` : ""}${r.score !== null ? ` (${r.score})` : ""}`).join(", ") || "nothing to rank");
  const rival = qloo ? compareRival(store, items, (await placeSets(provider, store, log, 1)).crowd) : { rival: null, theirsOnly: [], oursOnly: [] };
  if (rival.rival) emit("compare_rival", `${rival.rival}: they carry ${rival.theirsOnly.slice(0, 3).join(", ") || "nothing we lack"}; we carry ${rival.oursOnly.slice(0, 3).join(", ")}`);

  // 4) propose moves: model (tool runner) or deterministic fallback
  const client = anthropicClient(input.anthropic);
  const model = input.model ?? process.env.TASTEFRONT_MODEL ?? "claude-opus-5-5";
  let proposal: ProposalInput | null = null; let modelUsed: string | null = null;
  const context = {
    store: { name: store.name, neighborhood: store.neighborhood, city: store.city, cuisine: store.cuisine, language: store.language, singleStore },
    guardrails,
    menu: items.map((i) => ({ itemId: i.id, name: i.name, nameEn: i.nameEn, description: i.description, priceCents: i.priceCents, costCents: i.costCents, category: i.category, sortIndex: i.sortIndex, ambiguous: i.ambiguous })),
    neighborhood: profile ? { callId: log.calls.find((c) => c.purpose === "neighborhood_tags")?.id ?? null, tags: profile.tags.slice(0, 12), demographics: profile.demographics } : { callId: null, tags: [], demographics: null, note: "Qloo off: neutral prior" },
    lift: lifts.filter((l) => l.lift !== null).map((l) => ({ itemId: l.itemId, lift: l.lift, lowCount: l.lowCount, terms: l.terms.map((t) => `${t.term} ×${t.lift}`) })),
    liftCallId: log.calls.find((c) => c.purpose === "rank")?.id ?? null,
    ranked: ranked.slice(0, 8),
    rival,
  };
  if (client) {
    emit("propose_moves", `Asking ${model} to choose moves and write copy…`);
    try {
      proposal = await proposeWithModel(client, model, context, (p) => { proposal = p; });
      modelUsed = model;
    } catch (e) {
      caveats.push(`Model proposal failed (${e instanceof Error ? e.message.slice(0, 120) : "error"}); used the deterministic fallback.`);
    }
  } else caveats.push("ANTHROPIC_API_KEY is not configured: order and featured items were chosen deterministically; no copy was rewritten.");
  if (!proposal) proposal = profile ? deterministicProposal({ items, ranked, lifts, profile, calls: log.calls }) : { moves: [], caveats: ["Qloo off and no model: the menu stays as printed."] };
  caveats.push(...proposal.caveats);
  // 5) guardrails + verifier + apply
  const moves = applyGuardrails(proposal, { items, guardrails, singleStore, calls: log.calls });
  const kept = moves.filter((m) => m.guardrail?.ok !== false);
  emit("apply_guardrails", `${kept.length} of ${moves.length} moves pass guardrails · ${kept.filter((m) => m.verified).length} fully verified`);
  const versionItems = kept.length ? applyMoves(items, moves) : identityItems(items);
  emit("draft_version", `${versionItems.filter((i) => i.changed.length).length} items changed`);
  return { calls: log.calls, moves, items: versionItems, caveats: Array.from(new Set(caveats)), profile, lifts, modelUsed, events };
}

/** One tool-runner conversation. Every data tool returns the precomputed, deterministic context; propose_moves captures the answer. */
async function proposeWithModel(client: Anthropic, model: string, ctx: Record<string, unknown>, onProposal: (p: ProposalInput) => void): Promise<ProposalInput> {
  let captured: ProposalInput | null = null;
  const json = (v: unknown) => JSON.stringify(v);
  const tools = [
    betaZodTool({ name: "resolve_store", description: "The store, its neighborhood, language and HQ guardrails.", inputSchema: z.object({}), run: async () => json({ store: ctx.store, guardrails: ctx.guardrails }) }),
    betaZodTool({ name: "parse_menu", description: "The parsed menu: itemId, names, description, price/cost in cents, category, current order.", inputSchema: z.object({}), run: async () => json(ctx.menu) }),
    betaZodTool({ name: "neighborhood_profile", description: "Qloo tags people around the store lean toward (name, affinity 0..1) and demographics. Cite with its callId.", inputSchema: z.object({}), run: async () => json(ctx.neighborhood) }),
    betaZodTool({ name: "dish_lift", description: "Crowd-vs-city lift per menu item (×1.0 = same as the city). Computed in code from Qloo place sets; cite the callIds given.", inputSchema: z.object({}), run: async () => json({ lift: ctx.lift, callId: ctx.liftCallId, note: "cite a term with its lift as evidence {callId, name: term, score: lift}" }) }),
    betaZodTool({ name: "rank_features", description: "Candidate featured items ranked by mean neighborhood affinity of their tags, with the tags that counted.", inputSchema: z.object({}), run: async () => json(ctx.ranked) }),
    betaZodTool({ name: "compare_rival", description: "Nearest similar place and the dishes only one side carries.", inputSchema: z.object({}), run: async () => json(ctx.rival) }),
    betaZodTool({
      name: "propose_moves",
      description: "Your final answer: at most 7 moves. kinds: reorder (after.sortIndex), rename (after.name/nameEn/description), feature (1-3), promote (≤1, after.promoteBudgetCents), pass (≤1). Each move cites evidence [{callId,name,score,sentence}] copied exactly from tool outputs.",
      inputSchema: proposalSchema,
      run: async (p) => { captured = p; onProposal(p); return "recorded"; },
    }),
  ];
  const runner = client.beta.messages.toolRunner({
    model, max_tokens: 16000, max_iterations: 12,
    system: SYSTEM_PROMPT,
    tools,
    messages: [{ role: "user", content: "Read the store, menu, neighborhood profile, lift, ranking and rival with the tools, then call propose_moves once. Prefer a few well-cited moves over many weak ones. Write descriptions in the store's language plus English." }],
  });
  for await (const msg of runner) {
    if (captured) break;
    if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") break;
  }
  if (!captured) throw new Error("the model did not call propose_moves");
  return captured;
}
