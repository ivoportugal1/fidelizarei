import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getBeefoodContext } from "@/lib/integrations/beefood/admin";
import { publicAppUrl } from "@/lib/public-url";
import BeefoodSettings from "./beefood-settings";

export const dynamic = "force-dynamic";

export default async function BeefoodPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user.email)) redirect("/admin");
  const context = await getBeefoodContext();
  if (!context) notFound();

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = publicAppUrl(host ? `${protocol}://${host}` : null);
  const { integration } = context;

  return (
    <BeefoodSettings
      initial={{
        enabled: integration.enabled,
        clientId: integration.client_id ?? "",
        hasSecret: Boolean(integration.client_secret_enc),
        minAmount: Number(integration.min_amount),
        webhookUrl: `${origin}/api/integrations/beefood/webhook/${integration.webhook_token}`,
        webhookSecret: integration.webhook_secret,
        counterUrl: `${origin}/balcao/${integration.counter_token}`,
      }}
    />
  );
}
