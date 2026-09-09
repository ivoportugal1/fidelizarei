import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getBillingStateForUser } from "@/lib/billing";
import BillingPageClient from "./billing-page";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user.email)) redirect("/admin");
  const billing = await getBillingStateForUser(user.id);
  return <BillingPageClient billing={billing} />;
}
