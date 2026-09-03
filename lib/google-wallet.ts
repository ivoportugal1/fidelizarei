import { createSign } from "node:crypto";
import { query } from "./database";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type WalletContext = {
  customer_id: string;
  full_name: string | null;
  phone_e164: string | null;
  organization_name: string;
  program_id: string;
  program_name: string;
  reward_name: string;
  points_to_reward: number;
  points: number;
  rewards_available: number;
};

function base64url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("google_wallet_not_configured");
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) throw new Error("google_wallet_not_configured");
  return parsed;
}

function signJwt(payload: unknown, privateKey: string) {
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

function suffix(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

export async function createGoogleWalletSaveLink(customerId: string, origin: string) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) throw new Error("google_wallet_not_configured");

  const credentials = parseServiceAccount();
  const result = await query<WalletContext>(`
    select c.id as customer_id, c.full_name, c.phone_e164, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name, p.points_to_reward,
           coalesce(lb.points, 0) as points, coalesce(lb.rewards_available, 0) as rewards_available
    from customers c
    join organizations o on o.id = c.organization_id
    join loyalty_programs p on p.organization_id = o.id and p.active = true
    left join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = p.id
    where c.id = $1
    order by p.created_at asc
    limit 1`, [customerId]);
  const context = result.rows[0];
  if (!context) throw new Error("customer_not_found");

  const classId = `${issuerId}.${suffix(context.program_id)}`;
  const objectId = `${issuerId}.${suffix(context.customer_id)}`;
  const originHost = new URL(origin).host;
  const accountName = context.full_name || context.phone_e164 || "Cliente Fideliza";

  const loyaltyClass = {
    id: classId,
    issuerName: context.organization_name,
    programName: context.program_name,
    reviewStatus: "UNDER_REVIEW",
  };

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: context.customer_id,
    accountName,
    loyaltyPoints: {
      label: "Pontos",
      balance: { int: Number(context.points) },
    },
    textModulesData: [
      {
        header: "Recompensas disponíveis",
        body: String(context.rewards_available),
        id: "rewards_available",
      },
      {
        header: "Regra",
        body: `${context.points_to_reward} pontos = ${context.reward_name}`,
        id: "reward_rule",
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: context.customer_id,
    },
  };

  const token = signJwt({
    iss: credentials.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [originHost],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  }, credentials.private_key);

  await query(`
    insert into wallet_passes (customer_id, program_id, platform, serial_number)
    values ($1, $2, 'google', $3)
    on conflict (customer_id, program_id, platform) do update set status = 'active'`,
    [context.customer_id, context.program_id, objectId]);

  return `https://pay.google.com/gp/v/save/${token}`;
}
