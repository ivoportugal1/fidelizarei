export const OFFICIAL_APP_URL = "https://www.fidelizarei.com.br";

export function publicAppUrl(origin?: string | null) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || "";
  const value = configured || origin || OFFICIAL_APP_URL;
  if (value.includes("fidelizarei.vercel.app")) return OFFICIAL_APP_URL;
  return value.replace(/\/+$/, "");
}
