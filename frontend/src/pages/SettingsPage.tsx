import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backupApi } from "../api/client";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: backups, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => backupApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => backupApi.create(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: (path: string) => backupApi.restore(path),
    onSuccess: () => {
      queryClient.invalidateQueries();
      alert("Backup restaurado. Recarregue a página se necessário.");
    },
  });

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-800">Configurações</h2>

      <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-medium">Backup manual</h3>
        <p className="mb-4 text-sm text-slate-500">
          Gera um arquivo .zip com o banco de dados e metadados na pasta de backups do sistema.
        </p>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? "Gerando..." : "Gerar backup agora"}
        </button>
        {createMutation.isSuccess && (
          <p className="mt-2 text-sm text-green-600">
            Backup salvo em: {createMutation.data.path}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-medium">Backups disponíveis</h3>
        {isLoading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : backups && backups.length > 0 ? (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.path}
                className="flex items-center justify-between rounded border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{backup.nome}</p>
                  <p className="text-slate-400">
                    {new Date(backup.criado_em).toLocaleString("pt-BR")} · {formatSize(backup.tamanho)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Restaurar este backup? Os dados atuais serão substituídos."
                      )
                    ) {
                      restoreMutation.mutate(backup.path);
                    }
                  }}
                  disabled={restoreMutation.isPending}
                  className="rounded border border-orange-300 px-3 py-1 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">Nenhum backup encontrado.</p>
        )}
      </div>
    </div>
  );
}
