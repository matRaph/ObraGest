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
}

export default function CategoriaSelect({
  value,
  onChange,
  categorias,
  className = "rounded border px-3 py-2",
}: CategoriaSelectProps) {
  const { despesas, receitas } = groupCategorias(categorias);

  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)} className={className}>
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
  );
}
