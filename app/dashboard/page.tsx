import Dashboard from "./dashboard";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getDashboardData } from "@/lib/admin-data";
import { getBillingStateForUser } from "@/lib/billing";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user.email)) redirect("/admin");
  const billing = await getBillingStateForUser(user.id);
  if (!billing.accessAllowed) redirect("/billing?blocked=1");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "";
  const data = await getDashboardData(user.id, user.email, user.full_name, origin);
  return <Dashboard initialData={data} />;
}
