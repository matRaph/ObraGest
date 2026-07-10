import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  padSegments,
  parseIsoDate,
  parsePastedDate,
  segmentsToIso,
} from "../utils/dateField";

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export default function DateField({
  value,
  onChange,
  id,
  required = false,
  className = "",
}: DateFieldProps) {
  const [segments, setSegments] = useState(() => parseIsoDate(value));
  const editingRef = useRef(false);
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingRef.current) {
      setSegments(parseIsoDate(value));
    }
  }, [value]);

  function emitIfComplete(next: { day: string; month: string; year: string }) {
    if (!next.day && !next.month && !next.year) {
      onChange("");
      return;
    }
    const iso = segmentsToIso(next.day, next.month, next.year);
    if (iso) onChange(iso);
  }

  function handleSegmentChange(
    part: "day" | "month" | "year",
    raw: string,
    maxLen: number,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) {
    const digits = raw.replace(/\D/g, "").slice(0, maxLen);
    const next = { ...segments, [part]: digits };
    setSegments(next);
    emitIfComplete(next);
    if (digits.length === maxLen && nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select();
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    part: "day" | "month" | "year",
    prevRef?: React.RefObject<HTMLInputElement | null>
  ) {
    if (event.key === "Backspace" && segments[part] === "" && prevRef?.current) {
      prevRef.current.focus();
      prevRef.current.select();
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const parsed = parsePastedDate(event.clipboardData.getData("text"));
    if (!parsed) return;
    event.preventDefault();
    setSegments(parsed);
    emitIfComplete(parsed);
    yearRef.current?.focus();
  }

  function handleBlur() {
    window.setTimeout(() => {
      const active = document.activeElement;
      const container = dayRef.current?.closest("[data-date-field]");
      if (container?.contains(active)) return;

      editingRef.current = false;
      const padded = padSegments(segments.day, segments.month, segments.year);
      setSegments(padded);
      emitIfComplete(padded);
    }, 0);
  }

  function handlePickerChange(iso: string) {
    editingRef.current = false;
    onChange(iso);
    setSegments(parseIsoDate(iso));
  }

  const isInvalid =
    segments.day.length === 2 &&
    segments.month.length === 2 &&
    segments.year.length === 4 &&
    segmentsToIso(segments.day, segments.month, segments.year) === null;

  const borderClass = isInvalid ? "border-red-400" : "border-brand-gray-border";

  return (
    <div
      data-date-field
      className={`inline-flex w-full items-center gap-1 rounded border bg-white px-2 py-1.5 ${borderClass} ${className}`}
      onFocus={() => {
        editingRef.current = true;
      }}
      onBlur={handleBlur}
    >
      <input
        ref={dayRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd"
        maxLength={2}
        value={segments.day}
        onChange={(e) => handleSegmentChange("day", e.target.value, 2, monthRef)}
        onKeyDown={(e) => handleKeyDown(e, "day")}
        onPaste={handlePaste}
        className="w-7 border-0 bg-transparent p-0 text-center text-sm outline-none placeholder:text-brand-gray-border"
        aria-label="Dia"
      />
      <span className="text-brand-gray-muted">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="mm"
        maxLength={2}
        value={segments.month}
        onChange={(e) => handleSegmentChange("month", e.target.value, 2, yearRef)}
        onKeyDown={(e) => handleKeyDown(e, "month", dayRef)}
        onPaste={handlePaste}
        className="w-7 border-0 bg-transparent p-0 text-center text-sm outline-none placeholder:text-brand-gray-border"
        aria-label="Mês"
      />
      <span className="text-brand-gray-muted">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="aaaa"
        maxLength={4}
        value={segments.year}
        onChange={(e) => handleSegmentChange("year", e.target.value, 4)}
        onKeyDown={(e) => handleKeyDown(e, "year", monthRef)}
        onPaste={handlePaste}
        className="w-11 border-0 bg-transparent p-0 text-center text-sm outline-none placeholder:text-brand-gray-border"
        aria-label="Ano"
      />

      <div className="relative ml-auto flex-shrink-0">
        <span className="pointer-events-none flex p-1 text-brand-gray-muted">
          <CalendarIcon />
        </span>
        <input
          ref={pickerRef}
          type="date"
          lang="pt-BR"
          tabIndex={-1}
          value={value}
          onChange={(e) => handlePickerChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Abrir calendário"
        />
      </div>

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          value={value}
          required={required}
          readOnly
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
    </div>
  );
}
