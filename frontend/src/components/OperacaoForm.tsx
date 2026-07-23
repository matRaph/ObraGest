import CategoriaSelect, { SubcategoriaSelect } from "./CategoriaSelect";
import CurrencyField from "./CurrencyField";
import DateField from "./DateField";
import FieldLabel from "./FieldLabel";
import FornecedorSelect from "./FornecedorSelect";
import { DESCRICAO_MAX_LENGTH, limitText } from "../constants/limits";
import { formatCurrencyMask, parseCurrencyToNumber } from "../utils/currency";
import type { Categoria, Fornecedor, Operacao } from "../types";

export interface OperacaoFormData {
  categoria: string;
  subcategoria: string;
  fornecedor: string;
  valor: string;
  quantidade: string;
  data: string;
  descricao: string;
  pago: boolean;
}

export function createEmptyOperacaoForm(): OperacaoFormData {
  return {
    categoria: "",
    subcategoria: "",
    fornecedor: "",
    valor: "",
    quantidade: "",
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    pago: true,
  };
}

export function operacaoToForm(operacao: Operacao): OperacaoFormData {
  return {
    categoria: operacao.categoria,
    subcategoria: operacao.subcategoria ?? "",
    fornecedor: operacao.fornecedor ?? "",
    valor: operacao.valor,
    quantidade: operacao.quantidade ?? "",
    data: operacao.data,
    descricao: operacao.descricao,
    pago: operacao.pago,
  };
}

interface OperacaoFormProps {
  form: OperacaoFormData;
  onChange: (form: OperacaoFormData) => void;
  categorias: Categoria[];
  fornecedores: Fornecedor[];
  unidadeHabilitada: boolean;
  onUnidadeHabilitadaChange: (enabled: boolean) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isPending: boolean;
  submitLabel: string;
  className?: string;
  idPrefix?: string;
}

function parseQuantidade(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function OperacaoForm({
  form,
  onChange,
  categorias,
  fornecedores,
  unidadeHabilitada,
  onUnidadeHabilitadaChange,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
  className = "",
  idPrefix = "op",
}: OperacaoFormProps) {
  const selectedCategoria = categorias.find((categoria) => categoria.id === form.categoria);
  const quantidade = parseQuantidade(form.quantidade);
  const precoUnitario =
    unidadeHabilitada && quantidade > 0 && form.valor
      ? parseCurrencyToNumber(form.valor) / quantidade
      : 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className={className}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <CategoriaSelect
          value={form.categoria}
          onChange={(categoria) => onChange({ ...form, categoria, subcategoria: "" })}
          categorias={categorias}
        />
        <SubcategoriaSelect
          value={form.subcategoria}
          onChange={(subcategoria) => onChange({ ...form, subcategoria })}
          subcategorias={selectedCategoria?.subcategorias ?? []}
          disabled={!selectedCategoria}
        />
        <FornecedorSelect
          value={form.fornecedor}
          onChange={(fornecedor) => onChange({ ...form, fornecedor })}
          fornecedores={fornecedores}
        />
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-brand-gray">
            <input
              type="checkbox"
              checked={unidadeHabilitada}
              onChange={(event) => {
                const enabled = event.target.checked;
                onUnidadeHabilitadaChange(enabled);
                if (!enabled) onChange({ ...form, quantidade: "" });
              }}
              className="h-4 w-4"
            />
            Informar quantidade (unidade)
          </label>
        </div>
        {unidadeHabilitada && (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-quantidade`} label="Quantidade" />
            <input
              id={`${idPrefix}-quantidade`}
              required
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="Ex.: 5"
              value={form.quantidade}
              onChange={(event) => onChange({ ...form, quantidade: event.target.value })}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        )}
        <CurrencyField
          id={`${idPrefix}-valor`}
          label="Valor total"
          required
          value={form.valor}
          onChange={(valor) => onChange({ ...form, valor })}
        />
        {unidadeHabilitada && (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-preco-unitario`} label="Preço por unidade" />
            <input
              id={`${idPrefix}-preco-unitario`}
              value={precoUnitario > 0 ? formatCurrencyMask(precoUnitario) : ""}
              readOnly
              placeholder="Calculado automaticamente"
              className="w-full rounded border bg-brand-gray-light px-3 py-2 text-brand-gray-muted"
            />
          </div>
        )}
        <div>
          <FieldLabel htmlFor={`${idPrefix}-data`} label="Data do lançamento" />
          <DateField
            id={`${idPrefix}-data`}
            required
            value={form.data}
            onChange={(data) => onChange({ ...form, data })}
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel htmlFor={`${idPrefix}-descricao`} label="Descrição" optional />
          <input
            id={`${idPrefix}-descricao`}
            maxLength={DESCRICAO_MAX_LENGTH}
            placeholder="Detalhes do lançamento"
            value={form.descricao}
            onChange={(event) =>
              onChange({
                ...form,
                descricao: limitText(event.target.value, DESCRICAO_MAX_LENGTH),
              })
            }
            className="w-full rounded border px-3 py-2"
          />
        </div>
        {selectedCategoria?.tipo === "despesa" && (
          <label className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-brand-gray md:col-span-2">
            <input
              type="checkbox"
              checked={form.pago}
              onChange={(event) => onChange({ ...form, pago: event.target.checked })}
              className="h-4 w-4"
            />
            Despesa já paga
            <span className="text-xs text-brand-gray-muted">
              (se desmarcada, não entra no saldo nem nas despesas pagas)
            </span>
          </label>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2 text-sm text-brand-gray hover:bg-brand-gray-light"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-brand-green px-4 py-2 text-sm text-white hover:bg-brand-green-dark disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
