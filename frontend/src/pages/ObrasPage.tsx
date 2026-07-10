import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatCurrency, obrasApi, statusLabels } from "../api/client";
import CityInput from "../components/CityInput";
import ObraForm, { emptyObraForm } from "../components/ObraForm";
import type { Obra, ObraStatus } from "../types";

const statusOptions: ObraStatus[] = ["planejada", "em_andamento", "concluida", "pausada"];

export default function ObrasPage() {
  const queryClient = useQueryClient();
  const [cidade, setCidade] = useState("");
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("-criado_em");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyObraForm);

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
      setForm(emptyObraForm);
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
        <h2 className="text-2xl font-semibold text-brand-gray">Obras</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark"
        >
          {showForm ? "Cancelar" : "Nova obra"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <ObraForm
            form={form}
            onChange={setForm}
            cities={cidades}
            onSubmit={() => createMutation.mutate()}
            onCancel={() => {
              setShowForm(false);
              setForm(emptyObraForm);
            }}
            isPending={createMutation.isPending}
            submitLabel="Cadastrar obra"
          />
        </div>
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
        <p className="text-brand-gray-muted">Carregando...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.results.map((obra: Obra) => (
            <div key={obra.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <Link to={`/obras/${obra.id}`} className="text-lg font-semibold text-brand-blue hover:underline">
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
              <span className="mt-1 inline-block rounded-full bg-brand-blue-light px-2.5 py-0.5 text-xs font-medium text-brand-blue">
                {obra.cidade}
              </span>
              <span className="ml-1 mt-1 inline-block rounded bg-brand-gray-light px-2 py-0.5 text-xs text-brand-gray">
                {statusLabels[obra.status]}
              </span>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-brand-gray-muted">Receitas</p>
                  <p className="font-medium text-brand-green">{formatCurrency(obra.total_receitas)}</p>
                </div>
                <div>
                  <p className="text-brand-gray-muted">Despesas</p>
                  <p className="font-medium text-red-600">{formatCurrency(obra.total_despesas)}</p>
                </div>
                <div>
                  <p className="text-brand-gray-muted">Saldo</p>
                  <p className="font-medium">{formatCurrency(obra.saldo)}</p>
                </div>
              </div>
            </div>
          ))}
          {data?.results.length === 0 && (
            <p className="col-span-full text-brand-gray-muted">Nenhuma obra cadastrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
