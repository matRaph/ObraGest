import { useState } from "react";
import CategoriaSelect, { SubcategoriaSelect } from "./CategoriaSelect";
import DateField from "./DateField";
import FieldLabel from "./FieldLabel";
import FornecedorSelect from "./FornecedorSelect";
import { formatCurrency } from "../api/client";
import { parseCurrencyToNumber } from "../utils/currency";
import { getTodayIso } from "../utils/dates";
import type { Categoria, Fornecedor, OperacaoItem } from "../types";

export interface AgregadoNotaForm {
  categoria: string;
  subcategoria: string;
  fornecedor: string;
  data_compra: string;
  num_parcelas: number;
  tambem_investimento: boolean;
  descricao: string;
}

export function createEmptyNotaForm(): AgregadoNotaForm {
  return {
    categoria: "",
    subcategoria: "",
    fornecedor: "",
    data_compra: getTodayIso(),
    num_parcelas: 1,
    tambem_investimento: false,
    descricao: "",
  };
}

interface AgregadoPanelProps {
  itens: OperacaoItem[];
  onRemoverItem: (index: number) => void;
  onLimpar: () => void;
  notaForm: AgregadoNotaForm;
  onNotaFormChange: (form: AgregadoNotaForm) => void;
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  onLancar: () => void;
  isPending: boolean;
}

function calcTotal(itens: OperacaoItem[]): number {
  return itens.reduce((acc, item) => acc + parseCurrencyToNumber(item.valor), 0);
}

function labelItem(item: OperacaoItem, index: number): string {
  const parts: string[] = [];
  if (item.categoria_nome) parts.push(item.categoria_nome);
  if (item.descricao) parts.push(item.descricao);
  if (parts.length === 0) parts.push(`Item ${index + 1}`);
  return parts.join(" — ");
}

export default function AgregadoPanel({
  itens,
  onRemoverItem,
  onLimpar,
  notaForm,
  onNotaFormChange,
  categorias,
  fornecedores,
  onLancar,
  isPending,
}: AgregadoPanelProps) {
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  const [tentouLancar, setTentouLancar] = useState(false);

  const total = calcTotal(itens);
  const valorParcela = notaForm.num_parcelas > 0 ? total / notaForm.num_parcelas : 0;

  const selectedCategoria = categorias.find((c) => c.id === notaForm.categoria);
  const ehDespesa = selectedCategoria?.tipo === "despesa";
  const ehDevolucao = selectedCategoria?.devolucao_investimento ?? false;

  const errCategoria = tentouLancar && !notaForm.categoria;
  const errData = tentouLancar && !notaForm.data_compra;

  return (
    <div className="mb-4 rounded-lg border-2 border-brand-blue/30 bg-brand-blue/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-blue">
          Nota agregada ({itens.length}{" "}
          {itens.length === 1 ? "item" : "itens"}) — Total:{" "}
          <span className="text-brand-gray">{formatCurrency(total)}</span>
        </h3>
        <button
          type="button"
          onClick={() => {
            if (confirmandoLimpar) {
              onLimpar();
              setConfirmandoLimpar(false);
            } else {
              setConfirmandoLimpar(true);
            }
          }}
          onBlur={() => setConfirmandoLimpar(false)}
          className="text-xs text-red-500 hover:underline"
        >
          {confirmandoLimpar ? "Confirmar limpeza?" : "Limpar nota"}
        </button>
      </div>

      {/* Tags dos itens */}
      <div className="mb-4 flex flex-wrap gap-2">
        {itens.map((item, idx) => (
          <span
            key={idx}
            className="flex items-center gap-1 rounded-full border border-brand-blue/30 bg-white px-3 py-1 text-xs text-brand-gray"
          >
            <span className="max-w-[200px] truncate" title={labelItem(item, idx)}>
              {labelItem(item, idx)}
            </span>
            <span className="font-medium text-brand-gray-muted">
              {formatCurrency(parseCurrencyToNumber(item.valor))}
            </span>
            <button
              type="button"
              onClick={() => onRemoverItem(idx)}
              className="ml-1 text-brand-gray-muted hover:text-red-500"
              title="Remover item"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Campos da nota */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <CategoriaSelect
            id="nota-categoria"
            value={notaForm.categoria}
            onChange={(categoria) => {
              const cat = categorias.find((c) => c.id === categoria);
              onNotaFormChange({
                ...notaForm,
                categoria,
                subcategoria: "",
                tambem_investimento:
                  cat?.tipo === "despesa" && !cat.devolucao_investimento
                    ? notaForm.tambem_investimento
                    : false,
              });
            }}
            categorias={categorias}
            label="Categoria da nota"
            className={`w-full rounded border px-3 py-2 ${errCategoria ? "border-red-400" : ""}`}
          />
          {errCategoria && (
            <p className="mt-0.5 text-xs text-red-500">Selecione a categoria da nota.</p>
          )}
        </div>
        <SubcategoriaSelect
          id="nota-subcategoria"
          value={notaForm.subcategoria}
          onChange={(subcategoria) => onNotaFormChange({ ...notaForm, subcategoria })}
          subcategorias={selectedCategoria?.subcategorias ?? []}
          disabled={!selectedCategoria}
        />
        <FornecedorSelect
          id="nota-fornecedor"
          value={notaForm.fornecedor}
          onChange={(fornecedor) => onNotaFormChange({ ...notaForm, fornecedor })}
          fornecedores={fornecedores}
        />
        <div>
          <FieldLabel htmlFor="nota-data" label="Data da compra" required />
          <DateField
            id="nota-data"
            required
            value={notaForm.data_compra}
            onChange={(data_compra) =>
              onNotaFormChange({ ...notaForm, data_compra })
            }
          />
          {errData && (
            <p className="mt-0.5 text-xs text-red-500">Informe a data da compra.</p>
          )}
        </div>
        <div>
          <FieldLabel htmlFor="nota-parcelas" label="Número de parcelas" required />
          <input
            id="nota-parcelas"
            type="number"
            min={1}
            max={24}
            required
            value={notaForm.num_parcelas}
            onChange={(e) => {
              const v = Math.max(1, Math.min(24, parseInt(e.target.value) || 1));
              onNotaFormChange({ ...notaForm, num_parcelas: v });
            }}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div className="flex items-end pb-2">
          <p className="text-sm text-brand-gray-muted">
            Valor por parcela:{" "}
            <span className="font-semibold text-brand-gray">
              {formatCurrency(valorParcela)}
            </span>
            {notaForm.num_parcelas > 1 && (
              <span className="ml-1 text-xs">
                (última pode variar por arredondamento)
              </span>
            )}
          </p>
        </div>
        <div className="md:col-span-2">
          <FieldLabel htmlFor="nota-descricao" label="Descrição" optional />
          <input
            id="nota-descricao"
            type="text"
            placeholder="Detalhes da nota (aplicado a todas as parcelas)"
            value={notaForm.descricao}
            onChange={(e) => onNotaFormChange({ ...notaForm, descricao: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        {ehDespesa && !ehDevolucao && (
          <label className="flex items-center gap-2 rounded border border-brand-blue-light bg-brand-blue-light/30 px-3 py-2 text-sm text-brand-gray md:col-span-2">
            <input
              type="checkbox"
              checked={notaForm.tambem_investimento}
              onChange={(e) =>
                onNotaFormChange({ ...notaForm, tambem_investimento: e.target.checked })
              }
              className="h-4 w-4"
            />
            Lançar também como investimento
            <span className="text-xs text-brand-gray-muted">
              (quando paga, entra nos investimentos)
            </span>
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-brand-gray-muted">
        As parcelas serão lançadas como <strong>não pagas</strong>. A 1ª parcela vence{" "}
        <strong>30 dias após a compra</strong>; as seguintes, a cada +30 dias.
      </p>

      <div className="mt-3 flex items-center justify-end gap-3">
        {tentouLancar && (!notaForm.categoria || !notaForm.data_compra) && (
          <p className="text-xs text-red-500">Preencha os campos obrigatórios marcados com *</p>
        )}
        <button
          type="button"
          onClick={() => {
            setTentouLancar(true);
            if (!notaForm.categoria || !notaForm.data_compra || itens.length === 0) return;
            onLancar();
          }}
          disabled={isPending || itens.length === 0}
          className="rounded bg-brand-blue px-5 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {isPending ? "Lançando…" : `Lançar ${notaForm.num_parcelas} ${notaForm.num_parcelas === 1 ? "parcela" : "parcelas"}`}
        </button>
      </div>
    </div>
  );
}
