import axios from "axios";
import type {
  Categoria,
  DashboardData,
  GoogleDriveStatus,
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
  cidades: () => api.get<string[]>("/obras/cidades/").then((r) => r.data),
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
};

export interface CategoriaInput {
  nome: string;
  tipo?: string;
  parent?: string | null;
}

export const categoriasApi = {
  list: () => api.get<PaginatedResponse<Categoria>>("/categorias/").then((r) => r.data),
  create: (data: CategoriaInput) =>
    api.post<Categoria>("/categorias/", data).then((r) => r.data),
  update: (id: string, data: Partial<CategoriaInput>) =>
    api.patch<Categoria>(`/categorias/${id}/`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/categorias/${id}/`),
};

export const dashboardApi = {
  get: (params?: Record<string, string>) =>
    api.get<DashboardData>("/dashboard/", { params }).then((r) => r.data),
};

export const googleDriveApi = {
  status: () =>
    api.get<GoogleDriveStatus>("/google-drive/status/").then((r) => r.data),
  authUrl: () =>
    api.get<{ auth_url: string }>("/google-drive/auth/").then((r) => r.data.auth_url),
  disconnect: () =>
    api.post<{ message: string }>("/google-drive/disconnect/").then((r) => r.data),
  sync: () =>
    api.post<{ message: string }>("/google-drive/sync/").then((r) => r.data),
  restore: (fileId: string) =>
    api
      .post<{ message: string }>("/google-drive/restore/", { file_id: fileId })
      .then((r) => r.data),
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

export const tipoLabels: Record<string, string> = {
  despesa: "Despesa",
  receita: "Receita",
  investimento: "Investimento",
};

export const tipoPluralLabels: Record<string, string> = {
  despesa: "Despesas",
  receita: "Receitas",
  investimento: "Investimentos",
};
