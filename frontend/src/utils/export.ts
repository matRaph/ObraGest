function filenameFromContentDisposition(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

export async function downloadApiExport(
  url: string,
  params?: Record<string, string>
): Promise<void> {
  const search = params ? `?${new URLSearchParams(params).toString()}` : "";
  const response = await fetch(`/api${url}${search}`);
  if (!response.ok) {
    throw new Error("Não foi possível gerar o relatório.");
  }

  const blob = await response.blob();
  const filename =
    filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
    "relatorio.csv";

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
