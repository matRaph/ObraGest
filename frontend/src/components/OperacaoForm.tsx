import { useState, useEffect } from "react";
import CategoriaSelect, { SubcategoriaSelect } from "./CategoriaSelect";
import CurrencyField from "./CurrencyField";
import DateField from "./DateField";
import FieldLabel from "./FieldLabel";
import FornecedorSelect from "./FornecedorSelect";
import { DESCRICAO_MAX_LENGTH, limitText } from "../constants/limits";
import { parseCurrencyToNumber } from "../utils/currency";
import { getTodayIso } from "../utils/dates";
import type { Categoria, Fornecedor, Operacao } from "../types";

export interface OperacaoFormData {
  categoria: string;
  subcategoria: string;
  fornecedor: string;
  valor: string;
  precoUnitario: string;
  quantidade: string;
  data: string;
  descricao: string;
  pago: boolean;
  tambem_investimento: boolean;
}

export function createEmptyOperacaoForm(): OperacaoFormData {
  return {
    categoria: "",
    subcategoria: "",
    fornecedor: "",
    valor: "",
    precoUnitario: "",
    quantidade: "",
    data: getTodayIso(),
    descricao: "",
    pago: true,
    tambem_investimento: false,
  };
}

export function operacaoToForm(operacao: Operacao): OperacaoFormData {
  const quantidade = Number.parseFloat(operacao.quantidade ?? "");
  return {
    categoria: operacao.categoria,
    subcategoria: operacao.subcategoria ?? "",
    fornecedor: operacao.fornecedor ?? "",
    valor: operacao.valor,
    precoUnitario:
      Number.isFinite(quantidade) && quantidade > 0
        ? (parseCurrencyToNumber(operacao.valor) / quantidade).toFixed(2)
        : "",
    quantidade: operacao.quantidade ?? "",
    data: operacao.data,
    descricao: operacao.descricao,
    pago: operacao.pago,
    tambem_investimento: operacao.tambem_investimento,
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
  onAdicionarAoAgregado?: () => void;
  ocultarFornecedor?: boolean;
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

function calcPrecoUnitario(valor: string, quantidade: string) {
  const quantidadeNumerica = parseQuantidade(quantidade);
  if (quantidadeNumerica <= 0 || !valor) return "";
  return (parseCurrencyToNumber(valor) / quantidadeNumerica).toFixed(2);
}

function calcValorTotal(precoUnitario: string, quantidade: string) {
  const quantidadeNumerica = parseQuantidade(quantidade);
  if (quantidadeNumerica <= 0 || !precoUnitario) return "";
  return (parseCurrencyToNumber(precoUnitario) * quantidadeNumerica).toFixed(2);
}

export default function OperacaoForm({
  form,
  onChange,
  categorias,
  fornecedores,
  unidadeHabilitada,
  onUnidadeHabilitadaChange,
  onSubmit,
  onAdicionarAoAgregado,
  ocultarFornecedor = false,
  onCancel,
  isPending,
  submitLabel,
  className = "",
  idPrefix = "op",
}: OperacaoFormProps) {
  const [erroAgregado, setErroAgregado] = useState<string | null>(null);

  useEffect(() => {
    if (erroAgregado) setErroAgregado(null);
  // Limpa o erro quando o usuário edita o formulário
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria, form.valor, form.quantidade, form.data]);

  const selectedCategoria = categorias.find((categoria) => categoria.id === form.categoria);
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
          id={`${idPrefix}-categoria`}
          value={form.categoria}
          onChange={(categoria) => {
            const selecionada = categorias.find((item) => item.id === categoria);
            onChange({
              ...form,
              categoria,
              subcategoria: "",
              tambem_investimento:
                selecionada?.tipo === "despesa" &&
                !selecionada.devolucao_investimento
                  ? form.tambem_investimento
                  : false,
            });
          }}
          categorias={categorias}
        />
        <SubcategoriaSelect
          id={`${idPrefix}-subcategoria`}
          value={form.subcategoria}
          onChange={(subcategoria) => onChange({ ...form, subcategoria })}
          subcategorias={selectedCategoria?.subcategorias ?? []}
          disabled={!selectedCategoria}
        />
        {!ocultarFornecedor && (
          <FornecedorSelect
            id={`${idPrefix}-fornecedor`}
            value={form.fornecedor}
            onChange={(fornecedor) => onChange({ ...form, fornecedor })}
            fornecedores={fornecedores}
          />
        )}
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-brand-gray">
            <input
              type="checkbox"
              checked={unidadeHabilitada}
              onChange={(event) => {
                const enabled = event.target.checked;
                onUnidadeHabilitadaChange(enabled);
                if (!enabled) onChange({ ...form, quantidade: "", precoUnitario: "" });
              }}
              className="h-4 w-4"
            />
            Informar quantidade (unidade)
          </label>
        </div>
        {unidadeHabilitada && (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-quantidade`} label="Quantidade" required />
            <input
              id={`${idPrefix}-quantidade`}
              required
              type="number"
              step="0.0001"
              min="0.0001"
              placeholder="Ex.: 5"
              value={form.quantidade}
              onChange={(event) => {
                const quantidade = event.target.value;
                const next = { ...form, quantidade };
                if (parseQuantidade(quantidade) > 0) {
                  if (form.precoUnitario) {
                    next.valor = calcValorTotal(form.precoUnitario, quantidade);
                  } else if (form.valor) {
                    next.precoUnitario = calcPrecoUnitario(form.valor, quantidade);
                  }
                }
                onChange(next);
              }}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        )}
        <CurrencyField
          id={`${idPrefix}-valor`}
          label="Valor total"
          required
          value={form.valor}
          onChange={(valor) =>
            onChange({
              ...form,
              valor,
              precoUnitario:
                unidadeHabilitada && parseQuantidade(form.quantidade) > 0
                  ? calcPrecoUnitario(valor, form.quantidade)
                  : form.precoUnitario,
            })
          }
        />
        {unidadeHabilitada && (
          <CurrencyField
            id={`${idPrefix}-preco-unitario`}
            label="Preço por unidade"
            value={form.precoUnitario}
            onChange={(precoUnitario) =>
              onChange({
                ...form,
                precoUnitario,
                valor:
                  parseQuantidade(form.quantidade) > 0
                    ? calcValorTotal(precoUnitario, form.quantidade)
                    : form.valor,
              })
            }
          />
        )}
        <div>
          <FieldLabel htmlFor={`${idPrefix}-data`} label="Data do lançamento" required />
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
          <>
            <label className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-brand-gray md:col-span-2">
              <input
                type="checkbox"
                checked={form.pago}
                onChange={(event) => onChange({ ...form, pago: event.target.checked })}
                className="h-4 w-4"
              />
              {selectedCategoria.devolucao_investimento
                ? "Devolução já paga"
                : "Despesa já paga"}
              <span className="text-xs text-brand-gray-muted">
                {selectedCategoria.devolucao_investimento
                  ? "(se desmarcada, aparece como devolução pendente)"
                  : "(se desmarcada, não entra no saldo nem nas despesas pagas)"}
              </span>
            </label>
            {selectedCategoria.devolucao_investimento ? (
              <p className="rounded border border-brand-blue-light bg-brand-blue-light/30 px-3 py-2 text-xs text-brand-gray-muted md:col-span-2">
                Devoluções são totalizadas separadamente e não alteram despesas,
                investimentos ou saldo.
              </p>
            ) : (
              <label className="flex items-center gap-2 rounded border border-brand-blue-light bg-brand-blue-light/30 px-3 py-2 text-sm text-brand-gray md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.tambem_investimento}
                  onChange={(event) =>
                    onChange({ ...form, tambem_investimento: event.target.checked })
                  }
                  className="h-4 w-4"
                />
                Lançar também como investimento
                <span className="text-xs text-brand-gray-muted">
                  (quando paga, entra nos investimentos; no saldo conta apenas como despesa)
                </span>
              </label>
            )}
          </>
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
        {onAdicionarAoAgregado && (
          <div className="flex flex-col items-end gap-1">
            {erroAgregado && (
              <p className="text-xs text-red-500">{erroAgregado}</p>
            )}
            <button
              type="button"
              onClick={() => {
                const valorNum = parseCurrencyToNumber(form.valor);
                if (!form.categoria) {
                  setErroAgregado("Selecione a categoria.");
                  return;
                }
                if (valorNum <= 0) {
                  setErroAgregado("Informe o valor do item.");
                  return;
                }
                if (unidadeHabilitada && !form.quantidade) {
                  setErroAgregado("Informe a quantidade.");
                  return;
                }
                setErroAgregado(null);
                onAdicionarAoAgregado();
              }}
              disabled={isPending}
              className="rounded border border-brand-blue px-4 py-2 text-sm text-brand-blue hover:bg-brand-blue/10 disabled:opacity-50"
            >
              + Adicionar à nota
            </button>
          </div>
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
