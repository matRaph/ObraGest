import FieldLabel from "./FieldLabel";
import type { Categoria } from "../types";

export function groupCategorias(categorias: Categoria[]) {
  const despesas = categorias.filter((c) => c.tipo === "despesa");
  const receitas = categorias.filter((c) => c.tipo === "receita");
  return { despesas, receitas };
}

interface CategoriaSelectProps {
  value: string;
  onChange: (value: string) => void;
  categorias: Categoria[];
  className?: string;
  id?: string;
}

export default function CategoriaSelect({
  value,
  onChange,
  categorias,
  className = "w-full rounded border px-3 py-2",
  id = "op-categoria",
}: CategoriaSelectProps) {
  const { despesas, receitas } = groupCategorias(categorias);

  return (
    <div>
      <FieldLabel htmlFor={id} label="Categoria" />
      <select
        id={id}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">Selecione a categoria</option>
        {despesas.length > 0 && (
          <optgroup label="Despesas">
            {despesas.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </optgroup>
        )}
        {receitas.length > 0 && (
          <optgroup label="Receitas">
            {receitas.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
