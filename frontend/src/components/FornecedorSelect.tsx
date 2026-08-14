import SearchableSelect from "./SearchableSelect";
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
  placeholder = "Buscar fornecedor…",
}: FornecedorSelectProps) {
  return (
    <SearchableSelect
      id={id}
      label={label}
      optional
      value={value}
      onChange={onChange}
      options={fornecedores.map((f) => ({
        value: f.id,
        label: f.nome,
      }))}
      className={className}
      placeholder={placeholder}
      emptyLabel="Sem fornecedor"
      allowEmpty
    />
  );
}
