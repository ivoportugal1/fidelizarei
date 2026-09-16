import { createHmac } from "node:crypto";

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const total = cpf.slice(0, length).split("").reduce((sum, item, index) => sum + Number(item) * (length + 1 - index), 0);
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function hashCpf(value: string) {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("customer_cpf_not_configured");
  return createHmac("sha256", secret).update(normalizeCpf(value)).digest("hex");
}
