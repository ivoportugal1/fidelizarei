import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import forge from "node-forge";
import { PKPass } from "passkit-generator";
import { query } from "./database";
import { defaultWalletSettings, getWalletCardSettings } from "./wallet-settings";

const APPLE_WWDR_G4_PEM = `-----BEGIN CERTIFICATE-----
MIIEVTCCAz2gAwIBAgIUE9x3lVJx5T3GMujM/+Uh88zFztIwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkFwcGxlIEluYy4xJjAkBgNVBAsT
HUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRYwFAYDVQQDEw1BcHBsZSBS
b290IENBMB4XDTIwMTIxNjE5MzYwNFoXDTMwMTIxMDAwMDAwMFowdTFEMEIGA1UE
Aww7QXBwbGUgV29ybGR3aWRlIERldmVsb3BlciBSZWxhdGlvbnMgQ2VydGlmaWNh
dGlvbiBBdXRob3JpdHkxCzAJBgNVBAsMAkc0MRMwEQYDVQQKDApBcHBsZSBJbmMu
MQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANAf
eKp6JzKwRl/nF3bYoJ0OKY6tPTKlxGs3yeRBkWq3eXFdDDQEYHX3rkOPR8SGHgjo
v9Y5Ui8eZ/xx8YJtPH4GUnadLLzVQ+mxtLxAOnhRXVGhJeG+bJGdayFZGEHVD41t
QSo5SiHgkJ9OE0/QjJoyuNdqkh4laqQyziIZhQVg3AJK8lrrd3kCfcCXVGySjnYB
5kaP5eYq+6KwrRitbTOFOCOL6oqW7Z+uZk+jDEAnbZXQYojZQykn/e2kv1MukBVl
PNkuYmQzHWxq3Y4hqqRfFcYw7V/mjDaSlLfcOQIA+2SM1AyB8j/VNJeHdSbCb64D
YyEMe9QbsWLFApy9/a8CAwEAAaOB7zCB7DASBgNVHRMBAf8ECDAGAQH/AgEAMB8G
A1UdIwQYMBaAFCvQaUeUdgn+9GuNLkCm90dNfwheMEQGCCsGAQUFBwEBBDgwNjA0
BggrBgEFBQcwAYYoaHR0cDovL29jc3AuYXBwbGUuY29tL29jc3AwMy1hcHBsZXJv
b3RjYTAuBgNVHR8EJzAlMCOgIaAfhh1odHRwOi8vY3JsLmFwcGxlLmNvbS9yb290
LmNybDAdBgNVHQ4EFgQUW9n6HeeaGgujmXYiUIY+kchbd6gwDgYDVR0PAQH/BAQD
AgEGMBAGCiqGSIb3Y2QGAgEEAgUAMA0GCSqGSIb3DQEBCwUAA4IBAQA/Vj2e5bbD
eeZFIGi9v3OLLBKeAuOugCKMBB7DUshwgKj7zqew1UJEggOCTwb8O0kU+9h0UoWv
p50h5wESA5/NQFjQAde/MoMrU1goPO6cn1R2PWQnxn6NHThNLa6B5rmluJyJlPef
x4elUWY0GzlxOSTjh2fvpbFoe4zuPfeutnvi0v/fYcZqdUmVIkSoBPyUuAsuORFJ
EtHlgepZAE9bPFo22noicwkJac3AfOriJP6YRLj477JxPxpd1F1+M02cHSS+APCQ
A1iZQT0xWmJArzmoUUOSqwSonMJNsUvSq3xKX+udO7xPiEAGE/+QF4oIRynoYpgp
pU8RBWk6z/Kf
-----END CERTIFICATE-----`;

type AppleWalletContext = {
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

type AppleCertificates = {
  signerCert: string;
  signerKey: string;
  wwdr: string;
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

function configured() {
  return Boolean(
    process.env.APPLE_PASS_TYPE_IDENTIFIER &&
      process.env.APPLE_TEAM_IDENTIFIER &&
      process.env.APPLE_PASS_CERTIFICATE_BASE64 &&
      process.env.APPLE_PASS_CERTIFICATE_PASSWORD,
  );
}

function extractCertificatesFromP12(): AppleCertificates {
  const rawP12 = process.env.APPLE_PASS_CERTIFICATE_BASE64;
  const password = process.env.APPLE_PASS_CERTIFICATE_PASSWORD;
  if (!rawP12 || !password) throw new Error("apple_wallet_not_configured");

  const der = forge.util.decode64(rawP12);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];

  const cert = certBags.find((bag) => bag.cert)?.cert;
  const key = keyBags.find((bag) => bag.key)?.key;
  if (!cert || !key) throw new Error("apple_wallet_invalid_certificate");

  return {
    signerCert: forge.pki.certificateToPem(cert),
    signerKey: forge.pki.privateKeyToPem(key),
    wwdr: process.env.APPLE_WWDR_CERTIFICATE_BASE64
      ? Buffer.from(process.env.APPLE_WWDR_CERTIFICATE_BASE64, "base64").toString("utf8")
      : APPLE_WWDR_G4_PEM,
  };
}

function hexToRgb(color: string) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#173D20";
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgb(${red}, ${green}, ${blue})`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "F";
}

function formatMemberSince(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
    .format(date)
    .replace(".", "");
}

function progressText(theme: string, current: number, total: number) {
  const icons = progressIcons[theme] ?? progressIcons.universal;
  const limit = Math.max(1, Math.min(total, 20));
  return Array.from({ length: limit }).map((_, index) => index < current ? icons.active : icons.inactive).join(" ");
}

function passAuthToken(serialNumber: string) {
  const secret = process.env.APPLE_PASS_AUTH_SECRET || process.env.CUSTOMER_SESSION_SECRET || process.env.APPLE_PASS_CERTIFICATE_PASSWORD;
  if (!secret) throw new Error("apple_wallet_not_configured");
  return createHmac("sha256", secret).update(serialNumber).digest("hex");
}

async function getFallbackLogo() {
  return readFile(path.join(process.cwd(), "public", "logo-fidelizarei-transparent.png"));
}

async function fetchPngAsset(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image/png")) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function passJson(input: {
  serialNumber: string;
  organizationName: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  webServiceURL: string;
  authenticationToken: string;
}) {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER;
  if (!passTypeIdentifier || !teamIdentifier) throw new Error("apple_wallet_not_configured");

  return {
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    serialNumber: input.serialNumber,
    organizationName: input.organizationName,
    description: input.description,
    logoText: input.organizationName,
    backgroundColor: input.backgroundColor,
    foregroundColor: input.foregroundColor,
    labelColor: input.labelColor,
    webServiceURL: input.webServiceURL,
    authenticationToken: input.authenticationToken,
    sharingProhibited: false,
    storeCard: {
      primaryFields: [],
      secondaryFields: [],
      auxiliaryFields: [],
      backFields: [],
    },
  };
}

export async function createAppleWalletPass(customerId: string, origin: string, expectedSerialNumber?: string) {
  if (!configured()) throw new Error("apple_wallet_not_configured");

  const result = await query<AppleWalletContext>(`
    select c.id as customer_id, c.full_name, c.phone_e164, c.created_at as customer_created_at,
           o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name, p.points_to_reward,
           p.pass_background_color,
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

  const settings = await getWalletCardSettings(context.organization_id, defaultWalletSettings({
    businessName: context.organization_name,
    programName: context.program_name,
    rewardName: context.reward_name,
    pointsToReward: context.points_to_reward,
    backgroundColor: context.pass_background_color,
  }), origin);

  const serialNumber = `apple-${context.customer_id}-${context.program_id}`;
  if (expectedSerialNumber && expectedSerialNumber !== serialNumber) throw new Error("pass_not_found");
  const customerName = context.full_name || context.phone_e164 || "Cliente";
  const currentPoints = Number(context.points);
  const pointsGoal = Number(settings.pointsGoal || context.points_to_reward);
  const remaining = Math.max(pointsGoal - currentPoints, 0);
  const completed = currentPoints >= pointsGoal || Number(context.rewards_available) > 0;
  const statusText = completed ? settings.completedMessage : `Faltam ${remaining} ${settings.progressLabel}`;
  const token = passAuthToken(serialNumber);
  const certificates = extractCertificatesFromP12();
  const brandLogo = await getFallbackLogo();
  const merchantLogo = await fetchPngAsset(settings.logoUrl) ?? brandLogo;
  const stripImage = await fetchPngAsset(settings.coverUrl);

  const pass = new PKPass({
    "pass.json": Buffer.from(JSON.stringify(passJson({
      serialNumber,
      organizationName: settings.businessName,
      description: settings.programDescription,
      backgroundColor: hexToRgb(settings.primaryColor),
      foregroundColor: hexToRgb(settings.textColor),
      labelColor: hexToRgb(settings.secondaryColor),
      webServiceURL: `${origin}/api/wallet/apple`,
      authenticationToken: token,
    }))),
    "icon.png": brandLogo,
    "icon@2x.png": brandLogo,
    "icon@3x.png": brandLogo,
    "logo.png": merchantLogo,
    "logo@2x.png": merchantLogo,
    "logo@3x.png": merchantLogo,
    ...(stripImage ? {
      "strip.png": stripImage,
      "strip@2x.png": stripImage,
      "strip@3x.png": stripImage,
    } : {}),
  }, certificates);

  pass.primaryFields.push({
    key: "offer",
    label: "RECOMPENSA",
    value: settings.rewardTitle,
  });
  pass.secondaryFields.push({
    key: "progress_visual",
    label: `${currentPoints} de ${pointsGoal} ${settings.progressLabel}`,
    value: progressText(settings.pointTheme, currentPoints, pointsGoal),
  });
  pass.auxiliaryFields.push({
    key: "reward_status",
    label: "STATUS",
    value: statusText,
  });
  pass.auxiliaryFields.push({
    key: "customer",
    label: "CLIENTE",
    value: customerName,
  });
  pass.auxiliaryFields.push({
    key: "member_since",
    label: "MEMBRO DESDE",
    value: formatMemberSince(new Date(context.customer_created_at)),
  });
  pass.headerFields.push({
    key: "status",
    label: settings.progressLabel.toUpperCase(),
    value: `${currentPoints}/${pointsGoal}`,
  });
  pass.backFields.push({
    key: "program",
    label: "Programa",
    value: settings.programDescription,
  });
  pass.backFields.push({
    key: "rule",
    label: "Como funciona",
    value: settings.accumulationText,
  });
  pass.backFields.push({
    key: "progress",
    label: "Progresso",
    value: `${currentPoints} de ${pointsGoal} ${settings.progressLabel}. ${statusText}.`,
  });
  pass.backFields.push({
    key: "rewards",
    label: "Recompensas disponíveis",
    value: String(context.rewards_available),
  });
  if (settings.termsText) {
    pass.backFields.push({
      key: "terms",
      label: "Termos e condições",
      value: settings.termsText,
    });
  }
  if (settings.addressText) {
    pass.backFields.push({
      key: "address",
      label: "Endereço",
      value: settings.addressText,
    });
  }
  if (settings.instagramUsername) {
    pass.backFields.push({
      key: "instagram",
      label: "Instagram",
      value: `@${settings.instagramUsername}`,
    });
  }
  if (settings.websiteUrl) {
    pass.backFields.push({
      key: "website",
      label: "Site",
      value: settings.websiteUrl,
    });
  }
  if (settings.contactPhone) {
    pass.backFields.push({
      key: "phone",
      label: "Telefone",
      value: settings.contactPhone,
    });
  }
  pass.backFields.push({
    key: "powered_by",
    label: "Powered by",
    value: "Fidelizarei",
  });

  await query(`
    insert into wallet_passes (customer_id, program_id, platform, serial_number, authentication_token, updated_at)
    values ($1, $2, 'apple', $3, $4, now())
    on conflict (customer_id, program_id, platform) do update set
      status = 'active',
      authentication_token = excluded.authentication_token,
      updated_at = now()`,
    [context.customer_id, context.program_id, serialNumber, token]);

  return {
    buffer: pass.getAsBuffer(),
    filename: `${settings.businessName.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "fidelizarei"}.pkpass`,
  };
}

export async function validateApplePassAuth(serialNumber: string, authorization: string | null) {
  const [, token] = authorization?.match(/^ApplePass\s+(.+)$/) ?? [];
  if (!token || token !== passAuthToken(serialNumber)) return null;
  const result = await query<{ customer_id: string }>(
    "select customer_id from wallet_passes where platform = 'apple' and serial_number = $1 and status = 'active' limit 1",
    [serialNumber],
  );
  return result.rows[0]?.customer_id ?? null;
}
