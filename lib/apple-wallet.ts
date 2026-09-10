import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import forge from "node-forge";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { query } from "./database";
import { defaultWalletSettings, getWalletCardSettings, type WalletCardSettings } from "./wallet-settings";

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

function formatValidUntil(date: Date) {
  const valid = new Date(date);
  valid.setFullYear(valid.getFullYear() + 1);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(valid);
}

function progressText(theme: string, current: number, total: number) {
  const limit = Math.max(1, Math.min(total, 20));
  if (limit > 12) return `${Math.min(current, total)} de ${total}`;
  return Array.from({ length: limit }).map((_, index) => index < current ? "●" : "○").join(" ");
}

const progressIconPaths: Record<string, string[]> = {
  cafeteria: [
    "M4 8h11.5v5.3a4.8 4.8 0 0 1-4.8 4.8H8.8A4.8 4.8 0 0 1 4 13.3V8Z",
    "M15.5 10h2.1a2.3 2.3 0 0 1 0 4.6h-2.1",
    "M7 5.2h6",
  ],
  acaiteria: [
    "M5 9h14l-1.5 8.5H6.5L5 9Z",
    "M8 9c.4-2.1 1.8-3.2 4-3.2s3.6 1.1 4 3.2",
    "M8.8 13h6.4",
  ],
  sorveteria: [
    "M8 10a4 4 0 0 1 8 0",
    "M7 10h10l-5 10-5-10Z",
    "M10 14h4",
  ],
  padaria: [
    "M5 13c0-4 3-7 7-7s7 3 7 7c0 3-2.5 5-7 5s-7-2-7-5Z",
    "M9 8c-1 2-1 4 0 6",
    "M13 7c-1 2-1 5 0 8",
  ],
  pizzaria: [
    "M6 20 18 4c-4 0-8 1.5-12 4v12Z",
    "M9 11h.1",
    "M11 15h.1",
    "M13 9h.1",
  ],
  hamburgueria: [
    "M5 11c.5-3 3-5 7-5s6.5 2 7 5H5Z",
    "M5 14h14",
    "M6 17h12",
    "M8 11h.1M12 9h.1M16 11h.1",
  ],
  barbearia: [
    "m5 5 14 14",
    "m19 5-7 7",
    "M8.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
    "M8.5 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  ],
  petshop: [
    "M8 13c2-2 6-2 8 0l1 1.5c1.5 2.2 0 4.5-2.5 3.8a9 9 0 0 0-5 0C7 19 5.5 16.7 7 14.5L8 13Z",
    "M8.7 9A1.7 1.7 0 1 1 5.3 9a1.7 1.7 0 0 1 3.4 0Z",
    "M12.7 7A1.7 1.7 0 1 1 9.3 7a1.7 1.7 0 0 1 3.4 0Z",
    "M16.7 7a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z",
    "M20.7 9a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z",
  ],
};

function normalizedProgressTheme(theme: string) {
  const aliases: Record<string, string> = {
    cafe: "cafeteria",
    acai: "acaiteria",
    sorvete: "sorveteria",
    pizza: "pizzaria",
    hamburguer: "hamburgueria",
    pao: "padaria",
  };
  return aliases[theme] || theme;
}

function progressIconSvg(input: {
  theme: string;
  index: number;
  earned: boolean;
  x: number;
  y: number;
  size: number;
  earnedColor: string;
  unearnedColor: string;
  textColor: string;
}) {
  const { theme, index, earned, x, y, size, earnedColor, unearnedColor, textColor } = input;
  if (theme === "universal") {
    const radius = size / 2;
    return `<g>
      <circle cx="${x + radius}" cy="${y + radius}" r="${radius - 3}" fill="${earned ? earnedColor : "transparent"}" stroke="${earned ? earnedColor : unearnedColor}" stroke-width="4"/>
      <text x="${x + radius}" y="${y + radius + 10}" text-anchor="middle" font-size="${Math.round(size * 0.46)}" font-weight="800" font-family="Arial, sans-serif" fill="${earned ? textColor : unearnedColor}">${index + 1}</text>
    </g>`;
  }

  const paths = progressIconPaths[theme] ?? progressIconPaths.cafeteria;
  const stroke = earned ? earnedColor : unearnedColor;
  const fill = earned ? earnedColor : "transparent";
  const strokeWidth = earned ? 1.7 : 2.2;
  return `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${paths.map((path) => `<path d="${path}"/>`).join("")}
  </g>`;
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] ?? char);
}

function readableOn(color: string) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#173D20";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#173D20" : "#FFF8E8";
}

function shortField(value: string, max = 44) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function titleCaseName(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|-)(\p{L})/gu, (_, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase("pt-BR")}`)
    .trim();
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

async function buildAppleStripImages(input: {
  settings: WalletCardSettings;
  currentPoints: number;
  pointsGoal: number;
}) {
  const { settings, currentPoints, pointsGoal } = input;
  const width = 1125;
  const height = 369;
  const cardGreen = settings.primaryColor || "#06420D";
  const accent = settings.secondaryColor || "#14E28B";
  const foreground = settings.textColor || readableOn(cardGreen);
  const theme = normalizedProgressTheme(settings.pointTheme);
  const total = Math.max(1, Math.min(pointsGoal, 20));
  const earned = Math.max(0, Math.min(currentPoints, total));
  const iconGap = total > 12 ? 10 : 18;
  const iconSize = Math.floor(Math.min(86, (width - 160 - iconGap * (total - 1)) / total));
  const progressWidth = iconSize * total + iconGap * (total - 1);
  const startX = Math.round((width - progressWidth) / 2);
  const startY = Math.round((height - iconSize) / 2);
  const iconColor = accent;
  const unearnedColor = foreground;
  const iconTextColor = readableOn(accent);
  const icons = Array.from({ length: total }).map((_, index) => progressIconSvg({
    theme,
    index,
    earned: index < earned,
    x: startX + index * (iconSize + iconGap),
    y: startY,
    size: iconSize,
    earnedColor: iconColor,
    unearnedColor,
    textColor: iconTextColor,
  })).join("");

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${icons}
  </svg>`;

  const source = Buffer.from(svg);
  const [x1, x2, x3] = await Promise.all([
    sharp(source).resize(375, 123, { fit: "cover" }).png().toBuffer(),
    sharp(source).resize(750, 246, { fit: "cover" }).png().toBuffer(),
    sharp(source).resize(1125, 369, { fit: "cover" }).png().toBuffer(),
  ]);
  return { x1, x2, x3 };
}

function passAuthToken(serialNumber: string) {
  const secret = process.env.APPLE_PASS_AUTH_SECRET || process.env.CUSTOMER_SESSION_SECRET || process.env.APPLE_PASS_CERTIFICATE_PASSWORD;
  if (!secret) throw new Error("apple_wallet_not_configured");
  return createHmac("sha256", secret).update(serialNumber).digest("hex");
}

async function getFallbackLogo() {
  return readFile(path.join(process.cwd(), "public", "logo-fidelizarei-transparent.png"));
}

async function buildAppleIconImages(logo: Buffer) {
  const makeIcon = async (size: number) => sharp(logo)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 253, b: 244, alpha: 1 } })
    .png()
    .toBuffer();

  const [x1, x2, x3] = await Promise.all([makeIcon(29), makeIcon(58), makeIcon(87)]);
  return { x1, x2, x3 };
}

async function fetchPngAsset(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    return sharp(Buffer.from(await response.arrayBuffer()))
      .resize(900, 900, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function buildAppleLogoBadgeImages(logo: Buffer) {
  const makeBadge = async (scale: number) => {
    const width = 160 * scale;
    const height = 50 * scale;
    const paddingX = 10 * scale;
    const paddingY = 7 * scale;
    const preparedLogo = await sharp(logo)
      .resize(width - paddingX * 2, height - paddingY * 2, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const metadata = await sharp(preparedLogo).metadata();
    const logoWidth = metadata.width ?? width - paddingX * 2;
    const logoHeight = metadata.height ?? height - paddingY * 2;
    const badge = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${height / 2}" fill="#fffdf4"/>
    </svg>`);
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: badge, left: 0, top: 0 },
        { input: preparedLogo, left: Math.round((width - logoWidth) / 2), top: Math.round((height - logoHeight) / 2) },
      ])
      .png()
      .toBuffer();
  };

  const [x1, x2, x3] = await Promise.all([makeBadge(1), makeBadge(2), makeBadge(3)]);
  return { x1, x2, x3 };
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
  storeCard: {
    headerFields: Array<{ key: string; label: string; value: string }>;
    primaryFields: Array<{ key: string; label: string; value: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    auxiliaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
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
    backgroundColor: input.backgroundColor,
    foregroundColor: input.foregroundColor,
    labelColor: input.labelColor,
    webServiceURL: input.webServiceURL,
    authenticationToken: input.authenticationToken,
    sharingProhibited: false,
    storeCard: input.storeCard,
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
    where c.id = $1 and c.status = 'active'
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
  const customerName = titleCaseName(context.full_name || context.phone_e164 || "Cliente");
  const displayName = firstName(customerName);
  const currentPoints = Number(context.points);
  const pointsGoal = Number(settings.pointsGoal || context.points_to_reward);
  const remaining = Math.max(pointsGoal - currentPoints, 0);
  const completed = currentPoints >= pointsGoal || Number(context.rewards_available) > 0;
  const statusText = completed ? settings.completedMessage : `Faltam ${remaining} ${settings.progressLabel}`;
  const token = passAuthToken(serialNumber);
  const certificates = extractCertificatesFromP12();
  const brandLogo = await getFallbackLogo();
  const merchantLogo = await fetchPngAsset(settings.logoUrl) ?? brandLogo;
  const appIcons = await buildAppleIconImages(brandLogo);
  const logoBadge = await buildAppleLogoBadgeImages(merchantLogo);
  const stripImages = await buildAppleStripImages({
    settings,
    currentPoints,
    pointsGoal,
  });
  const backFields = [
    {
      key: "back_status",
      label: "Status",
      value: completed ? "Recompensa disponível" : "Ativo",
    },
    {
      key: "back_valid_until",
      label: "Válido até",
      value: formatValidUntil(new Date(context.customer_created_at)),
    },
    {
      key: "back_reward",
      label: "Recompensa",
      value: settings.rewardText,
    },
    {
      key: "back_customer",
      label: "Cliente",
      value: customerName,
    },
    {
      key: "back_member_since",
      label: "Membro desde",
      value: formatMemberSince(new Date(context.customer_created_at)),
    },
    {
      key: "back_program_description",
      label: "Programa",
      value: settings.programDescription,
    },
    {
      key: "back_rule",
      label: "Como funciona",
      value: settings.accumulationText,
    },
    {
      key: "back_progress",
      label: "Progresso",
      value: `${currentPoints} de ${pointsGoal} ${settings.progressLabel}.\n${progressText(settings.pointTheme, currentPoints, pointsGoal)}\n${statusText}.`,
    },
    {
      key: "back_rewards",
      label: "Recompensas disponíveis",
      value: String(context.rewards_available),
    },
    ...(settings.termsText ? [{
      key: "back_terms",
      label: "Termos e condições",
      value: settings.termsText,
    }] : []),
    ...(settings.addressText ? [{
      key: "back_address",
      label: "Endereço",
      value: settings.addressText,
    }] : []),
    ...(settings.instagramUsername ? [{
      key: "back_instagram",
      label: "Instagram",
      value: `@${settings.instagramUsername}`,
    }] : []),
    ...(settings.websiteUrl ? [{
      key: "back_website",
      label: "Site",
      value: settings.websiteUrl,
    }] : []),
    ...(settings.contactPhone ? [{
      key: "back_phone",
      label: "Telefone",
      value: settings.contactPhone,
    }] : []),
    {
      key: "back_powered_by",
      label: "Powered by",
      value: "Fidelizarei",
    },
  ];

  const pass = new PKPass({
    "pass.json": Buffer.from(JSON.stringify(passJson({
      serialNumber,
      organizationName: settings.businessName,
      description: settings.programDescription,
      backgroundColor: hexToRgb(settings.primaryColor),
      foregroundColor: hexToRgb(settings.textColor || readableOn(settings.primaryColor)),
      labelColor: hexToRgb(settings.secondaryColor),
      webServiceURL: `${origin}/api/wallet/apple`,
      authenticationToken: token,
      storeCard: {
        headerFields: [{
          key: "progress",
          label: settings.progressLabel.toUpperCase(),
          value: `${currentPoints}/${pointsGoal}`,
        }],
        primaryFields: [],
        secondaryFields: [
          {
            key: "progress_text",
            label: "PROGRESSO",
            value: `${currentPoints}/${pointsGoal} ${settings.progressLabel}`,
          },
          {
            key: "customer",
            label: "CLIENTE",
            value: shortField(displayName, 18),
          },
        ],
        auxiliaryFields: [
          {
            key: "status",
            label: "STATUS",
            value: completed ? "Recompensa disponível" : "Ativo",
          },
          {
            key: "reward",
            label: "RECOMPENSA",
            value: shortField(settings.rewardText, 24),
          },
        ],
        backFields,
      },
    }))),
    "icon.png": appIcons.x1,
    "icon@2x.png": appIcons.x2,
    "icon@3x.png": appIcons.x3,
    "logo.png": logoBadge.x1,
    "logo@2x.png": logoBadge.x2,
    "logo@3x.png": logoBadge.x3,
    "strip.png": stripImages.x1,
    "strip@2x.png": stripImages.x2,
    "strip@3x.png": stripImages.x3,
  }, certificates);
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
