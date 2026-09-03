import Dashboard from "./dashboard";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/admin-data";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getDashboardData(user.id, user.email, user.full_name);
  return <Dashboard initialData={data} />;
}
