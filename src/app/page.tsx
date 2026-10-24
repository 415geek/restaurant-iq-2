import Link from "next/link";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { Badge, Button } from "@/components/ui";

const STEPS = [
  { n: "01", t: "Describe the restaurant", d: "Cuisine, neighborhood, formats, hours, a few menu costs, your objective and constraints. No POS needed." },
  { n: "02", t: "Qloo taste discovery", d: "Server-side calls to Qloo's Insights API: which place attributes, demographics and non-food brands, podcasts and shows your cuisine's fans over-index for, near you." },
  { n: "03", t: "Ranked hypotheses, not promises", d: "A deterministic engine scores taste fit, operational fit, feasibility and unit economics. It also says what not to pursue, and why." },
  { n: "04", t: "Decision Lab + playbook", d: "Adjust price, units, food cost, fees, marketing and cannibalization; contribution margin and break-even recompute instantly. Tasks need your approval before anything goes external." },
  { n: "05", t: "Business memory", d: "Every decision, assumption, approval and outcome is kept, independent of which POS you use next year." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20">
        <section className="pt-14 sm:pt-24">
          <Badge tone="accent">Qloo Agentic Hackathon 2026 · open-source</Badge>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Your POS runs your restaurant.<br />
            <span className="text-accent-ink">Restaurant IQ grows your business.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-2">
            An independent commercial decision brain for independent restaurants. It turns cross-domain taste intelligence from Qloo into ranked, costed, testable opportunities with execution playbooks and a lasting decision memory. Not another POS.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/demo" size="lg">Try the live demo</Button>
            <Button href="/login" variant="secondary" size="lg">Analyze my restaurant</Button>
          </div>
          <p className="mt-3 text-sm text-muted">No account needed for the demo. The demo restaurant is synthetic and clearly labeled.</p>
        </section>

        <section className="mt-16 grid gap-4 sm:mt-24 sm:grid-cols-2 lg:grid-cols-3" aria-label="What it does">
          {[
            ["Outside the four walls", "Most restaurant software reports what already sold. Restaurant IQ looks at who nearby loves what you make, and what else they love."],
            ["Affinity is not demand", "Every number carries its source, freshness and interpretation. Taste affinity is shown as a relation, never as a sales forecast."],
            ["A defensible 'no'", "Hypotheses that break a constraint, have negative per-unit contribution or lack evidence are marked not recommended, with reasons."],
          ].map(([t, d]) => (
            <div key={t} className="card p-5">
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1 text-sm text-ink-2">{d}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 sm:mt-24">
          <h2 className="text-2xl font-semibold tracking-tight">How a session works</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-4">
                <div className="font-mono text-xs text-accent-ink">{s.n}</div>
                <div className="mt-1 font-medium">{s.t}</div>
                <p className="mt-1 text-sm text-ink-2">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 card p-6 sm:mt-24 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">With Qloo vs without Qloo</h2>
          <p className="mt-2 max-w-3xl text-ink-2">
            Generic advice says &quot;run a lunch special&quot;. With Qloo, the engine can see that this cuisine&apos;s fans in this neighborhood over-index for vegetarian-friendly places, a specific podcast and a specific apparel brand, and that the under-25 bucket skews positive. Those signals re-rank the hypotheses, change the target segment, and name the partner to call. The workspace shows exactly which returned signal moved each recommendation.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="/demo">Open the demo workspace</Button>
            <Link href="https://docs.qloo.com/" className="inline-flex h-11 items-center text-sm text-accent-ink underline" target="_blank" rel="noreferrer">Qloo API docs</Link>
          </div>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted">
          <span>Restaurant IQ 2.0 · Taste-to-Profit Agent · MIT License</span>
          <span>Recommendations are hypotheses with stated assumptions. No profitability is promised.</span>
        </footer>
      </main>
    </>
  );
}
