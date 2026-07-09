import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  categoriasApi,
  formatCurrency,
  formatDate,
  obrasApi,
  operacoesApi,
  statusLabels,
  tipoLabels,
} from "../api/client";
import { exportarObra } from "../utils/export";
import CategoriaSelect, { SubcategoriaSelect } from "../components/CategoriaSelect";
import DateField from "../components/DateField";
import FieldLabel from "../components/FieldLabel";
import ObraForm, { emptyObraForm, obraToForm, type ObraFormData } from "../components/ObraForm";
import { DESCRICAO_MAX_LENGTH, limitText } from "../constants/limits";
import type { Categoria, TipoOperacao } from "../types";

const tipoValorClasses: Record<TipoOperacao, string> = {
  receita: "text-[#4f7c2f]",
  despesa: "text-red-600",
  investimento: "text-[#3a414d]",
};

const emptyForm = {
  categoria: "",
  subcategoria: "",
  valor: "",
  data: new Date().toISOString().slice(0, 10),
  descricao: "",
  pago: true,
};

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingObra, setEditingObra] = useState(false);
  const [obraForm, setObraForm] = useState<ObraFormData>(emptyObraForm);
  const [form, setForm] = useState(emptyForm);

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

  const selectedCategoria = categorias.find((c) => c.id === form.categoria);
  const selectedTipo = selectedCategoria?.tipo;
  const filtroCategoriaObj = categorias.find((c) => c.id === filtroCategoria);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["operacoes", id] });
    queryClient.invalidateQueries({ queryKey: ["obra", id] });
    queryClient.invalidateQueries({ queryKey: ["obras"] });
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

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        categoria: form.categoria,
        subcategoria: form.subcategoria || null,
        valor: form.valor,
        data: form.data,
        descricao: form.descricao,
      };
      if (selectedTipo === "despesa") payload.pago = form.pago;
      return operacoesApi.create(id!, payload);
    },
    onSuccess: () => {
      invalidateAll();
      setShowForm(false);
      setForm({ ...emptyForm, data: new Date().toISOString().slice(0, 10) });
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

  if (isLoading) return <p className="text-slate-500">Carregando...</p>;
  if (!obra) return <p className="text-red-500">Obra não encontrada.</p>;

  const temPendentes = parseFloat(obra.total_despesas_pendentes) > 0;

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-[#09264c] hover:underline">
        ← Voltar para obras
      </Link>

      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{obra.nome}</h2>
            <p className="mt-1 text-slate-500">
              <span className="mr-2 inline-block rounded-full bg-[#dce4ef] px-2.5 py-0.5 text-xs font-medium text-[#09264c]">
                {obra.cidade}
              </span>
              {statusLabels[obra.status]}
              {obra.data_inicio && (
                <span className="ml-2 text-xs text-slate-400">
                  · Início: {formatDate(obra.data_inicio)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/dashboard?obra=${obra.id}`}
              className="rounded border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Ver dashboard
            </Link>
            <button
              type="button"
              onClick={handleExportar}
              disabled={exportando}
              className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {exportando ? "Exportando..." : "Exportar planilha"}
            </button>
            <button
              type="button"
              onClick={() => {
                setObraForm(obraToForm(obra));
                setEditingObra(!editingObra);
              }}
              className="rounded border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
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
            {obra.descricao && <p className="mb-4 text-sm text-slate-600">{obra.descricao}</p>}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded bg-[#eef5e9] p-3">
                <p className="text-xs text-[#4f7c2f]">Receitas</p>
                <p className="text-lg font-semibold text-[#3e6225]">
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
              <div className="rounded bg-[#f0f1f3] p-3">
                <p className="text-xs text-[#3a414d]">Investimentos</p>
                <p className="text-lg font-semibold text-[#3a414d]">
                  {formatCurrency(obra.total_investimentos)}
                </p>
              </div>
              <div className="rounded bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Saldo</p>
                <p className="text-lg font-semibold">{formatCurrency(obra.saldo)}</p>
                <p className="mt-1 text-[11px] text-slate-400">Não inclui investimentos</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Operações</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-[#09264c] px-4 py-2 text-sm text-white hover:bg-[#0d3470]"
        >
          {showForm ? "Cancelar" : "Nova operação"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="mb-4 rounded-lg border bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <CategoriaSelect
              value={form.categoria}
              onChange={(categoria) => setForm({ ...form, categoria, subcategoria: "" })}
              categorias={categorias}
            />
            <SubcategoriaSelect
              value={form.subcategoria}
              onChange={(subcategoria) => setForm({ ...form, subcategoria })}
              subcategorias={selectedCategoria?.subcategorias ?? []}
              disabled={!selectedCategoria}
            />
            <div>
              <FieldLabel htmlFor="op-valor" label="Valor" />
              <input
                id="op-valor"
                required
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className="w-full rounded border px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel htmlFor="op-data" label="Data do lançamento" />
              <DateField
                id="op-data"
                required
                value={form.data}
                onChange={(data) => setForm({ ...form, data })}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel htmlFor="op-descricao" label="Descrição" optional />
              <input
                id="op-descricao"
                maxLength={DESCRICAO_MAX_LENGTH}
                placeholder="Detalhes do lançamento"
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: limitText(e.target.value, DESCRICAO_MAX_LENGTH) })
                }
                className="w-full rounded border px-3 py-2"
              />
            </div>
            {selectedTipo === "despesa" && (
              <label className="flex items-center gap-2 md:col-span-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.pago}
                  onChange={(e) => setForm({ ...form, pago: e.target.checked })}
                  className="h-4 w-4"
                />
                Despesa já paga
                <span className="text-xs text-slate-500">
                  (se desmarcada, não entra no saldo nem nas despesas pagas)
                </span>
              </label>
            )}
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="mt-3 rounded bg-[#4f7c2f] px-4 py-2 text-sm text-white hover:bg-[#3e6225] disabled:opacity-50"
          >
            Salvar operação
          </button>
        </form>
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
          className="rounded border px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
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
            className="rounded border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {operacoes?.results.map((op) => {
              const naoPaga = op.tipo === "despesa" && !op.pago;
              return (
                <tr
                  key={op.id}
                  className={`border-t ${naoPaga ? "bg-amber-50" : ""}`}
                >
                  <td className="px-4 py-3">{formatDate(op.data)}</td>
                  <td className="px-4 py-3">
                    {op.categoria_nome}
                    {op.subcategoria_nome && (
                      <span className="text-slate-400"> › {op.subcategoria_nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{op.descricao || "—"}</td>
                  <td className="px-4 py-3">{tipoLabels[op.tipo] ?? op.tipo}</td>
                  <td className="px-4 py-3">
                    {op.tipo === "despesa" ? (
                      naoPaga ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          ● Não paga
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Paga</span>
                      )
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${tipoValorClasses[op.tipo]} ${
                      naoPaga ? "opacity-70" : ""
                    }`}
                  >
                    {op.tipo === "receita" ? "+" : op.tipo === "despesa" ? "-" : ""}
                    {formatCurrency(op.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      {op.tipo === "despesa" && (
                        <button
                          onClick={() =>
                            togglePagoMutation.mutate({ opId: op.id, pago: !op.pago })
                          }
                          disabled={togglePagoMutation.isPending}
                          className={`text-xs hover:underline ${
                            naoPaga ? "text-[#4f7c2f]" : "text-amber-600"
                          }`}
                        >
                          {naoPaga ? "Marcar paga" : "Marcar não paga"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm("Excluir operação?")) deleteMutation.mutate(op.id);
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {operacoes?.results.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma operação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
