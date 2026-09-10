import { createSign } from "node:crypto";
import { query } from "./database";
import { defaultWalletSettings, getWalletCardSettings } from "./wallet-settings";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type WalletContext = {
  customer_id: string;
  full_name: string | null;
  phone_e164: string | null;
  customer_created_at: Date;
  organization_id: string;
  organization_name: string;
  program_id: string;
  program_name: string;
  reward_name: string;
  points_to_reward: number;
  pass_background_color: string;
  points: number;
  rewards_available: number;
};

const progressIcons: Record<string, { active: string; inactive: string }> = {
  cafeteria: { active: "☕", inactive: "○" },
  acaiteria: { active: "●", inactive: "○" },
  sorveteria: { active: "🍦", inactive: "○" },
  pizzaria: { active: "🍕", inactive: "○" },
  hamburgueria: { active: "🍔", inactive: "○" },
  padaria: { active: "🥐", inactive: "○" },
  barbearia: { active: "✂️", inactive: "○" },
  petshop: { active: "🐾", inactive: "○" },
  universal: { active: "●", inactive: "○" },
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

async function getGoogleAccessToken(credentials: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }, credentials.private_key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json() as GoogleTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(`google_wallet_auth_failed:${body.error || response.status}`);
  }
  return body.access_token;
}

async function walletRequest(method: "GET" | "POST" | "PATCH", path: string, accessToken: string, body?: unknown) {
  const response = await fetch(`https://walletobjects.googleapis.com/walletobjects/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) as { error?: { code?: number; status?: string; message?: string } } : {};
  return { response, parsed };
}

function walletErrorDetail(parsed: { error?: { status?: string; message?: string } }, status: number) {
  const reason = parsed.error?.status || status;
  const message = parsed.error?.message ? `:${parsed.error.message.slice(0, 240)}` : "";
  return `${reason}${message}`;
}

async function upsertWalletResource(kind: "loyaltyClass" | "loyaltyObject", id: string, accessToken: string, body: unknown) {
  const encodedId = encodeURIComponent(id);
  const existing = await walletRequest("GET", `/${kind}/${encodedId}`, accessToken);
  if (existing.response.ok) {
    const patched = await walletRequest("PATCH", `/${kind}/${encodedId}`, accessToken, body);
    if (!patched.response.ok) {
      throw new Error(`google_wallet_${kind}_patch_failed:${walletErrorDetail(patched.parsed, patched.response.status)}`);
    }
    return;
  }
  if (existing.response.status !== 404) {
    throw new Error(`google_wallet_${kind}_get_failed:${walletErrorDetail(existing.parsed, existing.response.status)}`);
  }

  const inserted = await walletRequest("POST", `/${kind}`, accessToken, body);
  if (!inserted.response.ok) {
    throw new Error(`google_wallet_${kind}_insert_failed:${walletErrorDetail(inserted.parsed, inserted.response.status)}`);
  }
}

function suffix(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function progressText(theme: string, current: number, total: number) {
  const icons = progressIcons[theme] ?? progressIcons.universal;
  const limit = Math.max(1, Math.min(total, 20));
  return Array.from({ length: limit }).map((_, index) => index < current ? icons.active : icons.inactive).join(" ");
}

function formatMemberSince(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
    .format(date)
    .replace(".", "");
}

export async function createGoogleWalletSaveLink(customerId: string, origin: string) {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) throw new Error("google_wallet_not_configured");

  const credentials = parseServiceAccount();
  const result = await query<WalletContext>(`
    select c.id as customer_id, c.full_name, c.phone_e164, c.created_at as customer_created_at,
           o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name, p.points_to_reward,
           p.pass_background_color,
           coalesce(lb.points, 0) as points, coalesce(lb.rewards_available, 0) as rewards_available
    from customers c
    join organizations o on o.id = c.organization_id
    join loyalty_programs p on p.organization_id = o.id and p.active = true
    left join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = p.id
    where c.id = $1 and c.status = 'active'
    order by p.created_at asc
    limit 1`, [customerId]);
  const context = result.rows[0];
  if (!context) throw new Error("customer_not_found");

  const classId = `${issuerId}.${suffix(context.program_id)}`;
  const objectId = `${issuerId}.${suffix(context.customer_id)}`;
  const accountName = context.full_name || context.phone_e164 || "Cliente Fideliza";
  const settings = await getWalletCardSettings(context.organization_id, defaultWalletSettings({
    businessName: context.organization_name,
    programName: context.program_name,
    rewardName: context.reward_name,
    pointsToReward: context.points_to_reward,
    backgroundColor: context.pass_background_color,
  }), origin);
  const points = Number(context.points);
  const goal = Number(settings.pointsGoal || context.points_to_reward);
  const remaining = Math.max(goal - points, 0);
  const completed = points >= goal || Number(context.rewards_available) > 0;
  const statusText = completed ? settings.completedMessage : `Faltam ${remaining} ${settings.progressLabel}`;
  const contactLinks = [
    ...(settings.websiteUrl ? [{ uri: settings.websiteUrl, description: "Site", id: "website" }] : []),
    ...(settings.instagramUsername ? [{ uri: `https://instagram.com/${settings.instagramUsername}`, description: "Instagram", id: "instagram" }] : []),
    ...(settings.contactPhone ? [{ uri: `tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`, description: "Telefone", id: "phone" }] : []),
  ];

  const loyaltyClass = {
    id: classId,
    issuerName: settings.businessName,
    programName: settings.programDescription,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: settings.primaryColor,
    programLogo: {
      sourceUri: {
        uri: settings.logoUrl || "https://www.gstatic.com/images/branding/product/1x/wallet_48dp.png",
      },
      contentDescription: {
        defaultValue: {
          language: "pt-BR",
          value: `Logo de ${settings.businessName}`,
        },
      },
    },
    ...(settings.coverUrl ? {
      heroImage: {
        sourceUri: { uri: settings.coverUrl },
        contentDescription: {
          defaultValue: {
            language: "pt-BR",
            value: `Capa do cartão ${settings.businessName}`,
          },
        },
      },
    } : {}),
    textModulesData: [
      {
        header: "Oferta",
        body: settings.rewardTitle,
        id: "offer",
      },
      {
        header: "Como acumular",
        body: settings.accumulationText,
        id: "accumulation",
      },
      ...(settings.termsText ? [{
        header: "Termos e condições",
        body: settings.termsText,
        id: "terms",
      }] : []),
    ],
    ...(contactLinks.length ? { linksModuleData: { uris: contactLinks } } : {}),
  };

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: context.customer_id,
    accountName,
    loyaltyPoints: {
      label: settings.progressLabel,
      balance: { int: points },
    },
    textModulesData: [
      {
        header: "Recompensa",
        body: settings.rewardText,
        id: "reward",
      },
      {
        header: "Seu progresso",
        body: `${points} de ${goal} ${settings.progressLabel}\n${progressText(settings.pointTheme, points, goal)}\n${statusText}`,
        id: "progress",
      },
      {
        header: "Cliente desde",
        body: formatMemberSince(new Date(context.customer_created_at)),
        id: "member_since",
      },
      {
        header: "Recompensas disponíveis",
        body: String(context.rewards_available),
        id: "rewards_available",
      },
      ...(settings.addressText ? [{
        header: "Endereço",
        body: settings.addressText,
        id: "address",
      }] : []),
      {
        header: "Fornecido por",
        body: "Powered by Fidelizarei",
        id: "powered_by",
      },
    ],
  };

  const accessToken = await getGoogleAccessToken(credentials);
  await upsertWalletResource("loyaltyClass", classId, accessToken, loyaltyClass);
  await upsertWalletResource("loyaltyObject", objectId, accessToken, loyaltyObject);

  const token = signJwt({
    iss: credentials.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [origin],
    payload: {
      loyaltyObjects: [{ id: objectId, classId }],
    },
  }, credentials.private_key);

  await query(`
    insert into wallet_passes (customer_id, program_id, platform, serial_number)
    values ($1, $2, 'google', $3)
    on conflict (customer_id, program_id, platform) do update set status = 'active'`,
    [context.customer_id, context.program_id, objectId]);

  return `https://pay.google.com/gp/v/save/${token}`;
}
