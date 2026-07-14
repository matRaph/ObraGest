import FieldLabel from "./FieldLabel";
import {
  formatCurrencyMask,
  maskedCurrencyToValue,
  maskCurrencyInput,
} from "../utils/currency";

interface CurrencyFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function CurrencyField({
  id,
  label,
  value,
  onChange,
  required = false,
  placeholder = "0,00",
  className = "w-full rounded border py-2 pl-10 pr-3",
}: CurrencyFieldProps) {
  const display = value ? formatCurrencyMask(value) : "";

  return (
    <div>
      <FieldLabel htmlFor={id} label={label} />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-gray-muted">
          R$
        </span>
        <input
          id={id}
          required={required}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={display}
          onChange={(e) => {
            const masked = maskCurrencyInput(e.target.value);
            onChange(masked ? maskedCurrencyToValue(masked) : "");
          }}
          className={className}
        />
      </div>
    </div>
  );
}
