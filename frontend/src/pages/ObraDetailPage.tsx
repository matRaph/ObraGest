import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  categoriasApi,
  formatCurrency,
  formatDate,
  fornecedoresApi,
  obrasApi,
  operacoesApi,
  statusLabels,
  tipoLabels,
} from "../api/client";
import { exportarObra } from "../utils/export";
import ObraForm, { emptyObraForm, obraToForm, type ObraFormData } from "../components/ObraForm";
import OperacaoForm, {
  createEmptyOperacaoForm,
  operacaoToForm,
  type OperacaoFormData,
} from "../components/OperacaoForm";
import { formatQuantidade, parseCurrencyToNumber } from "../utils/currency";
import type { Categoria, Fornecedor, Operacao, TipoOperacao } from "../types";

const tipoValorClasses: Record<TipoOperacao, string> = {
  receita: "text-brand-green",
  despesa: "text-red-600",
  investimento: "text-brand-gray",
};

function parseNum(value: string) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function calcPrecoUnitario(valor: string, quantidade: string) {
  const qty = parseNum(quantidade);
  if (qty <= 0 || !valor) return "";
  return (parseCurrencyToNumber(valor) / qty).toFixed(2);
}

function buildOperacaoPayload(
  form: OperacaoFormData,
  unidadeHabilitada: boolean,
  categorias: Categoria[]
) {
  const selectedTipo = categorias.find((categoria) => categoria.id === form.categoria)?.tipo;
  const payload: Record<string, unknown> = {
    categoria: form.categoria,
    subcategoria: form.subcategoria || null,
    fornecedor: form.fornecedor || null,
    valor: form.valor,
    quantidade: unidadeHabilitada && form.quantidade ? form.quantidade : null,
    data: form.data,
    descricao: form.descricao,
  };
  if (selectedTipo === "despesa") payload.pago = form.pago;
  return payload;
}

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingObra, setEditingObra] = useState(false);
  const [obraForm, setObraForm] = useState<ObraFormData>(emptyObraForm);
  const [form, setForm] = useState<OperacaoFormData>(createEmptyOperacaoForm);
  const [unidadeHabilitada, setUnidadeHabilitada] = useState(false);
  const [editingOperacao, setEditingOperacao] = useState<Operacao | null>(null);
  const [editForm, setEditForm] = useState<OperacaoFormData>(createEmptyOperacaoForm);
  const [editUnidadeHabilitada, setEditUnidadeHabilitada] = useState(false);
  const editDialogRef = useRef<HTMLDialogElement>(null);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSubcategoria, setFiltroSubcategoria] = useState("");
  const [filtroPago, setFiltroPago] = useState("");
  const [exportando, setExportando] = useState(false);

  const { data: obra, isLoading } = useQuery({
    queryKey: ["obra", id],
    queryFn: () => obrasApi.get(id!),
    enabled: !!id,
  });

  const { data: categoriasData } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => categoriasApi.list(),
  });
  const categorias: Categoria[] = categoriasData?.results ?? [];

  const { data: fornecedoresData } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => fornecedoresApi.list(),
  });
  const fornecedores: Fornecedor[] = fornecedoresData?.results ?? [];

  const listParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (filtroTipo) params.tipo = filtroTipo;
    if (filtroCategoria) params.categoria = filtroCategoria;
    if (filtroSubcategoria) params.subcategoria = filtroSubcategoria;
    if (filtroPago) params.pago = filtroPago;
    return params;
  }, [filtroTipo, filtroCategoria, filtroSubcategoria, filtroPago]);

  const { data: operacoes } = useQuery({
    queryKey: ["operacoes", id, listParams],
    queryFn: () => operacoesApi.listByObra(id!, listParams),
    enabled: !!id,
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["cidades"],
    queryFn: () => obrasApi.cidades(),
  });

  useEffect(() => {
    if (obra) setObraForm(obraToForm(obra));
  }, [obra]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editingOperacao && !dialog.open) dialog.showModal();
    if (!editingOperacao && dialog.open) dialog.close();
  }, [editingOperacao]);

  const filtroCategoriaObj = categorias.find((c) => c.id === filtroCategoria);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["operacoes", id] });
    queryClient.invalidateQueries({ queryKey: ["obra", id] });
    queryClient.invalidateQueries({ queryKey: ["obras"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function resetCreateForm() {
    setForm(createEmptyOperacaoForm());
    setUnidadeHabilitada(false);
    setShowForm(false);
  }

  async function handleExportar() {
    if (!obra || !id) return;
    setExportando(true);
    try {
      // Busca todas as operações (com filtros ativos, sem paginação)
      const todasOperacoes = await operacoesApi.listByObra(id, {
        ...listParams,
        page_size: "10000",
      });
      exportarObra(obra, todasOperacoes.results);
    } finally {
      setExportando(false);
    }
  }

  const updateObraMutation = useMutation({
    mutationFn: () =>
      obrasApi.update(id!, { ...obraForm, data_inicio: obraForm.data_inicio || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra", id] });
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
      setEditingObra(false);
    },
  });

  const archiveObraMutation = useMutation({
    mutationFn: () => obrasApi.update(id!, { arquivada: !obra?.arquivada }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obra", id] });
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      operacoesApi.create(id!, buildOperacaoPayload(form, unidadeHabilitada, categorias)),
    onSuccess: () => {
      invalidateAll();
      setForm({
        ...createEmptyOperacaoForm(),
        categoria: form.categoria,
        fornecedor: form.fornecedor,
      });
      setUnidadeHabilitada(false);
    },
  });

  const updateOperacaoMutation = useMutation({
    mutationFn: () => {
      if (!editingOperacao) throw new Error("Nenhuma operação selecionada.");
      return operacoesApi.update(
        editingOperacao.id,
        buildOperacaoPayload(editForm, editUnidadeHabilitada, categorias)
      );
    },
    onSuccess: () => {
      invalidateAll();
      setEditingOperacao(null);
    },
  });

  const togglePagoMutation = useMutation({
    mutationFn: ({ opId, pago }: { opId: string; pago: boolean }) =>
      operacoesApi.update(opId, { pago }),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (opId: string) => operacoesApi.delete(opId),
    onSuccess: invalidateAll,
  });

  if (isLoading) return <p className="text-brand-gray-muted">Carregando...</p>;
  if (!obra) return <p className="text-red-500">Obra não encontrada.</p>;

  const temPendentes = parseFloat(obra.total_despesas_pendentes) > 0;

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-brand-blue hover:underline">
        ← Voltar para obras
      </Link>

      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{obra.nome}</h2>
            <p className="mt-1 text-brand-gray-muted">
              <span className="mr-2 inline-block rounded-full bg-brand-blue-light px-2.5 py-0.5 text-xs font-medium text-brand-blue">
                {obra.cidade}
              </span>
              {statusLabels[obra.status]}
              {obra.arquivada && (
                <span className="ml-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Arquivada
                </span>
              )}
              {obra.data_inicio && (
                <span className="ml-2 text-xs text-brand-gray-muted">
                  · Início: {formatDate(obra.data_inicio)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => archiveObraMutation.mutate()}
              disabled={archiveObraMutation.isPending}
              className="rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light disabled:opacity-50"
            >
              {obra.arquivada ? "Restaurar obra" : "Arquivar obra"}
            </button>
            <Link
              to={`/dashboard?obra=${obra.id}`}
              className="rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light"
            >
              Ver dashboard
            </Link>
            <button
              type="button"
              onClick={handleExportar}
              disabled={exportando}
              className="rounded border border-brand-green-light bg-brand-green-bg px-3 py-1.5 text-sm text-brand-green-dark hover:bg-brand-green-light disabled:opacity-50"
            >
              {exportando ? "Exportando..." : "Exportar planilha"}
            </button>
            <button
              type="button"
              onClick={() => {
                setObraForm(obraToForm(obra));
                setEditingObra(!editingObra);
              }}
              className="rounded border px-3 py-1.5 text-sm text-brand-gray hover:bg-brand-gray-light"
            >
              {editingObra ? "Cancelar edição" : "Editar obra"}
            </button>
          </div>
        </div>

        {editingObra ? (
          <ObraForm
            form={obraForm}
            onChange={setObraForm}
            cities={cidades}
            onSubmit={() => updateObraMutation.mutate()}
            onCancel={() => {
              setObraForm(obraToForm(obra));
              setEditingObra(false);
            }}
            isPending={updateObraMutation.isPending}
            submitLabel="Salvar alterações"
          />
        ) : (
          <>
            {obra.descricao && <p className="mb-4 text-sm text-brand-gray">{obra.descricao}</p>}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded bg-brand-green-bg p-3">
                <p className="text-xs text-brand-green">Receitas</p>
                <p className="text-lg font-semibold text-brand-green-dark">
                  {formatCurrency(obra.total_receitas)}
                </p>
              </div>
              <div className="rounded bg-red-50 p-3">
                <p className="text-xs text-red-600">Despesas pagas</p>
                <p className="text-lg font-semibold text-red-700">
                  {formatCurrency(obra.total_despesas)}
                </p>
                {temPendentes && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    + {formatCurrency(obra.total_despesas_pendentes)} não pagas
                  </p>
                )}
              </div>
              <div className="rounded bg-brand-gray-light p-3">
                <p className="text-xs text-brand-gray">Investimentos</p>
                <p className="text-lg font-semibold text-brand-gray">
                  {formatCurrency(obra.total_investimentos)}
                </p>
              </div>
              <div className="rounded bg-brand-gray-light p-3">
                <p className="text-xs text-brand-gray">Saldo</p>
                <p className="text-lg font-semibold">{formatCurrency(obra.saldo)}</p>
                <p className="mt-1 text-[11px] text-brand-gray-muted">Não inclui investimentos</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-gray">Operações</h3>
        <button
          onClick={() => {
            if (showForm) {
              resetCreateForm();
            } else {
              setShowForm(true);
            }
          }}
          className="rounded bg-brand-blue px-4 py-2 text-sm text-white hover:bg-brand-blue-dark"
        >
          {showForm ? "Cancelar" : "Nova operação"}
        </button>
      </div>

      {showForm && (
        <OperacaoForm
          form={form}
          onChange={setForm}
          categorias={categorias}
          fornecedores={fornecedores}
          unidadeHabilitada={unidadeHabilitada}
          onUnidadeHabilitadaChange={setUnidadeHabilitada}
          onSubmit={() => createMutation.mutate()}
          isPending={createMutation.isPending}
          submitLabel="Salvar operação"
          className="mb-4 rounded-lg border bg-white p-4 shadow-sm"
        />
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={filtroTipo}
          onChange={(e) => {
            setFiltroTipo(e.target.value);
            setFiltroCategoria("");
            setFiltroSubcategoria("");
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="despesa">Despesas</option>
          <option value="receita">Receitas</option>
          <option value="investimento">Investimentos</option>
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => {
            setFiltroCategoria(e.target.value);
            setFiltroSubcategoria("");
          }}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Todas as categorias</option>
          {categorias
            .filter((c) => !filtroTipo || c.tipo === filtroTipo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
        <select
          value={filtroSubcategoria}
          onChange={(e) => setFiltroSubcategoria(e.target.value)}
          disabled={!filtroCategoriaObj || filtroCategoriaObj.subcategorias.length === 0}
          className="rounded border px-3 py-2 text-sm disabled:bg-brand-gray-light disabled:text-brand-gray-muted"
        >
          <option value="">Todas as subcategorias</option>
          {filtroCategoriaObj?.subcategorias.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          value={filtroPago}
          onChange={(e) => setFiltroPago(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Pagas e não pagas</option>
          <option value="true">Somente pagas</option>
          <option value="false">Somente não pagas</option>
        </select>
        {(filtroTipo || filtroCategoria || filtroSubcategoria || filtroPago) && (
          <button
            type="button"
            onClick={() => {
              setFiltroTipo("");
              setFiltroCategoria("");
              setFiltroSubcategoria("");
              setFiltroPago("");
            }}
            className="rounded border px-3 py-2 text-sm text-brand-gray hover:bg-brand-gray-light"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-brand-gray-light text-left">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Fornecedor</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {operacoes?.results.map((op) => {
              const naoPaga = op.tipo === "despesa" && !op.pago;
              const precoUnitario =
                op.quantidade && parseNum(op.quantidade) > 0
                  ? calcPrecoUnitario(op.valor, op.quantidade)
                  : "";
              return (
                <tr
                  key={op.id}
                  className={`border-t ${naoPaga ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-3">{formatDate(op.data)}</td>
                  <td className="px-4 py-3">
                    {op.categoria_nome}
                    {op.subcategoria_nome && (
                      <span className="text-brand-gray-muted"> › {op.subcategoria_nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{op.fornecedor_nome || "—"}</td>
                  <td className="px-4 py-3">{op.descricao || "—"}</td>
                  <td className="px-4 py-3">{tipoLabels[op.tipo] ?? op.tipo}</td>
                  <td className="px-4 py-3">
                    {op.tipo === "despesa" ? (
                      naoPaga ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ● Não paga
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-xs text-brand-gray-muted">Paga</span>
                      )
                    ) : (
                      <span className="text-xs text-brand-gray-border">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${tipoValorClasses[op.tipo]} ${
                      naoPaga ? "opacity-70" : ""
                    }`}
                  >
                    <div>
                      {op.tipo === "receita" ? "+" : op.tipo === "despesa" ? "−" : ""}
                      {formatCurrency(op.valor)}
                    </div>
                    {op.quantidade && (
                      <div className="mt-0.5 text-xs font-normal text-brand-gray-muted">
                        {formatQuantidade(op.quantidade)} un.
                        {precoUnitario && (
                          <span> × {formatCurrency(precoUnitario)}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {op.tipo === "despesa" && (
                        <button
                          type="button"
                          onClick={() =>
                            togglePagoMutation.mutate({ opId: op.id, pago: !op.pago })
                          }
                          disabled={togglePagoMutation.isPending}
                          title={naoPaga ? "Marcar como paga" : "Marcar como não paga"}
                          className={`inline-flex h-7 shrink-0 items-center justify-center rounded px-2 text-xs font-medium whitespace-nowrap disabled:opacity-50 ${
                            naoPaga
                              ? "border border-brand-green-light bg-brand-green-bg text-brand-green-dark hover:bg-brand-green-light"
                              : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {naoPaga ? "Pagar" : "Não paga"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm(operacaoToForm(op));
                          setEditUnidadeHabilitada(Boolean(op.quantidade));
                          setEditingOperacao(op);
                        }}
                        title="Editar operação"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-brand-gray-border text-brand-blue hover:bg-brand-blue-light"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5"
                          aria-hidden
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                        <span className="sr-only">Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Excluir operação?")) deleteMutation.mutate(op.id);
                        }}
                        title="Excluir operação"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3.5 w-3.5"
                          aria-hidden
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                        <span className="sr-only">Excluir</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {operacoes?.results.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-brand-gray-muted">
                  Nenhuma operação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <dialog
        ref={editDialogRef}
        onCancel={(event) => {
          event.preventDefault();
          setEditingOperacao(null);
        }}
        className="w-[min(48rem,calc(100%-2rem))] rounded-lg p-0 shadow-xl backdrop:bg-black/40"
        aria-labelledby="editar-operacao-titulo"
      >
        <div className="p-5">
          <h3 id="editar-operacao-titulo" className="mb-4 text-lg font-semibold text-brand-gray">
            Editar operação
          </h3>
          {editingOperacao && (
            <OperacaoForm
              form={editForm}
              onChange={setEditForm}
              categorias={categorias}
              fornecedores={fornecedores}
              unidadeHabilitada={editUnidadeHabilitada}
              onUnidadeHabilitadaChange={setEditUnidadeHabilitada}
              onSubmit={() => updateOperacaoMutation.mutate()}
              onCancel={() => setEditingOperacao(null)}
              isPending={updateOperacaoMutation.isPending}
              submitLabel="Salvar alterações"
              idPrefix="edit-op"
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
