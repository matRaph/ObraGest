import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  dashboardApi,
  formatCurrency,
  obrasApi,
  tipoPluralLabels,
} from "../api/client";
import { getCurrentMonthRange } from "../utils/dates";
import DateField from "../components/DateField";
import type { TipoOperacao } from "../types";

const defaultRange = getCurrentMonthRange();

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#9333ea",
];

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const obraParam = searchParams.get("obra") ?? "";

  const [dataInicio, setDataInicio] = useState(defaultRange.inicio);
  const [dataFim, setDataFim] = useState(defaultRange.fim);
  const [tipoGrafico, setTipoGrafico] = useState<TipoOperacao>("despesa");

  const params: Record<string, string> = {
    data_inicio: dataInicio,
    data_fim: dataFim,
  };
  if (obraParam) params.obra = obraParam;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => dashboardApi.get(params),
  });

  const { data: obrasData } = useQuery({
    queryKey: ["obras", { ordering: "nome" }],
    queryFn: () => obrasApi.list({ ordering: "nome" }),
  });
  const obras = obrasData?.results ?? [];
  const obraSelecionada = obras.find((o) => o.id === obraParam);

  const chartData =
    data?.por_obra.map((item) => ({
      nome: item.nome,
      receitas: parseFloat(item.receitas),
      despesas: parseFloat(item.despesas),
    })) ?? [];

  const categoriasDoTipo = useMemo(
    () => (data?.por_categoria ?? []).filter((c) => c.tipo === tipoGrafico),
    [data, tipoGrafico]
  );

  const pieData = categoriasDoTipo
    .map((c) => ({ name: c.nome, value: parseFloat(c.total) }))
    .filter((d) => d.value > 0);

  function resetToCurrentMonth() {
    const range = getCurrentMonthRange();
    setDataInicio(range.inicio);
    setDataFim(range.fim);
  }

  function setObra(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("obra", value);
    else next.delete("obra");
    setSearchParams(next);
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-slate-800">
        {obraSelecionada ? `Dashboard · ${obraSelecionada.nome}` : "Dashboard geral"}
      </h2>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Obra
            <select
              value={obraParam}
              onChange={(e) => setObra(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Todas as obras</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            De
            <DateField
              value={dataInicio}
              onChange={setDataInicio}
              className="text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Até
            <DateField
              value={dataFim}
              onChange={setDataFim}
              className="text-sm"
            />
          </label>
          <button
            type="button"
            onClick={resetToCurrentMonth}
            className="rounded border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Mês atual
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Receitas</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data?.total_receitas ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Despesas pagas</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data?.total_despesas ?? "0")}
              </p>
              {parseFloat(data?.total_despesas_pendentes ?? "0") > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  + {formatCurrency(data?.total_despesas_pendentes ?? "0")} não pagas
                </p>
              )}
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Investimentos</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(data?.total_investimentos ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Saldo</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.saldo ?? "0")}</p>
            </div>
          </div>

          <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium text-slate-700">Distribuição por categoria</h3>
              <div className="flex gap-1 rounded border p-1">
                {(["despesa", "receita", "investimento"] as TipoOperacao[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoGrafico(t)}
                    className={`rounded px-3 py-1 text-sm ${
                      tipoGrafico === t
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tipoPluralLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {pieData.length === 0 ? (
              <p className="py-8 text-center text-slate-400">
                Sem {tipoPluralLabels[tipoGrafico].toLowerCase()} no período.
              </p>
            ) : (
              <div className="grid items-center gap-6 md:grid-cols-2">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: { name?: string; percent?: number }) =>
                        `${entry.name}: ${((entry.percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {categoriasDoTipo.map((cat, index) => (
                    <div key={cat.categoria_id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-slate-700">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {cat.nome}
                        </span>
                        <span className="font-medium">{formatCurrency(cat.total)}</span>
                      </div>
                      {cat.subcategorias.length > 1 ||
                      (cat.subcategorias.length === 1 &&
                        cat.subcategorias[0].subcategoria_id) ? (
                        <ul className="mt-1 space-y-0.5 border-l pl-4 text-xs text-slate-500">
                          {cat.subcategorias.map((sub) => (
                            <li
                              key={sub.subcategoria_id ?? "none"}
                              className="flex justify-between"
                            >
                              <span>{sub.nome}</span>
                              <span>{formatCurrency(sub.total)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!obraParam && chartData.length > 0 && (
            <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-medium text-slate-700">
                Receitas vs Despesas por obra
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="receitas" fill="#16a34a" name="Receitas" />
                  <Bar dataKey="despesas" fill="#dc2626" name="Despesas pagas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!obraParam && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-medium text-slate-700">Por cidade</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-2">Cidade</th>
                    <th className="pb-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.por_cidade.map((item) => (
                    <tr key={item.cidade} className="border-t">
                      <td className="py-2">{item.cidade}</td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(item.saldo)}
                      </td>
                    </tr>
                  ))}
                  {data?.por_cidade.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-slate-400">
                        Sem operações neste período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
