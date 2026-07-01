import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardApi, formatCurrency, tipoLabels } from "../api/client";

export default function DashboardPage() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const params: Record<string, string> = {};
  if (dataInicio) params.data_inicio = dataInicio;
  if (dataFim) params.data_fim = dataFim;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => dashboardApi.get(params),
  });

  const chartData =
    data?.por_obra.map((item) => ({
      nome: item.nome,
      receitas: parseFloat(item.receitas),
      despesas: parseFloat(item.despesas),
    })) ?? [];

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-800">Dashboard</h2>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-slate-500">Carregando...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total receitas</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(data?.total_receitas ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total despesas</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data?.total_despesas ?? "0")}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Saldo geral</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.saldo ?? "0")}</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-4 font-medium text-slate-700">Receitas vs Despesas por obra</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="receitas" fill="#16a34a" name="Receitas" />
                  <Bar dataKey="despesas" fill="#dc2626" name="Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
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
                      <td className="py-2 text-right font-medium">{formatCurrency(item.saldo)}</td>
                    </tr>
                  ))}
                  {data?.por_cidade.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-slate-400">
                        Sem dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-medium text-slate-700">Por categoria</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-2">Categoria</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.por_categoria.map((item) => (
                    <tr key={item.categoria_id} className="border-t">
                      <td className="py-2">
                        {item.nome}{" "}
                        <span className="text-xs text-slate-400">
                          ({tipoLabels[item.tipo] ?? item.tipo})
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {data?.por_categoria.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-slate-400">
                        Sem dados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
