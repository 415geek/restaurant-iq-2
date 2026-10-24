import { redirect } from "next/navigation";
import { DEMO_RESTAURANT_ID } from "@/lib/queries";

export default function DemoPage() {
  redirect(`/r/${DEMO_RESTAURANT_ID}`);
}
