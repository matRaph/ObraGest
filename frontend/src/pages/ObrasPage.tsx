import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatCurrency, obrasApi, statusLabels } from "../api/client";
import CityInput from "../components/CityInput";
import type { Obra, ObraStatus } from "../types";

const statusOptions: ObraStatus[] = ["planejada", "em_andamento", "concluida", "pausada"];

export default function ObrasPage() {
  const queryClient = useQueryClient();
  const [cidade, setCidade] = useState("");
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("-criado_em");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cidade: "",
    status: "planejada" as ObraStatus,
    data_inicio: "",
    descricao: "",
  });

  const params: Record<string, string> = { ordering };
  if (cidade) params.cidade = cidade;
  if (status) params.status = status;

  const { data, isLoading } = useQuery({
    queryKey: ["obras", params],
    queryFn: () => obrasApi.list(params),
  });

  const { data: cidades = [] } = useQuery({
    queryKey: ["cidades"],
    queryFn: () => obrasApi.cidades(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      obrasApi.create({
        ...form,
        data_inicio: form.data_inicio || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
      setShowForm(false);
      setForm({ nome: "", cidade: "", status: "planejada", data_inicio: "", descricao: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => obrasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["obras"] });
      queryClient.invalidateQueries({ queryKey: ["cidades"] });
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Obras</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "Nova obra"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="mb-6 rounded-lg border bg-white p-4 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <input
              required
              placeholder="Nome da obra"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="rounded border px-3 py-2"
            />
            <CityInput
              required
              value={form.cidade}
              onChange={(cidade) => setForm({ ...form, cidade })}
              cities={cidades}
              placeholder="Cidade"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ObraStatus })}
              className="rounded border px-3 py-2"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={form.data_inicio}
              onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              className="rounded border px-3 py-2"
            />
            <textarea
              placeholder="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="col-span-full rounded border px-3 py-2"
              rows={2}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="mt-4 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            Salvar obra
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <CityInput
          value={cidade}
          onChange={setCidade}
          cities={cidades}
          placeholder="Filtrar por cidade"
          className="rounded border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="-criado_em">Mais recentes</option>
          <option value="nome">Nome A-Z</option>
          <option value="-saldo">Maior saldo</option>
          <option value="saldo">Menor saldo</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.results.map((obra: Obra) => (
            <div key={obra.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <Link to={`/obras/${obra.id}`} className="text-lg font-semibold text-blue-600 hover:underline">
                  {obra.nome}
                </Link>
                <button
                  onClick={() => {
                    if (confirm("Excluir esta obra?")) deleteMutation.mutate(obra.id);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Excluir
                </button>
              </div>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {obra.cidade}
              </span>
              <span className="ml-1 mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs">
                {statusLabels[obra.status]}
              </span>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-slate-400">Receitas</p>
                  <p className="font-medium text-green-600">{formatCurrency(obra.total_receitas)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Despesas</p>
                  <p className="font-medium text-red-600">{formatCurrency(obra.total_despesas)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Saldo</p>
                  <p className="font-medium">{formatCurrency(obra.saldo)}</p>
                </div>
              </div>
            </div>
          ))}
          {data?.results.length === 0 && (
            <p className="col-span-full text-slate-500">Nenhuma obra cadastrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
