import type { DashboardData, Obra, Operacao } from "../types";
import { statusLabels, tipoLabels } from "../api/client";

// Gera e faz download de um arquivo CSV com BOM UTF-8 (compatível com Excel pt-BR)
function downloadCsv(filename: string, rows: string[][]): void {
  const sep = ";";
  const bom = "\uFEFF";
  const content =
    bom +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "");
            // Envolve em aspas se contiver ponto-e-vírgula, aspas ou quebra de linha
            if (str.includes(sep) || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(sep)
      )
      .join("\r\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatValorCsv(valor: string | number): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return n.toFixed(2).replace(".", ",");
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ── Exportação da página da Obra ────────────────────────────────────────────

export function exportarObra(obra: Obra, operacoes: Operacao[]): void {
  const rows: string[][] = [];

  // Cabeçalho da obra
  rows.push(["RELATÓRIO DA OBRA"]);
  rows.push([]);
  rows.push(["Nome", obra.nome]);
  rows.push(["Cidade", obra.cidade]);
  rows.push(["Status", statusLabels[obra.status] ?? obra.status]);
  rows.push(["Início", formatDataBr(obra.data_inicio)]);
  if (obra.descricao) rows.push(["Descrição", obra.descricao]);
  rows.push([]);

  // Resumo financeiro
  rows.push(["RESUMO FINANCEIRO"]);
  rows.push(["Receitas", formatValorCsv(obra.total_receitas)]);
  rows.push(["Despesas pagas", formatValorCsv(obra.total_despesas)]);
  rows.push(["Despesas não pagas", formatValorCsv(obra.total_despesas_pendentes)]);
  rows.push(["Investimentos", formatValorCsv(obra.total_investimentos)]);
  rows.push(["Saldo", formatValorCsv(obra.saldo)]);
  rows.push([]);

  // Tabela de operações
  rows.push(["OPERAÇÕES"]);
  rows.push(["Data", "Tipo", "Categoria", "Subcategoria", "Descrição", "Situação", "Valor (R$)"]);

  for (const op of operacoes) {
    rows.push([
      formatDataBr(op.data),
      tipoLabels[op.tipo] ?? op.tipo,
      op.categoria_nome,
      op.subcategoria_nome ?? "",
      op.descricao ?? "",
      op.tipo === "despesa" ? (op.pago ? "Paga" : "Não paga") : "",
      formatValorCsv(op.valor),
    ]);
  }

  const nomeSanitizado = obra.nome.replace(/[^a-zA-Z0-9À-ú\s]/g, "").trim();
  const data = new Date().toISOString().slice(0, 10);
  downloadCsv(`ObraGest - ${nomeSanitizado} - ${data}.csv`, rows);
}

// ── Exportação do Dashboard ──────────────────────────────────────────────────

export function exportarDashboard(
  data: DashboardData,
  params: {
    obraNome?: string;
    dataInicio: string;
    dataFim: string;
  }
): void {
  const rows: string[][] = [];
  const periodo = `${formatDataBr(params.dataInicio)} a ${formatDataBr(params.dataFim)}`;

  rows.push(["RELATÓRIO DE DASHBOARD — OBRAGEST"]);
  rows.push(["Gerado em", new Date().toLocaleString("pt-BR")]);
  rows.push(["Período", periodo]);
  if (params.obraNome) rows.push(["Obra", params.obraNome]);
  rows.push([]);

  // Resumo geral
  rows.push(["RESUMO GERAL"]);
  rows.push(["Receitas", formatValorCsv(data.total_receitas)]);
  rows.push(["Despesas pagas", formatValorCsv(data.total_despesas)]);
  rows.push(["Despesas não pagas", formatValorCsv(data.total_despesas_pendentes)]);
  rows.push(["Investimentos", formatValorCsv(data.total_investimentos)]);
  rows.push(["Saldo", formatValorCsv(data.saldo)]);
  rows.push([]);

  // Por categoria
  rows.push(["DISTRIBUIÇÃO POR CATEGORIA"]);
  rows.push(["Tipo", "Categoria", "Subcategoria", "Total (R$)"]);
  for (const cat of data.por_categoria) {
    rows.push([tipoLabels[cat.tipo] ?? cat.tipo, cat.nome, "", formatValorCsv(cat.total)]);
    for (const sub of cat.subcategorias) {
      if (sub.subcategoria_id) {
        rows.push(["", cat.nome, sub.nome, formatValorCsv(sub.total)]);
      }
    }
  }
  rows.push([]);

  // Por obra (somente no dashboard geral)
  if (data.por_obra.length > 0) {
    rows.push(["RESUMO POR OBRA"]);
    rows.push(["Obra", "Cidade", "Receitas (R$)", "Despesas (R$)", "Investimentos (R$)", "Saldo (R$)"]);
    for (const o of data.por_obra) {
      rows.push([
        o.nome,
        o.cidade,
        formatValorCsv(o.receitas),
        formatValorCsv(o.despesas),
        formatValorCsv(o.investimentos),
        formatValorCsv(o.saldo),
      ]);
    }
    rows.push([]);
  }

  // Por cidade
  if (data.por_cidade.length > 0) {
    rows.push(["RESUMO POR CIDADE"]);
    rows.push(["Cidade", "Receitas (R$)", "Despesas (R$)", "Investimentos (R$)", "Saldo (R$)"]);
    for (const c of data.por_cidade) {
      rows.push([
        c.cidade,
        formatValorCsv(c.receitas),
        formatValorCsv(c.despesas),
        formatValorCsv(c.investimentos),
        formatValorCsv(c.saldo),
      ]);
    }
  }

  const nomeParte = params.obraNome
    ? ` - ${params.obraNome.replace(/[^a-zA-Z0-9À-ú\s]/g, "").trim()}`
    : "";
  const dataArquivo = new Date().toISOString().slice(0, 10);
  downloadCsv(`ObraGest - Dashboard${nomeParte} - ${dataArquivo}.csv`, rows);
}
