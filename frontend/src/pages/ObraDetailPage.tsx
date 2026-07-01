import { useState } from "react";
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
import CategoriaSelect from "../components/CategoriaSelect";

export default function ObraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"operacoes" | "extrato">("operacoes");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    categoria: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
  });

  const { data: obra, isLoading } = useQuery({
    queryKey: ["obra", id],
    queryFn: () => obrasApi.get(id!),
    enabled: !!id,
  });

  const { data: operacoes } = useQuery({
    queryKey: ["operacoes", id],
    queryFn: () => operacoesApi.listByObra(id!),
    enabled: !!id,
  });

  const { data: extrato } = useQuery({
    queryKey: ["extrato", id],
    queryFn: () => operacoesApi.extrato(id!),
    enabled: !!id && tab === "extrato",
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => categoriasApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      operacoesApi.create(id!, {
        categoria: form.categoria,
        valor: form.valor,
        data: form.data,
        descricao: form.descricao,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operacoes", id] });
      queryClient.invalidateQueries({ queryKey: ["extrato", id] });
      queryClient.invalidateQueries({ queryKey: ["obra", id] });
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      setShowForm(false);
      setForm({ categoria: "", valor: "", data: new Date().toISOString().slice(0, 10), descricao: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (opId: string) => operacoesApi.delete(opId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operacoes", id] });
      queryClient.invalidateQueries({ queryKey: ["extrato", id] });
      queryClient.invalidateQueries({ queryKey: ["obra", id] });
      queryClient.invalidateQueries({ queryKey: ["obras"] });
    },
  });

  if (isLoading) return <p className="text-slate-500">Carregando...</p>;
  if (!obra) return <p className="text-red-500">Obra não encontrada.</p>;

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        ← Voltar para obras
      </Link>

      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">{obra.nome}</h2>
        <p className="text-slate-500">
          <span className="mr-2 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {obra.cidade}
          </span>
          {statusLabels[obra.status]}
        </p>
        {obra.descricao && <p className="mt-2 text-sm text-slate-600">{obra.descricao}</p>}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded bg-green-50 p-3">
            <p className="text-xs text-green-600">Receitas</p>
            <p className="text-lg font-semibold text-green-700">{formatCurrency(obra.total_receitas)}</p>
          </div>
          <div className="rounded bg-red-50 p-3">
            <p className="text-xs text-red-600">Despesas</p>
            <p className="text-lg font-semibold text-red-700">{formatCurrency(obra.total_despesas)}</p>
          </div>
          <div className="rounded bg-slate-50 p-3">
            <p className="text-xs text-slate-600">Saldo</p>
            <p className="text-lg font-semibold">{formatCurrency(obra.saldo)}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("operacoes")}
            className={`rounded px-4 py-2 text-sm ${
              tab === "operacoes" ? "bg-slate-900 text-white" : "bg-white border"
            }`}
          >
            Operações
          </button>
          <button
            onClick={() => setTab("extrato")}
            className={`rounded px-4 py-2 text-sm ${
              tab === "extrato" ? "bg-slate-900 text-white" : "bg-white border"
            }`}
          >
            Extrato
          </button>
        </div>
        {tab === "operacoes" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {showForm ? "Cancelar" : "Nova operação"}
          </button>
        )}
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
              onChange={(categoria) => setForm({ ...form, categoria })}
              categorias={categorias?.results ?? []}
            />
            <input
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="Valor"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className="rounded border px-3 py-2"
            />
            <input
              required
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="rounded border px-3 py-2"
            />
            <input
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="rounded border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="mt-3 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            Salvar operação
          </button>
        </form>
      )}

      {tab === "operacoes" ? (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {operacoes?.results.map((op) => (
                <tr key={op.id} className="border-t">
                  <td className="px-4 py-3">{formatDate(op.data)}</td>
                  <td className="px-4 py-3">{op.categoria_nome}</td>
                  <td className="px-4 py-3">{op.descricao || "—"}</td>
                  <td className="px-4 py-3">{tipoLabels[op.tipo] ?? op.tipo}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      op.tipo === "receita" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(op.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm("Excluir operação?")) deleteMutation.mutate(op.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {operacoes?.results.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma operação registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {extrato?.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">{formatDate(item.data)}</td>
                  <td className="px-4 py-3">{item.categoria_nome}</td>
                  <td className="px-4 py-3">{item.descricao || "—"}</td>
                  <td
                    className={`px-4 py-3 text-right ${
                      item.tipo === "receita" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {item.tipo === "receita" ? "+" : "-"}
                    {formatCurrency(item.valor)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(item.saldo_acumulado)}
                  </td>
                </tr>
              ))}
              {extrato?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nenhum lançamento no extrato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
