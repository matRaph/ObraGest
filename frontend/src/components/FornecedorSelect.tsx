import FieldLabel from "./FieldLabel";
import type { Fornecedor } from "../types";

interface FornecedorSelectProps {
  value: string;
  onChange: (value: string) => void;
  fornecedores: Fornecedor[];
  className?: string;
  id?: string;
  label?: string;
  placeholder?: string;
}

export default function FornecedorSelect({
  value,
  onChange,
  fornecedores,
  className = "w-full rounded border px-3 py-2",
  id = "op-fornecedor",
  label = "Fornecedor",
  placeholder = "Sem fornecedor",
}: FornecedorSelectProps) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} optional />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">{placeholder}</option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
