import FieldLabel from "./FieldLabel";
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
  placeholder = "Selecione a categoria",
}: CategoriaSelectProps) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} />
      <select
        id={id}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">{placeholder}</option>
        {TIPO_GROUPS.map(({ tipo, label: groupLabel }) => {
          const items = categorias.filter((c) => c.tipo === tipo);
          if (items.length === 0) return null;
          return (
            <optgroup key={tipo} label={groupLabel}>
              {items.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
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
  placeholder = "Sem subcategoria",
  disabled = false,
}: SubcategoriaSelectProps) {
  const hasOptions = subcategorias.length > 0;
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} optional />
      <select
        id={id}
        value={value}
        disabled={disabled || !hasOptions}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} disabled:bg-brand-gray-light disabled:text-brand-gray-muted`}
      >
        <option value="">
          {hasOptions ? placeholder : "Nenhuma subcategoria"}
        </option>
        {subcategorias.map((sub) => (
          <option key={sub.id} value={sub.id}>
            {sub.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
