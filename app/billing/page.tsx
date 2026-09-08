import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBillingStateForUser } from "@/lib/billing";
import BillingPageClient from "./billing-page";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const billing = await getBillingStateForUser(user.id);
  return <BillingPageClient billing={billing} />;
}
