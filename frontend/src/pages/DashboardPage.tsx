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
const PIE_HEIGHT = 340;
const PIE_CENTER_Y = PIE_HEIGHT / 2;
const PIE_LABEL_MIN_Y = 18;
const PIE_LABEL_MAX_Y = PIE_HEIGHT - 18;
const RADIAN = Math.PI / 180;

type PeriodoPreset = "desde_inicio" | "mes_atual" | "custom";
type PieDatum = { key: string; name: string; value: number };
type PieLabelPosition = {
  key: string;
  name: string;
  percent: number;
  side: "left" | "right";
  targetY: number;
  y: number;
};

function distributePieLabels(labels: PieLabelPosition[]) {
  if (labels.length === 0) return;
  labels.sort((a, b) => a.targetY - b.targetY);
  const availableHeight = PIE_LABEL_MAX_Y - PIE_LABEL_MIN_Y;
  const gap =
    labels.length === 1 ? 0 : Math.min(22, availableHeight / (labels.length - 1));

  labels.forEach((label, index) => {
    const minimumY = index === 0 ? PIE_LABEL_MIN_Y : labels[index - 1].y + gap;
    label.y = Math.max(label.targetY, minimumY);
  });

  if (labels[labels.length - 1].y > PIE_LABEL_MAX_Y) {
    labels[labels.length - 1].y = PIE_LABEL_MAX_Y;
    for (let index = labels.length - 2; index >= 0; index -= 1) {
      labels[index].y = Math.min(labels[index].y, labels[index + 1].y - gap);
    }
  }
}

function buildPieLabelPositions(data: PieDatum[]) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const labels: PieLabelPosition[] = [];
  let currentAngle = 90;

  for (const item of data) {
    const angle = total > 0 ? (item.value / total) * 360 : 0;
    const midAngle = currentAngle - angle / 2;
    const direction = Math.cos(-midAngle * RADIAN);
    labels.push({
      key: item.key,
      name: item.name,
      percent: total > 0 ? item.value / total : 0,
      side: direction >= 0 ? "right" : "left",
      targetY: PIE_CENTER_Y + 128 * Math.sin(-midAngle * RADIAN),
      y: 0,
    });
    currentAngle -= angle;
  }

  distributePieLabels(labels.filter((label) => label.side === "left"));
  distributePieLabels(labels.filter((label) => label.side === "right"));
  return new Map(labels.map((label) => [label.key, label]));
}

function shortenPieLabel(name: string) {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

function presetButtonClass(active: boolean) {
  return active
    ? "rounded border border-brand-blue bg-brand-blue px-3 py-2 text-sm text-white"
    : "rounded border px-3 py-2 text-sm text-brand-gray hover:bg-brand-gray-light";
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const obraParam = searchParams.get("obra") ?? "";

  const [dataInicio, setDataInicio] = useState(
    obraParam ? "" : defaultRange.inicio
  );
  const [dataFim, setDataFim] = useState(obraParam ? "" : defaultRange.fim);
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>(
    obraParam ? "desde_inicio" : "mes_atual"
  );
  const [tipoGrafico, setTipoGrafico] = useState<TipoOperacao>("despesa");

  const params: Record<string, string> = {
    data_inicio: dataInicio,
    data_fim: dataFim,
  };
  if (obraParam) params.obra = obraParam;

  const { data: obrasData } = useQuery({
    queryKey: ["obras", { ordering: "nome" }],
    queryFn: () => obrasApi.list({ ordering: "nome" }),
  });
  const obras = obrasData?.results ?? [];
  const obraSelecionada = obras.find((o) => o.id === obraParam);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => dashboardApi.get(params),
    enabled: Boolean(dataInicio && dataFim) && (!obraParam || !!obraSelecionada),
  });

  useEffect(() => {
    if (obraSelecionada) {
      const range = getObraDashboardRange(obraSelecionada);
      setDataInicio(range.inicio);
      setDataFim(range.fim);
      setPeriodoPreset("desde_inicio");
    } else if (!obraParam) {
      const range = getCurrentMonthRange();
      setDataInicio(range.inicio);
      setDataFim(range.fim);
      setPeriodoPreset("mes_atual");
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
    .map((c) => ({
      key: `${c.categoria_id}:${c.tipo}`,
      name: c.nome,
      value: parseFloat(c.total),
    }))
    .filter((d) => d.value > 0);
  const pieTotal = pieData.reduce((total, item) => total + item.value, 0);
  const pieLabelPositions = buildPieLabelPositions(pieData);

  function renderPieLabel(entry: {
    cx?: number | string;
    cy?: number | string;
    midAngle?: number;
    outerRadius?: number | string;
    payload?: PieDatum;
  }) {
    const position = entry.payload
      ? pieLabelPositions.get(entry.payload.key)
      : undefined;
    if (!position) return null;

    const cx = Number(entry.cx);
    const cy = Number(entry.cy);
    const radius = Number(entry.outerRadius);
    const midAngle = entry.midAngle ?? 0;
    const direction = position.side === "right" ? 1 : -1;
    const sectorX = cx + (radius + 3) * Math.cos(-midAngle * RADIAN);
    const sectorY = cy + (radius + 3) * Math.sin(-midAngle * RADIAN);
    const elbowX = cx + direction * (radius + 16);
    const textX = cx + direction * (radius + 32);
    const lineEndX = textX - direction * 4;

    return (
      <g aria-hidden>
        <polyline
          points={`${sectorX},${sectorY} ${elbowX},${position.y} ${lineEndX},${position.y}`}
          fill="none"
          stroke="currentColor"
          className="text-brand-gray-muted"
          strokeWidth={1}
        />
        <text
          x={textX}
          y={position.y}
          dy="0.35em"
          textAnchor={position.side === "right" ? "start" : "end"}
          className="fill-brand-gray text-xs"
        >
          {shortenPieLabel(position.name)}: {(position.percent * 100).toFixed(0)}%
        </text>
      </g>
    );
  }

  function resetPeriodo() {
    if (obraSelecionada) {
      const range = getObraDashboardRange(obraSelecionada);
      setDataInicio(range.inicio);
      setDataFim(getTodayIso());
      setPeriodoPreset("desde_inicio");
    } else {
      const range = getCurrentMonthRange();
      setDataInicio(range.inicio);
      setDataFim(range.fim);
      setPeriodoPreset("mes_atual");
    }
  }

  function aplicarMesAtual() {
    const range = getCurrentMonthRange();
    setDataInicio(range.inicio);
    setDataFim(range.fim);
    setPeriodoPreset("mes_atual");
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
          {formatDate(periodoObra.inicio)} até hoje
          {obraSelecionada.data_primeira_operacao &&
            obraSelecionada.data_inicio &&
            obraSelecionada.data_primeira_operacao < obraSelecionada.data_inicio &&
            " (inclui operações anteriores à data de início da obra)"}
          . Ajuste as datas abaixo se quiser filtrar um intervalo menor.
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
              onChange={(value) => {
                setDataInicio(value);
                setPeriodoPreset("custom");
              }}
              className="text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-brand-gray">
            Até
            <DateField
              value={dataFim}
              onChange={(value) => {
                setDataFim(value);
                setPeriodoPreset("custom");
              }}
              className="text-sm"
            />
          </label>
          <button
            type="button"
            onClick={resetPeriodo}
            className={presetButtonClass(
              obraSelecionada
                ? periodoPreset === "desde_inicio"
                : periodoPreset === "mes_atual"
            )}
          >
            {obraSelecionada ? "Desde o início" : "Mês atual"}
          </button>
          {obraSelecionada && (
            <button
              type="button"
              onClick={aplicarMesAtual}
              className={presetButtonClass(periodoPreset === "mes_atual")}
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
              <div className="grid items-center gap-6 xl:grid-cols-2">
                <div className="overflow-x-auto">
                  <div className="h-[340px] min-w-[520px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          label={renderPieLabel}
                          labelLine={false}
                        >
                          {pieData.map((item, index) => (
                            <Cell
                              key={item.key}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

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
                        <span className="font-medium">
                          {formatCurrency(cat.total)}
                          {pieTotal > 0 && (
                            <span className="ml-1 text-xs font-normal text-brand-gray-muted">
                              ({((parseFloat(cat.total) / pieTotal) * 100).toFixed(0)}%)
                            </span>
                          )}
                        </span>
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
