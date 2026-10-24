import { SiteHeader } from "@/components/shell/SiteHeader";
import { RestaurantForm } from "@/components/onboarding/RestaurantForm";

export const metadata = { title: "New restaurant" };

export default function NewRestaurantPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Describe your restaurant</h1>
        <p className="mt-1 text-sm text-muted">A few fields are enough to start. Cost assumptions are editable later in the Decision Lab. Nothing here is shared publicly.</p>
        <div className="mt-6 card p-5"><RestaurantForm /></div>
      </main>
    </>
  );
}
