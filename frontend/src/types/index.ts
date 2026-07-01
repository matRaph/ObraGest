export type ObraStatus = "planejada" | "em_andamento" | "concluida" | "pausada";
export type TipoOperacao = "receita" | "despesa";

export interface Obra {
  id: string;
  nome: string;
  cidade: string;
  status: ObraStatus;
  data_inicio: string | null;
  descricao: string;
  criado_em: string;
  total_receitas: string;
  total_despesas: string;
  saldo: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoOperacao;
  padrao: boolean;
  ativa: boolean;
}

export interface Operacao {
  id: string;
  obra: string;
  categoria: string;
  categoria_nome: string;
  valor: string;
  data: string;
  tipo: TipoOperacao;
  descricao: string;
  criado_em: string;
}

export interface ExtratoItem {
  id: string;
  data: string;
  descricao: string;
  categoria_nome: string;
  tipo: TipoOperacao;
  valor: string;
  saldo_acumulado: string;
}

export interface DashboardData {
  total_receitas: string;
  total_despesas: string;
  saldo: string;
  por_obra: Array<{
    obra_id: string;
    nome: string;
    cidade: string;
    receitas: string;
    despesas: string;
    saldo: string;
  }>;
  por_cidade: Array<{
    cidade: string;
    receitas: string;
    despesas: string;
    saldo: string;
  }>;
  por_categoria: Array<{
    categoria_id: string;
    nome: string;
    tipo: TipoOperacao;
    total: string;
  }>;
}

export interface BackupInfo {
  nome: string;
  path: string;
  tamanho: number;
  criado_em: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
