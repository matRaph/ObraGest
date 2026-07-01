import { useMemo, useState } from "react";

interface CityInputProps {
  value: string;
  onChange: (value: string) => void;
  cities: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export default function CityInput({
  value,
  onChange,
  cities,
  placeholder = "Cidade",
  required = false,
  className = "rounded border px-3 py-2",
  id,
}: CityInputProps) {
  const [open, setOpen] = useState(false);
  const listId = id ?? "city-suggestions";

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return cities;
    return cities.filter((city) => city.toLowerCase().includes(query));
  }, [cities, value]);

  const isNewCity =
    value.trim().length > 0 &&
    !cities.some((city) => city.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="relative">
      <input
        id={id}
        required={required}
        list={listId}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {cities.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
          {suggestions.map((city) => (
            <li key={city}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(city);
                  setOpen(false);
                }}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isNewCity && (
        <p className="mt-1 text-xs text-blue-600">
          Nova cidade: &quot;{value.trim()}&quot; será criada ao salvar
        </p>
      )}
    </div>
  );
}
