import { createHmac } from "node:crypto";
import { normalizeCpf } from "./cpf";

export { isValidCpf, normalizeCpf } from "./cpf";

export function hashCpf(value: string) {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("customer_cpf_not_configured");
  return createHmac("sha256", secret).update(normalizeCpf(value)).digest("hex");
}
