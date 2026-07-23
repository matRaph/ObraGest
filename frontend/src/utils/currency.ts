export function parseCurrencyToNumber(value: string): number {
  if (!value) return 0;
  const sanitized = value.trim().replace(/[^\d,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrencyMask(value: string | number): string {
  const num = typeof value === "string" ? parseCurrencyToNumber(value) : value;
  if (!Number.isFinite(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskedCurrencyToValue(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  if (!digits) return "";
  return (parseInt(digits, 10) / 100).toFixed(2);
}

export function formatQuantidade(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return String(value);
  if (Number.isInteger(num)) return String(num);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
