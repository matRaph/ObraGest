import SearchableSelect from "./SearchableSelect";
import type { Categoria, Subcategoria } from "../types";

const TIPO_GROUPS: Array<{ tipo: Categoria["tipo"]; label: string }> = [
  { tipo: "despesa", label: "Despesas" },
  { tipo: "receita", label: "Receitas" },
  { tipo: "investimento", label: "Investimentos" },
];

export function groupCategorias(categorias: Categoria[]) {
  return {
    despesas: categorias.filter((c) => c.tipo === "despesa"),
    receitas: categorias.filter((c) => c.tipo === "receita"),
    investimentos: categorias.filter((c) => c.tipo === "investimento"),
  };
}

interface CategoriaSelectProps {
  value: string;
  onChange: (value: string) => void;
  categorias: Categoria[];
  className?: string;
  id?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
}

export default function CategoriaSelect({
  value,
  onChange,
  categorias,
  className = "w-full rounded border px-3 py-2",
  id = "op-categoria",
  label = "Categoria",
  required = true,
  placeholder = "Buscar categoria…",
}: CategoriaSelectProps) {
  const options = TIPO_GROUPS.flatMap(({ tipo, label: groupLabel }) =>
    categorias
      .filter((c) => c.tipo === tipo)
      .map((cat) => ({
        value: cat.id,
        label: cat.nome,
        group: groupLabel,
      }))
  );

  return (
    <SearchableSelect
      id={id}
      label={label}
      required={required}
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      placeholder={placeholder}
      emptyLabel="Selecione a categoria"
      allowEmpty={!required}
    />
  );
}

interface SubcategoriaSelectProps {
  value: string;
  onChange: (value: string) => void;
  subcategorias: Subcategoria[];
  className?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SubcategoriaSelect({
  value,
  onChange,
  subcategorias,
  className = "w-full rounded border px-3 py-2",
  id = "op-subcategoria",
  label = "Subcategoria",
  placeholder = "Buscar subcategoria…",
  disabled = false,
}: SubcategoriaSelectProps) {
  const hasOptions = subcategorias.length > 0;
  return (
    <SearchableSelect
      id={id}
      label={label}
      optional
      value={value}
      onChange={onChange}
      options={subcategorias.map((sub) => ({
        value: sub.id,
        label: sub.nome,
      }))}
      className={className}
      placeholder={hasOptions ? placeholder : "Nenhuma subcategoria"}
      emptyLabel="Sem subcategoria"
      disabled={disabled || !hasOptions}
      allowEmpty
    />
  );
}
