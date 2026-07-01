import axios from "axios";
import type {
  BackupInfo,
  Categoria,
  DashboardData,
  ExtratoItem,
  Obra,
  Operacao,
  PaginatedResponse,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export const obrasApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Obra>>("/obras/", { params }).then((r) => r.data),
  get: (id: string) => api.get<Obra>(`/obras/${id}/`).then((r) => r.data),
  create: (data: Partial<Obra>) => api.post<Obra>("/obras/", data).then((r) => r.data),
  update: (id: string, data: Partial<Obra>) =>
    api.patch<Obra>(`/obras/${id}/`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/obras/${id}/`),
};

export const operacoesApi = {
  listByObra: (obraId: string, params?: Record<string, string>) =>
    api
      .get<PaginatedResponse<Operacao>>(`/obras/${obraId}/operacoes/`, { params })
      .then((r) => r.data),
  create: (obraId: string, data: Partial<Operacao>) =>
    api.post<Operacao>(`/obras/${obraId}/operacoes/`, data).then((r) => r.data),
  update: (id: string, data: Partial<Operacao>) =>
    api.patch<Operacao>(`/operacoes/${id}/`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/operacoes/${id}/`),
  extrato: (obraId: string, params?: Record<string, string>) =>
    api
      .get<ExtratoItem[]>(`/obras/${obraId}/extrato/`, { params })
      .then((r) => r.data),
};

export const categoriasApi = {
  list: () => api.get<PaginatedResponse<Categoria>>("/categorias/").then((r) => r.data),
};

export const dashboardApi = {
  get: (params?: Record<string, string>) =>
    api.get<DashboardData>("/dashboard/", { params }).then((r) => r.data),
};

export const backupApi = {
  list: () =>
    api.get<{ backups: BackupInfo[] }>("/backup/").then((r) => r.data.backups),
  create: (destino?: string) =>
    api.post<{ message: string; path: string }>("/backup/", { destino }).then((r) => r.data),
  restore: (path: string) =>
    api.post<{ message: string }>("/backup/restore/", { path }).then((r) => r.data),
};

export function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
}

export const statusLabels: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  pausada: "Pausada",
};
