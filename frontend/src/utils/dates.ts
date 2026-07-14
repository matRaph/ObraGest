export function getTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    inicio: start.toISOString().slice(0, 10),
    fim: end.toISOString().slice(0, 10),
  };
}

export function getObraDashboardRange(obra: {
  data_inicio: string | null;
  data_primeira_operacao: string | null;
  criado_em: string;
}) {
  const inicio =
    obra.data_primeira_operacao ??
    obra.data_inicio ??
    obra.criado_em.slice(0, 10);
  return {
    inicio,
    fim: getTodayIso(),
  };
}

export function formatMonthYear(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
