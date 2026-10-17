// Pure CPF helpers (safe to import from client components).

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

// 12345678909 -> 123.456.789-09 (also formats partial input while typing).
export function formatCpf(value: string) {
  const digits = normalizeCpf(value).slice(0, 11);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)];
  const rest = digits.slice(9, 11);
  let out = parts.filter(Boolean).join(".");
  if (rest) out += `-${rest}`;
  return out;
}

export const CPF_ERROR_MESSAGE = "Esse CPF não parece válido. Confira os números.";
