import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { googleDriveApi } from "../api/client";
import type { DriveBackupInfo } from "../types";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: driveStatus, isLoading, refetch } = useQuery({
    queryKey: ["google-drive-status"],
    queryFn: googleDriveApi.status,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_drive");
    if (!result) return;

    if (result === "connected") {
      setMessage("Google Drive conectado com sucesso.");
      setError(null);
      refetch();
    } else if (result === "error") {
      setError("Não foi possível conectar ao Google Drive.");
      setMessage(null);
    }

    params.delete("google_drive");
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, [refetch]);

  const connectMutation = useMutation({
    mutationFn: googleDriveApi.authUrl,
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
    onError: (err: unknown) => {
      setError(extractError(err, "Não foi possível iniciar a conexão."));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: googleDriveApi.disconnect,
    onSuccess: () => {
      setMessage("Google Drive desconectado.");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    },
    onError: (err: unknown) => {
      setError(extractError(err, "Não foi possível desconectar."));
    },
  });

  const syncMutation = useMutation({
    mutationFn: googleDriveApi.sync,
    onSuccess: (data) => {
      setMessage(data.message);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    },
    onError: (err: unknown) => {
      setError(extractError(err, "Não foi possível sincronizar."));
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (fileId: string) => googleDriveApi.restore(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setMessage("Backup restaurado. Recarregue a página se necessário.");
      setError(null);
    },
    onError: (err: unknown) => {
      setError(extractError(err, "Não foi possível restaurar o backup."));
    },
  });

  function handleDisconnect() {
    if (confirm("Desconectar o Google Drive? Os backups na nuvem serão mantidos.")) {
      disconnectMutation.mutate();
    }
  }

  function handleRestore(backup: DriveBackupInfo) {
    if (
      confirm(
        `Restaurar o backup "${backup.nome}"? Os dados atuais serão substituídos.`
      )
    ) {
      restoreMutation.mutate(backup.id);
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-800">Configurações</h2>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-medium">Backup no Google Drive</h3>
        <p className="mb-4 text-sm text-slate-500">
          Conecte sua conta Google para backup automático na nuvem. O sistema
          envia cópias do banco de dados periodicamente e mantém os últimos
          backups na pasta &quot;ObraGest Backups&quot; do seu Drive.
        </p>

        {isLoading && <p className="text-sm text-slate-500">Carregando...</p>}

        {!isLoading && driveStatus && !driveStatus.configured && (
          <p className="text-sm text-amber-600">
            Credenciais do Google não encontradas. Coloque o arquivo JSON do
            Google Cloud em <code>data/google_client_secret.json</code> e reinicie
            o backend.
          </p>
        )}

        {!isLoading && driveStatus?.configured && !driveStatus.connected && (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="rounded bg-[#09264c] px-4 py-2 text-sm text-white hover:bg-[#0d3470] disabled:opacity-50"
          >
            {connectMutation.isPending ? "Conectando..." : "Conectar Google Drive"}
          </button>
        )}

        {!isLoading && driveStatus?.connected && (
          <div className="space-y-4">
            <div className="rounded border border-[#d4e8c6] bg-[#eef5e9] px-4 py-3 text-sm text-[#3e6225]">
              Conectado como <strong>{driveStatus.email}</strong>
            </div>

            <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Último backup</dt>
                <dd>{formatDateTime(driveStatus.last_backup_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Intervalo automático</dt>
                <dd>A cada {driveStatus.interval_minutes} minutos</dd>
              </div>
              <div>
                <dt className="text-slate-500">Última restauração</dt>
                <dd>{formatDateTime(driveStatus.last_restore_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Backups mantidos</dt>
                <dd>Até {driveStatus.max_backups} arquivos</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="rounded bg-[#09264c] px-4 py-2 text-sm text-white hover:bg-[#0d3470] disabled:opacity-50"
              >
                {syncMutation.isPending ? "Sincronizando..." : "Sincronizar agora"}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>

            {driveStatus.error && (
              <p className="text-sm text-red-600">{driveStatus.error}</p>
            )}

            {driveStatus.backups.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700">
                  Backups na nuvem
                </h4>
                <ul className="divide-y rounded border">
                  {driveStatus.backups.map((backup) => (
                    <li
                      key={backup.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{backup.nome}</p>
                        <p className="text-slate-500">
                          {formatDateTime(backup.criado_em)} · {formatBytes(backup.tamanho)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={restoreMutation.isPending}
                        className="shrink-0 rounded border border-orange-300 px-3 py-1 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                      >
                        Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {message && <p className="mt-4 text-sm text-[#4f7c2f]">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function extractError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data
  ) {
    return String(error.response.data.error);
  }
  return fallback;
}
