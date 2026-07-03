import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { backupApi } from "../api/client";
import { BackupDownloadCancelledError } from "../utils/saveBackup";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const downloadMutation = useMutation({
    mutationFn: () => backupApi.download(),
    onSuccess: (filename) => {
      setDownloadMessage(`Backup salvo: ${filename}`);
      setDownloadError(null);
      setRestoreError(null);
    },
    onError: (error: unknown) => {
      if (error instanceof BackupDownloadCancelledError) {
        setDownloadMessage(null);
        setDownloadError(null);
        return;
      }
      setDownloadMessage(null);
      setDownloadError(
        error instanceof Error ? error.message : "Não foi possível salvar o backup."
      );
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => backupApi.restoreFile(file),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setRestoreError(null);
      alert("Backup restaurado. Recarregue a página se necessário.");
    },
    onError: (error: unknown) => {
      const message =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "error" in error.response.data
          ? String(error.response.data.error)
          : "Não foi possível restaurar o backup.";
      setRestoreError(message);
    },
  });

  function handleRestoreClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (
      confirm(
        `Restaurar o backup "${file.name}"? Os dados atuais serão substituídos.`
      )
    ) {
      restoreMutation.mutate(file);
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-2xl font-semibold text-slate-800">Configurações</h2>

      <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-medium">Backup manual</h3>
        <p className="mb-4 text-sm text-slate-500">
          Gera um arquivo .zip com o banco de dados e metadados. Ao clicar, o
          navegador abrirá o diálogo para escolher onde salvar o arquivo.
          Recomendado usar Chrome ou Edge para escolher a pasta de destino.
        </p>
        <button
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {downloadMutation.isPending ? "Gerando..." : "Salvar backup..."}
        </button>
        {downloadMessage && (
          <p className="mt-2 text-sm text-green-600">{downloadMessage}</p>
        )}
        {downloadError && (
          <p className="mt-2 text-sm text-red-600">{downloadError}</p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="mb-2 font-medium">Restaurar backup</h3>
        <p className="mb-4 text-sm text-slate-500">
          Selecione um arquivo .zip de backup salvo no seu computador.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={handleRestoreClick}
          disabled={restoreMutation.isPending}
          className="rounded border border-orange-300 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 disabled:opacity-50"
        >
          {restoreMutation.isPending ? "Restaurando..." : "Escolher arquivo..."}
        </button>
        {restoreError && (
          <p className="mt-2 text-sm text-red-600">{restoreError}</p>
        )}
      </div>
    </div>
  );
}
