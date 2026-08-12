import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { formatCurrency, formatDate, operacoesApi } from "../api/client";
import {
  formatCurrencyMask,
  formatQuantidade,
  maskCurrencyInput,
  maskedCurrencyToValue,
  parseCurrencyToNumber,
} from "../utils/currency";
import type { Operacao, OperacaoItem } from "../types";

interface OperacaoItensModalProps {
  operacao: Operacao;
  onClose: () => void;
  onSaved: () => void;
}

function calcTotal(itens: OperacaoItem[]): number {
  return itens.reduce((acc, item) => acc + parseCurrencyToNumber(item.valor), 0);
}

function cloneItens(itens: OperacaoItem[]): OperacaoItem[] {
  return itens.map((item) => ({ ...item }));
}

function emptyItemFromOperacao(operacao: Operacao): OperacaoItem {
  return {
    categoria: operacao.categoria,
    categoria_nome: operacao.categoria_nome,
    subcategoria: operacao.subcategoria ?? undefined,
    subcategoria_nome: operacao.subcategoria_nome ?? undefined,
    valor: "",
    quantidade: "",
    precoUnitario: "",
    descricao: "",
  };
}

function parseQty(value: string | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export default function OperacaoItensModal({
  operacao,
  onClose,
  onSaved,
}: OperacaoItensModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const [itens, setItens] = useState<OperacaoItem[]>(() =>
    cloneItens(operacao.itens ?? [])
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload: OperacaoItem[]) =>
      operacoesApi.atualizarItens(operacao.id, payload),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => {
      setError("Não foi possível salvar os itens. Verifique os valores e tente novamente.");
    },
  });

  function updateItem(index: number, patch: Partial<OperacaoItem>) {
    setItens((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  function handleQuantidadeChange(index: number, quantidade: string, item: OperacaoItem) {
    const qty = parseQty(quantidade);
    const next: Partial<OperacaoItem> = { quantidade };
    if (qty > 0 && item.precoUnitario) {
      next.valor = (parseCurrencyToNumber(item.precoUnitario) * qty).toFixed(2);
    } else if (qty > 0 && item.valor) {
      next.precoUnitario = (parseCurrencyToNumber(item.valor) / qty).toFixed(2);
    }
    updateItem(index, next);
  }

  function handlePrecoChange(index: number, precoUnitario: string, item: OperacaoItem) {
    const qty = parseQty(item.quantidade);
    const next: Partial<OperacaoItem> = { precoUnitario };
    if (qty > 0 && precoUnitario) {
      next.valor = (parseCurrencyToNumber(precoUnitario) * qty).toFixed(2);
    }
    updateItem(index, next);
  }

  function handleValorChange(index: number, valor: string, item: OperacaoItem) {
    const qty = parseQty(item.quantidade);
    const next: Partial<OperacaoItem> = { valor };
    if (qty > 0 && valor) {
      next.precoUnitario = (parseCurrencyToNumber(valor) / qty).toFixed(2);
    }
    updateItem(index, next);
  }

  function handleCurrencyInput(
    index: number,
    field: "valor" | "precoUnitario",
    raw: string,
    item: OperacaoItem
  ) {
    const masked = maskCurrencyInput(raw);
    const value = masked ? maskedCurrencyToValue(masked) : "";
    if (field === "valor") handleValorChange(index, value, item);
    else handlePrecoChange(index, value, item);
  }

  function handleAddItem() {
    setItens((prev) => [...prev, emptyItemFromOperacao(operacao)]);
  }

  function handleRemoveItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCancelEdit() {
    setItens(cloneItens(operacao.itens ?? []));
    setEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    if (itens.length === 0) {
      setError("Informe ao menos um item.");
      return;
    }
    if (calcTotal(itens) <= 0) {
      setError("O valor total dos itens deve ser maior que zero.");
      return;
    }
    const payload = itens.map((item) => ({
      ...item,
      valor: parseCurrencyToNumber(item.valor).toFixed(2),
      quantidade: item.quantidade && parseQty(item.quantidade) > 0 ? item.quantidade : undefined,
      precoUnitario:
        item.precoUnitario && parseCurrencyToNumber(item.precoUnitario) > 0
          ? parseCurrencyToNumber(item.precoUnitario).toFixed(2)
          : undefined,
      descricao: item.descricao?.trim() || undefined,
    }));
    saveMutation.mutate(payload);
  }

  const total = calcTotal(itens);
  const numParcelas = operacao.parcela_total ?? 1;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-[min(56rem,calc(100%-2rem))] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
      aria-labelledby="itens-modal-titulo"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="itens-modal-titulo" className="text-lg font-semibold text-brand-gray">
              Itens da nota — {operacao.descricao || "Operação agregada"}
            </h3>
            <p className="mt-0.5 text-sm text-brand-gray-muted">
              {formatDate(operacao.data)} · {operacao.categoria_nome}
              {operacao.subcategoria_nome && (
                <span> › {operacao.subcategoria_nome}</span>
              )}
              {operacao.fornecedor_nome && (
                <span> · {operacao.fornecedor_nome}</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded border border-brand-blue bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Editar itens
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light"
            >
              Fechar
            </button>
          </div>
        </div>

        {itens.length === 0 && !editing ? (
          <p className="text-sm text-brand-gray-muted">Nenhum item registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray-light text-left">
                <tr>
                  <th className="px-3 py-2">Categoria</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2 text-right">Preço unit.</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  {editing && <th className="px-3 py-2 text-right"> </th>}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => {
                  const qty = item.quantidade ? parseFloat(item.quantidade) : null;
                  const precoUnit = item.precoUnitario
                    ? parseCurrencyToNumber(item.precoUnitario)
                    : qty && qty > 0
                      ? parseCurrencyToNumber(item.valor) / qty
                      : null;
                  return (
                    <tr key={idx} className="border-t align-top">
                      <td className="px-3 py-2 text-brand-gray">
                        {item.categoria_nome || "—"}
                        {item.subcategoria_nome && (
                          <span className="text-brand-gray-muted">
                            {" "}
                            › {item.subcategoria_nome}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {editing ? (
                          <input
                            type="text"
                            value={item.descricao ?? ""}
                            onChange={(e) =>
                              updateItem(idx, { descricao: e.target.value })
                            }
                            className="w-full min-w-[8rem] rounded border px-2 py-1 text-sm"
                            placeholder="Descrição"
                          />
                        ) : (
                          <span className="text-brand-gray-muted">
                            {item.descricao || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantidade ?? ""}
                            onChange={(e) =>
                              handleQuantidadeChange(idx, e.target.value, item)
                            }
                            className="w-20 rounded border px-2 py-1 text-right text-sm"
                          />
                        ) : (
                          <span className="text-brand-gray-muted">
                            {qty != null && Number.isFinite(qty)
                              ? formatQuantidade(String(qty))
                              : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editing ? (
                          <div className="relative ml-auto inline-block w-28">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-brand-gray-muted">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                item.precoUnitario
                                  ? formatCurrencyMask(item.precoUnitario)
                                  : ""
                              }
                              onChange={(e) =>
                                handleCurrencyInput(
                                  idx,
                                  "precoUnitario",
                                  e.target.value,
                                  item
                                )
                              }
                              className="w-full rounded border py-1 pl-7 pr-2 text-right text-sm"
                              placeholder="0,00"
                            />
                          </div>
                        ) : (
                          <span className="text-brand-gray-muted">
                            {precoUnit != null ? formatCurrency(precoUnit) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-brand-gray">
                        {editing ? (
                          <div className="relative ml-auto inline-block w-28">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-brand-gray-muted">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.valor ? formatCurrencyMask(item.valor) : ""}
                              onChange={(e) =>
                                handleCurrencyInput(idx, "valor", e.target.value, item)
                              }
                              className="w-full rounded border py-1 pl-7 pr-2 text-right text-sm"
                              placeholder="0,00"
                            />
                          </div>
                        ) : (
                          formatCurrency(parseCurrencyToNumber(item.valor))
                        )}
                      </td>
                      {editing && (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-xs text-red-600 hover:underline"
                            title="Remover item"
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-brand-gray-border bg-brand-gray-light font-semibold">
                  <td
                    colSpan={editing ? 4 : 4}
                    className="px-3 py-2 text-right text-brand-gray"
                  >
                    Total dos itens
                  </td>
                  <td className="px-3 py-2 text-right text-brand-gray">
                    {formatCurrency(total)}
                  </td>
                  {editing && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {editing && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded border border-brand-gray-border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light"
            >
              + Adicionar item
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saveMutation.isPending}
                className="rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="rounded bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {operacao.parcela_num && operacao.parcela_total && (
          <div className="mt-4 rounded border border-brand-blue-light bg-brand-blue-light/30 px-3 py-2 text-xs text-brand-gray-muted">
            Este lançamento é a{" "}
            <strong>
              parcela {operacao.parcela_num} de {operacao.parcela_total}
            </strong>{" "}
            no valor de <strong>{formatCurrency(operacao.valor)}</strong>. O valor total da
            nota foi dividido em {operacao.parcela_total} parcelas iguais.
            {editing && (
              <span className="mt-1 block text-brand-gray">
                Ao salvar, o total será redistribuído entre as {numParcelas} parcelas.
              </span>
            )}
          </div>
        )}
        {editing && !(operacao.parcela_num && operacao.parcela_total) && (
          <p className="mt-3 text-xs text-brand-gray-muted">
            Ao salvar, o valor da operação será atualizado com o total dos itens.
          </p>
        )}
      </div>
    </dialog>
  );
}
