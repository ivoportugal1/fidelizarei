import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
import forge from "node-forge";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { query } from "./database";
import { BRAND_WALLET_COLORS, defaultWalletSettings, getWalletCardSettings, type WalletCardSettings } from "./wallet-settings";

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
  last_reward_redeemed_at: Date | null;
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

type PassField = {
  key: string;
  label: string;
  value: string | number;
  dateStyle?: "PKDateStyleNone" | "PKDateStyleShort" | "PKDateStyleMedium" | "PKDateStyleLong" | "PKDateStyleFull";
  timeStyle?: "PKDateStyleNone" | "PKDateStyleShort" | "PKDateStyleMedium" | "PKDateStyleLong" | "PKDateStyleFull";
  textAlignment?: "PKTextAlignmentLeft" | "PKTextAlignmentCenter" | "PKTextAlignmentRight" | "PKTextAlignmentNatural";
  changeMessage?: string;
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

function validUntilDate(date: Date) {
  const valid = new Date(date);
  valid.setFullYear(valid.getFullYear() + 1);
  return valid;
}

function passDateValue(date: Date) {
  return date.toISOString();
}

function walletStatus(input: { points: number; goal: number; rewardsAvailable: number; lastRewardRedeemedAt: Date | null }) {
  if (input.rewardsAvailable > 0 || input.points >= input.goal) return "Prêmio disponível";
  if (input.lastRewardRedeemedAt && input.points === 0 && input.rewardsAvailable === 0) return "Resgatado";
  return "Ativo";
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
    // Apple asks for no text inside strip images: earned points are a filled disc with a
    // check mark, missing points are an outline.
    const radius = size / 2;
    const cx = x + radius;
    const cy = y + radius;
    if (earned) {
      return `<g><circle cx="${cx}" cy="${cy}" r="${radius - 3}" fill="${earnedColor}"/><path d="M ${cx - radius * 0.42} ${cy + radius * 0.02} L ${cx - radius * 0.1} ${cy + radius * 0.34} L ${cx + radius * 0.46} ${cy - radius * 0.3}" fill="none" stroke="${textColor}" stroke-width="${Math.max(4, size * 0.1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    }
    return `<g><circle cx="${cx}" cy="${cy}" r="${radius - 3}" fill="none" stroke="${unearnedColor}" stroke-width="${Math.max(3, size * 0.05)}"/></g>`;
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

function luminanceOf(hex: string) {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#000000";
  const channel = (start: number) => {
    const value = Number.parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string) {
  const [light, dark] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Apple asks for enough contrast between card colors and text; fall back to a readable color.
function ensureContrast(foreground: string, background: string) {
  const fg = /^#[0-9A-Fa-f]{6}$/.test(foreground) ? foreground : BRAND_WALLET_COLORS.text;
  return contrastRatio(fg, background) >= 3 ? fg : readableOn(background);
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

export async function buildAppleStripImages(input: {
  settings: WalletCardSettings;
  currentPoints: number;
  pointsGoal: number;
}) {
  const { settings, currentPoints, pointsGoal } = input;
  const width = 1125;
  const height = 432; // 375 x 144 pt at @3x (Apple's current store card strip size)
  const cardGreen = settings.primaryColor || BRAND_WALLET_COLORS.primary;
  const accent = settings.secondaryColor || BRAND_WALLET_COLORS.secondary;
  const foreground = ensureContrast(settings.textColor || readableOn(cardGreen), cardGreen);
  const theme = normalizedProgressTheme(settings.pointTheme);
  const total = Math.max(1, Math.min(pointsGoal, 20));
  const earned = Math.max(0, Math.min(currentPoints, total));
  const rows = total > 10 ? 2 : 1;
  const perRow = Math.ceil(total / rows);
  const iconGap = perRow > 8 ? 16 : 30;
  const iconSize = Math.floor(Math.min(rows === 1 ? 150 : 110, (width - 150 - iconGap * (perRow - 1)) / perRow));
  const rowGap = 26;
  const blockHeight = rows * iconSize + (rows - 1) * rowGap;
  const startY = Math.round((height - blockHeight) / 2);
  const iconTextColor = readableOn(accent);
  const icons = Array.from({ length: total }).map((_, index) => {
    const row = Math.floor(index / perRow);
    const inRow = index % perRow;
    const countInRow = row === rows - 1 ? total - row * perRow : perRow;
    const rowWidth = iconSize * countInRow + iconGap * (countInRow - 1);
    const rowStartX = Math.round((width - rowWidth) / 2);
    const icon = progressIconSvg({
      theme,
      index,
      earned: index < earned,
      x: rowStartX + inRow * (iconSize + iconGap),
      y: startY + row * (iconSize + rowGap),
      size: iconSize,
      earnedColor: accent,
      unearnedColor: foreground,
      textColor: iconTextColor,
    });
    return `<g opacity="${index < earned ? 1 : 0.45}">${icon}</g>`;
  }).join("");

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#ffffff" fill-opacity="0.06"/>
    ${icons}
  </svg>`;

  const source = Buffer.from(svg);
  const [x1, x2, x3] = await Promise.all([
    sharp(source).resize(375, 144, { fit: "cover" }).png().toBuffer(),
    sharp(source).resize(750, 288, { fit: "cover" }).png().toBuffer(),
    sharp(source).resize(1125, 432, { fit: "cover" }).png().toBuffer(),
  ]);
  return { x1, x2, x3 };
}

function passAuthToken(serialNumber: string) {
  const secret = process.env.APPLE_PASS_AUTH_SECRET || process.env.CUSTOMER_SESSION_SECRET || process.env.APPLE_PASS_CERTIFICATE_PASSWORD;
  if (!secret) throw new Error("apple_wallet_not_configured");
  return createHmac("sha256", secret).update(serialNumber).digest("hex");
}

const CROWN_PATHS = `<g fill="#F4C430"><circle cx="430" cy="577" r="46"/><circle cx="626" cy="505" r="49"/><circle cx="822" cy="577" r="46"/><path d="M481 788 429 622 459 611 538 689 611 551 641 551 711 689 793 611 822 622 768 788Z"/></g>`;
const CROWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="380 452 490 342">${CROWN_PATHS}</svg>`;


export async function buildAppleIconImages() {
  // icon.png is 38 x 38 pt (HIG). The system rounds the corners, so the square is full bleed.
  const makeIcon = async (size: number) => {
    const crown = await sharp(Buffer.from(CROWN_SVG), { density: 300 })
      .resize({ width: Math.round(size * 0.64) })
      .png()
      .toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: BRAND_WALLET_COLORS.primary } })
      .composite([{ input: crown, gravity: "center" }])
      .png()
      .toBuffer();
  };
  const [x1, x2, x3] = await Promise.all([makeIcon(38), makeIcon(76), makeIcon(114)]);
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
  const metadata = await sharp(logo).metadata();
  const ratio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
  const transparentCorners = await hasTransparentCorners(logo);
  const shape = ratio >= 1.45 ? "pill" : transparentCorners ? "circle" : "rounded";

  const makeBadge = async (scale: number) => {
    const badgeWidth = (shape === "pill" ? 160 : 62) * scale;
    const badgeHeight = 62 * scale;
    const insetX = (shape === "pill" ? 14 : 6) * scale;
    const insetY = 6 * scale;
    const safeWidth = Math.max(1, Math.round(badgeWidth - insetX * 2));
    const safeHeight = Math.max(1, Math.round(badgeHeight - insetY * 2));
    const radius = shape === "circle" ? badgeHeight / 2 : shape === "pill" ? badgeHeight / 2 : 15 * scale;
    const preparedLogo = await sharp(logo)
      .resize(safeWidth, safeHeight, { fit: "inside", position: "center" })
      .png()
      .toBuffer();
    const preparedMeta = await sharp(preparedLogo).metadata();
    const logoWidth = preparedMeta.width ?? safeWidth;
    const logoHeight = preparedMeta.height ?? safeHeight;
    const badge = Buffer.from(`<svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" fill="#fffdf4"/>
    </svg>`);
    const mask = Buffer.from(`<svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${badgeWidth}" height="${badgeHeight}" rx="${radius}" fill="#fff"/>
    </svg>`);
    const fittedLogo = await sharp({
      create: {
        width: badgeWidth,
        height: badgeHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: preparedLogo, left: Math.round((badgeWidth - logoWidth) / 2), top: Math.round((badgeHeight - logoHeight) / 2) }])
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    return sharp({
      create: {
        width: badgeWidth,
        height: badgeHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: badge, left: 0, top: 0 },
        { input: fittedLogo, left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
  };

  const [x1, x2, x3] = await Promise.all([makeBadge(1), makeBadge(2), makeBadge(3)]);
  return { x1, x2, x3 };
}

export async function buildAppleLogoImages() {
  // The Fidelizarei crown only (no wordmark). logo.png may be up to 160 x 50 pt.
  const makeLogo = async (scale: number) => sharp(Buffer.from(CROWN_SVG), { density: 300 })
    .resize({ height: 34 * scale })
    .png()
    .toBuffer();
  const [x1, x2, x3] = await Promise.all([makeLogo(1), makeLogo(2), makeLogo(3)]);
  return { x1, x2, x3 };
}

async function hasTransparentCorners(logo: Buffer) {
  try {
    const size = 24;
    const pixels = await sharp(logo)
      .ensureAlpha()
      .resize(size, size, { fit: "fill" })
      .raw()
      .toBuffer();
    const cornerIndexes = [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ];
    const alphaValues = cornerIndexes.map(([x, y]) => pixels[(y * size + x) * 4 + 3] ?? 255);
    return alphaValues.some((alpha) => alpha < 220);
  } catch {
    return false;
  }
}

function passJson(input: {
  serialNumber: string;
  organizationName: string;
  description: string;
  logoText: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  webServiceURL: string;
  authenticationToken: string;
  storeCard: {
    headerFields?: PassField[];
    primaryFields?: PassField[];
    secondaryFields?: PassField[];
    auxiliaryFields?: PassField[];
    backFields?: PassField[];
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
    logoText: input.logoText,
    backgroundColor: input.backgroundColor,
    foregroundColor: input.foregroundColor,
    labelColor: input.labelColor,
    webServiceURL: input.webServiceURL,
    authenticationToken: input.authenticationToken,
    sharingProhibited: false,
    storeCard: input.storeCard,
  };
}

export async function createAppleWalletPass(customerId: string, origin: string, expectedSerialNumber?: string, requestedProgramId?: string | null) {
  if (!configured()) throw new Error("apple_wallet_not_configured");
  const serialPrefix = `apple-${customerId}-`;
  const programIdFromSerial = expectedSerialNumber?.startsWith(serialPrefix) ? expectedSerialNumber.slice(serialPrefix.length) : null;
  const targetProgramId = requestedProgramId || programIdFromSerial || null;

  const result = await query<AppleWalletContext>(`
    select c.id as customer_id, c.full_name, c.phone_e164, c.created_at as customer_created_at,
           (
             select max(rr.created_at)
             from reward_redemptions rr
             where rr.customer_id = c.id and rr.program_id = p.id
           ) as last_reward_redeemed_at,
           o.id as organization_id, o.name as organization_name,
           p.id as program_id, p.name as program_name, p.reward_name, p.points_to_reward,
           p.pass_background_color,
           coalesce(lb.points, 0) as points, coalesce(lb.rewards_available, 0) as rewards_available
    from customers c
    join organizations o on o.id = c.organization_id
    join loyalty_programs p on p.organization_id = o.id and p.active = true
    left join loyalty_balances lb on lb.customer_id = c.id and lb.program_id = p.id
    where c.id = $1
      and c.status = 'active'
      and ($2::uuid is null or p.id = $2::uuid)
      and ($2::uuid is null or lb.customer_id is not null)
    order by coalesce(lb.updated_at, c.created_at) desc, p.created_at asc
    limit 1`, [customerId, targetProgramId]);

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
  const nameParts = customerName.split(/\s+/).filter(Boolean);
  const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : nameParts[0] || "Cliente";
  const currentPoints = Number(context.points);
  const pointsGoal = Number(settings.pointsGoal || context.points_to_reward);
  const remaining = Math.max(pointsGoal - currentPoints, 0);
  const rewardsAvailable = Number(context.rewards_available);
  const completed = currentPoints >= pointsGoal || rewardsAvailable > 0;
  const passStatus = walletStatus({
    points: currentPoints,
    goal: pointsGoal,
    rewardsAvailable,
    lastRewardRedeemedAt: context.last_reward_redeemed_at,
  });
  const statusText = completed ? settings.completedMessage : passStatus === "Resgatado" ? "Prêmio resgatado" : `Faltam ${remaining} ${settings.progressLabel}`;
  const progressValue = `${currentPoints} de ${pointsGoal}`;
  const validUntil = validUntilDate(new Date(context.customer_created_at));
  const token = passAuthToken(serialNumber);
  const certificates = extractCertificatesFromP12();
  const appIcons = await buildAppleIconImages();
  const fixedBrandLogo = await buildAppleLogoImages();
  const stripImages = await buildAppleStripImages({
    settings,
    currentPoints,
    pointsGoal,
  });
  const backFields = [
    {
      key: "back_how",
      label: "Como funciona",
      value: settings.accumulationText,
    },
    {
      key: "back_reward",
      label: "Recompensa",
      value: settings.rewardText,
    },
    {
      key: "back_progress",
      label: "Seu progresso",
      value: `${progressValue} ${settings.progressLabel}.
${statusText}.`,
    },
    {
      key: "back_customer",
      label: "Cliente",
      value: `${customerName}
Membro desde ${formatMemberSince(new Date(context.customer_created_at))}`,
    },
    {
      key: "back_valid_until",
      label: "Cartão válido até",
      value: formatValidUntil(new Date(context.customer_created_at)),
    },
    {
      key: "back_program_description",
      label: "Programa",
      value: settings.programDescription,
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
      // Apple requires contact information for the organization that signed the pass.
      key: "back_issued_by",
      label: "Emitido por",
      value: "Fidelizarei\ncontato@fidelizarei.com.br",
    },
  ];

  const cardForeground = ensureContrast(settings.textColor || readableOn(settings.primaryColor), settings.primaryColor);
  const cardLabel = contrastRatio(settings.secondaryColor, settings.primaryColor) >= 3 ? settings.secondaryColor : cardForeground;

  const pass = new PKPass({
    "pass.json": Buffer.from(JSON.stringify(passJson({
      serialNumber,
      organizationName: "Fidelizarei",
      description: settings.programDescription,
      logoText: shortField(settings.businessName, 24),
      backgroundColor: hexToRgb(settings.primaryColor),
      foregroundColor: hexToRgb(cardForeground),
      labelColor: hexToRgb(cardLabel),
      webServiceURL: `${origin}/api/wallet/apple`,
      authenticationToken: token,
      storeCard: {
        // Header: the essential info, still visible when cards are stacked in Wallet.
        headerFields: [
          {
            key: "points",
            label: "PONTOS",
            value: progressValue,
            changeMessage: "Seu progresso agora é %@.",
          },
        ],
        primaryFields: [],
        secondaryFields: [
          {
            key: "customer",
            label: "CLIENTE",
            value: shortField(displayName, 18),
          },
          {
            key: "reward",
            label: "RECOMPENSA",
            value: shortField(settings.rewardText, 22),
          },
        ],
        auxiliaryFields: [
          {
            key: "remaining",
            label: completed ? "STATUS" : "FALTAM",
            value: completed ? "Prêmio disponível" : `${remaining} ${remaining === 1 ? "ponto" : "pontos"}`,
            changeMessage: completed ? "Seu prêmio está disponível!" : undefined,
          },
          {
            key: "member_since",
            label: "MEMBRO DESDE",
            value: formatMemberSince(new Date(context.customer_created_at)),
          },
        ],
        backFields,
      },
    }))),
    "icon.png": appIcons.x1,
    "icon@2x.png": appIcons.x2,
    "icon@3x.png": appIcons.x3,
    "logo.png": fixedBrandLogo.x1,
    "logo@2x.png": fixedBrandLogo.x2,
    "logo@3x.png": fixedBrandLogo.x3,
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
