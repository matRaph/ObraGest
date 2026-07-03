import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

function suggestedBackupName() {
  const timestamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, "")
    .replace(/(\d{8})(\d{6})/, "$1_$2");
  return `obragest_backup_${timestamp}.zip`;
}

function parseFilename(contentDisposition: string | undefined, fallback: string) {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
  return match?.[1] ?? fallback;
}

async function readApiError(blob: Blob): Promise<string | null> {
  if (!blob.type.includes("json")) return null;
  try {
    const data = JSON.parse(await blob.text()) as { error?: string; detail?: string };
    return data.error ?? data.detail ?? null;
  } catch {
    return null;
  }
}

async function fetchBackupBlob() {
  const response = await api.get<Blob>("/backup/download/", {
    responseType: "blob",
  });

  if (response.data.type.includes("json")) {
    const message = await readApiError(response.data);
    throw new Error(message ?? "Erro ao gerar backup.");
  }

  return {
    blob: response.data,
    filename: parseFilename(
      response.headers["content-disposition"],
      suggestedBackupName()
    ),
  };
}

async function saveWithLink(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

export class BackupDownloadCancelledError extends Error {
  constructor() {
    super("cancelled");
    this.name = "BackupDownloadCancelledError";
  }
}

export async function saveBackupToLocalFolder() {
  const fallbackName = suggestedBackupName();
  let fileHandle: FileSystemFileHandle | null = null;

  if ("showSaveFilePicker" in window) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: fallbackName,
        types: [
          {
            description: "Backup ObraGest",
            accept: { "application/zip": [".zip"] },
          },
        ],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new BackupDownloadCancelledError();
      }
    }
  }

  const { blob, filename } = await fetchBackupBlob();

  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return fileHandle.name;
  }

  return saveWithLink(blob, filename);
}
