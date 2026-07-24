export type ObraStatus = "planejada" | "em_andamento" | "concluida" | "pausada";
export type TipoOperacao = "receita" | "despesa" | "investimento";

export interface Obra {
  id: string;
  nome: string;
  cidade: string;
  status: ObraStatus;
  data_inicio: string | null;
  descricao: string;
  arquivada: boolean;
  criado_em: string;
  total_receitas: string;
  total_despesas: string;
  total_despesas_pendentes: string;
  total_investimentos: string;
  saldo: string;
  data_primeira_operacao: string | null;
}

export interface Subcategoria {
  id: string;
  nome: string;
  tipo: TipoOperacao;
  parent: string;
  padrao: boolean;
  ativa: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoOperacao;
  parent: string | null;
  padrao: boolean;
  ativa: boolean;
  subcategorias: Subcategoria[];
}

export interface Fornecedor {
  id: string;
  nome: string;
  ativa: boolean;
}

export interface Operacao {
  id: string;
  obra: string;
  categoria: string;
  categoria_nome: string;
  subcategoria: string | null;
  subcategoria_nome: string | null;
  fornecedor: string | null;
  fornecedor_nome: string | null;
  valor: string;
  quantidade: string | null;
  data: string;
  tipo: TipoOperacao;
  pago: boolean;
  descricao: string;
  criado_em: string;
}

export interface DashboardData {
  total_receitas: string;
  total_despesas: string;
  total_despesas_pendentes: string;
  total_investimentos: string;
  saldo: string;
  por_obra: Array<{
    obra_id: string;
    nome: string;
    cidade: string;
    receitas: string;
    despesas: string;
    investimentos: string;
    saldo: string;
  }>;
  por_cidade: Array<{
    cidade: string;
    receitas: string;
    despesas: string;
    investimentos: string;
    saldo: string;
  }>;
  por_categoria: Array<{
    categoria_id: string;
    nome: string;
    tipo: TipoOperacao;
    total: string;
    subcategorias: Array<{
      subcategoria_id: string | null;
      nome: string;
      total: string;
    }>;
  }>;
}

export interface BackupInfo {
  nome: string;
  path: string;
  tamanho: number;
  criado_em: string;
}

export interface DriveBackupInfo {
  id: string;
  nome: string;
  tamanho: number;
  criado_em: string;
}

export interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  credentials_path: string;
  last_backup_at: string | null;
  last_restore_at: string | null;
  last_backup_name: string | null;
  interval_minutes: number;
  max_backups: number;
  backups: DriveBackupInfo[];
  needs_reauth?: boolean;
  error?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
