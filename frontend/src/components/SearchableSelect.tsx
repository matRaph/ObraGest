import { useEffect, useId, useMemo, useRef, useState } from "react";
import FieldLabel from "./FieldLabel";

export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  className?: string;
  id?: string;
  label?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  allowEmpty?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  className = "w-full rounded border px-3 py-2",
  id,
  label,
  required = false,
  optional = false,
  placeholder = "Selecione",
  disabled = false,
  emptyLabel,
  allowEmpty = true,
}: SearchableSelectProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.label ?? "");
    }
  }, [selected?.label, open, value]);

  // Fecha ao clicar fora (não depende só de blur — melhor dentro de <dialog>)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected?.label ?? "");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, selected?.label]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.group && o.group.toLowerCase().includes(q))
    );
  }, [options, query]);

  const groups = useMemo(() => {
    const map = new Map<string | undefined, SearchableOption[]>();
    for (const opt of filtered) {
      const key = opt.group;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    return map;
  }, [filtered]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    const labelText =
      next === ""
        ? ""
        : (options.find((o) => o.value === next)?.label ?? "");
    setQuery(labelText);
  }

  return (
    <div className="relative" ref={rootRef}>
      {label && (
        <FieldLabel
          htmlFor={inputId}
          label={label}
          required={required}
          optional={optional}
        />
      )}
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-listbox`}
        aria-autocomplete="list"
        disabled={disabled}
        required={required && !value}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? "")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        // Não abrir no focus: o <dialog> foca o 1º input ao abrir e disparava a lista sozinha.
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected?.label ?? "");
            return;
          }
          if (e.key === "ArrowDown" || e.key === "Enter") {
            if (!open) {
              e.preventDefault();
              setOpen(true);
              return;
            }
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            if (filtered.length === 1) choose(filtered[0].value);
          }
        }}
        className={`${className} disabled:bg-brand-gray-light disabled:text-brand-gray-muted`}
        autoComplete="off"
      />

      {open && !disabled && (
        <ul
          id={`${inputId}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded border bg-white shadow-lg"
          data-scrollable
          onWheel={(e) => {
            // Impede o scroll encadear para a listagem atrás do modal
            e.stopPropagation();
            const el = e.currentTarget;
            const { scrollTop, scrollHeight, clientHeight } = el;
            const delta = e.deltaY;
            const atTop = scrollTop <= 0 && delta < 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && delta > 0;
            if (atTop || atBottom) {
              e.preventDefault();
            }
          }}
        >
          {allowEmpty && (
            <li role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-brand-gray-muted hover:bg-brand-gray-light"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose("")}
              >
                {emptyLabel ?? placeholder}
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-brand-gray-muted">
              Nenhum resultado
            </li>
          ) : (
            Array.from(groups.entries()).map(([group, items]) => (
              <li key={group ?? "__all__"}>
                {group && (
                  <div className="sticky top-0 bg-brand-gray-light px-3 py-1 text-xs font-semibold text-brand-gray-muted">
                    {group}
                  </div>
                )}
                <ul>
                  {items.map((opt) => (
                    <li key={opt.value} role="option" aria-selected={opt.value === value}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-gray-light ${
                          opt.value === value ? "bg-brand-blue-light/40 font-medium" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(opt.value)}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
