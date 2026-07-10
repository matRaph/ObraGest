import { useEffect, useMemo, useState } from "react";
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
  formatDate,
  obrasApi,
  tipoPluralLabels,
} from "../api/client";
import { exportarDashboard } from "../utils/export";
import {
  getCurrentMonthRange,
  getObraDashboardRange,
  getTodayIso,
} from "../utils/dates";
import DateField from "../components/DateField";
import { brandColors, chartColors } from "../constants/theme";
import type { TipoOperacao } from "../types";

const defaultRange = getCurrentMonthRange();

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

  useEffect(() => {
    if (obraSelecionada) {
      const range = getObraDashboardRange(obraSelecionada);
      setDataInicio(range.inicio);
      setDataFim(range.fim);
    } else if (!obraParam) {
      const range = getCurrentMonthRange();
      setDataInicio(range.inicio);
      setDataFim(range.fim);
    }
  }, [obraSelecionada?.id, obraParam]);

  const periodoObra = useMemo(() => {
    if (!obraSelecionada) return null;
    return getObraDashboardRange(obraSelecionada);
  }, [obraSelecionada]);

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

  function resetPeriodo() {
    if (obraSelecionada) {
      const range = getObraDashboardRange(obraSelecionada);
      setDataInicio(range.inicio);
      setDataFim(getTodayIso());
    } else {
      const range = getCurrentMonthRange();
      setDataInicio(range.inicio);
      setDataFim(range.fim);
    }
  }

  function setObra(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("obra", value);
    else next.delete("obra");
    setSearchParams(next);
  }

  function handleExportar() {
    if (!data) return;
    exportarDashboard(data, {
      obraNome: obraSelecionada?.nome,
      dataInicio,
      dataFim,
    });
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-brand-gray">
          {obraSelecionada ? `Dashboard · ${obraSelecionada.nome}` : "Dashboard geral"}
        </h2>
        {data && (
          <button
            type="button"
            onClick={handleExportar}
            className="rounded border border-brand-green-light bg-brand-green-bg px-3 py-1.5 text-sm text-brand-green-dark hover:bg-brand-green-light"
          >
            Exportar relatório
          </button>
        )}
      </div>
      {obraSelecionada && periodoObra && (
        <p className="mb-4 text-sm text-brand-gray-muted">
          Período completo da obra: de{" "}
          {formatDate(periodoObra.inicio)} até hoje. Ajuste as datas abaixo se
          quiser filtrar um intervalo menor.
        </p>
      )}

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-brand-gray">
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
          <label className="flex flex-col gap-1 text-sm text-brand-gray">
            De
            <DateField
              value={dataInicio}
              onChange={setDataInicio}
              className="text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-gray">
            Até
            <DateField
              value={dataFim}
              onChange={setDataFim}
              className="text-sm"
            />
          </label>
          <button
            type="button"
            onClick={resetPeriodo}
            className="rounded border px-3 py-2 text-sm text-brand-gray hover:bg-brand-gray-light"
          >
            {obraSelecionada ? "Desde o início" : "Mês atual"}
          </button>
          {obraSelecionada && (
            <button
              type="button"
              onClick={() => {
                const range = getCurrentMonthRange();
                setDataInicio(range.inicio);
                setDataFim(range.fim);
              }}
              className="rounded border px-3 py-2 text-sm text-brand-gray hover:bg-brand-gray-light"
            >
              Mês atual
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-brand-gray-muted">Carregando...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-brand-gray-muted">Receitas</p>
              <p className="text-2xl font-bold text-brand-green">
                {formatCurrency(data?.total_receitas ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-brand-gray-muted">Despesas pagas</p>
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
              <p className="text-sm text-brand-gray-muted">Investimentos</p>
              <p className="text-2xl font-bold text-brand-gray">
                {formatCurrency(data?.total_investimentos ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-brand-gray-muted">Saldo</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.saldo ?? "0")}</p>
            </div>
          </div>

          <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium text-brand-gray">Distribuição por categoria</h3>
              <div className="flex gap-1 rounded border p-1">
                {(["despesa", "receita", "investimento"] as TipoOperacao[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoGrafico(t)}
                    className={`rounded px-3 py-1 text-sm ${
                      tipoGrafico === t
                    ? "bg-brand-blue text-white"
                    : "text-brand-gray hover:bg-brand-gray-light"
                    }`}
                  >
                    {tipoPluralLabels[t]}
                  </button>
                ))}
              </div>
            </div>

            {pieData.length === 0 ? (
              <p className="py-8 text-center text-brand-gray-muted">
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
                        <Cell key={index} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {categoriasDoTipo.map((cat, index) => (
                    <div key={cat.categoria_id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-brand-gray">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: chartColors[index % chartColors.length] }}
                          />
                          {cat.nome}
                        </span>
                        <span className="font-medium">{formatCurrency(cat.total)}</span>
                      </div>
                      {cat.subcategorias.length > 1 ||
                      (cat.subcategorias.length === 1 &&
                        cat.subcategorias[0].subcategoria_id) ? (
                        <ul className="mt-1 space-y-0.5 border-l pl-4 text-xs text-brand-gray-muted">
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
              <h3 className="mb-4 font-medium text-brand-gray">
                Receitas vs Despesas por obra
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="receitas" fill={brandColors.green} name="Receitas" />
                  <Bar dataKey="despesas" fill="#dc2626" name="Despesas pagas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {!obraParam && (
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-medium text-brand-gray">Por cidade</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-gray-muted">
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
                      <td colSpan={2} className="py-4 text-center text-brand-gray-muted">
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
