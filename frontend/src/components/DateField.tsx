import { useEffect, useState } from "react";

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}

function isoToBr(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (year < 1 || year > 9999) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function brToIso(br: string): string | null {
  const match = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidDate(day, month, year)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function maskDigits(digits: string): string {
  const d = digits.slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

export default function DateField({
  value,
  onChange,
  id,
  required = false,
  className = "w-full rounded border px-3 py-2",
}: DateFieldProps) {
  const [text, setText] = useState(() => isoToBr(value));

  useEffect(() => {
    if (brToIso(text) !== value && value !== "") {
      setText(isoToBr(value));
    }
    if (value === "" && brToIso(text)) {
      setText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    const masked = maskDigits(digits);
    setText(masked);
    const iso = brToIso(masked);
    onChange(iso ?? "");
  }

  const isInvalid = text.length === 10 && brToIso(text) === null;

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      required={required}
      placeholder="dd/mm/aaaa"
      value={text}
      maxLength={10}
      onChange={(e) => handleChange(e.target.value)}
      className={`${className} ${isInvalid ? "border-red-400" : ""}`}
      aria-invalid={isInvalid}
    />
  );
}
