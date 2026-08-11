import { useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "../api/client";
import { formatQuantidade, parseCurrencyToNumber } from "../utils/currency";
import type { Operacao, OperacaoItem } from "../types";

interface OperacaoItensModalProps {
  operacao: Operacao;
  onClose: () => void;
}

function calcTotal(itens: OperacaoItem[]): number {
  return itens.reduce((acc, item) => acc + parseCurrencyToNumber(item.valor), 0);
}

export default function OperacaoItensModal({ operacao, onClose }: OperacaoItensModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const itens = operacao.itens ?? [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-[min(52rem,calc(100%-2rem))] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
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
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light"
          >
            Fechar
          </button>
        </div>

        {itens.length === 0 ? (
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
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2 text-brand-gray">
                        {item.categoria_nome || "—"}
                        {item.subcategoria_nome && (
                          <span className="text-brand-gray-muted">
                            {" "}
                            › {item.subcategoria_nome}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-brand-gray-muted">
                        {item.descricao || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-brand-gray-muted">
                        {qty != null && Number.isFinite(qty)
                          ? formatQuantidade(String(qty))
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-brand-gray-muted">
                        {precoUnit != null ? formatCurrency(precoUnit) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-brand-gray">
                        {formatCurrency(parseCurrencyToNumber(item.valor))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-brand-gray-border bg-brand-gray-light font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right text-brand-gray">
                    Total dos itens
                  </td>
                  <td className="px-3 py-2 text-right text-brand-gray">
                    {formatCurrency(calcTotal(itens))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {operacao.parcela_num && operacao.parcela_total && (
          <div className="mt-4 rounded border border-brand-blue-light bg-brand-blue-light/30 px-3 py-2 text-xs text-brand-gray-muted">
            Este lançamento é a{" "}
            <strong>
              parcela {operacao.parcela_num} de {operacao.parcela_total}
            </strong>{" "}
            no valor de <strong>{formatCurrency(operacao.valor)}</strong>. O valor total da
            nota foi dividido em {operacao.parcela_total} parcelas iguais.
          </div>
        )}
      </div>
    </dialog>
  );
}
