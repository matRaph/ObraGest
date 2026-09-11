import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fornecedoresApi } from "../api/client";
import FieldLabel from "../components/FieldLabel";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function FornecedoresPage() {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [editing, setEditing] = useState<{ id: string; nome: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);

  const listParams = {
    page: String(page),
    page_size: String(pageSize),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores", "list", listParams],
    queryFn: () => fornecedoresApi.list(listParams),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(novoNome.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [novoNome]);

  const { data: sugestoesData } = useQuery({
    queryKey: ["fornecedores", "search", searchDebounced],
    queryFn: () =>
      fornecedoresApi.list({ search: searchDebounced, page_size: "8" }),
    enabled: searchDebounced.length >= 1,
  });

  const sugestoes = sugestoesData?.results ?? [];
  const nomeNormalizado = novoNome.trim().toLowerCase();
  const buscaAlinhada = searchDebounced.toLowerCase() === nomeNormalizado;
  const nomeJaExiste =
    buscaAlinhada &&
    sugestoes.some((f) => f.nome.toLowerCase() === nomeNormalizado);

  const fornecedores = data?.results ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (!data) return;
    if (page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
  }

  function handleError(err: unknown) {
    const detail =
      err &&
      typeof err === "object" &&
      "response" in err &&
      (err as { response?: { data?: unknown } }).response?.data;
    setError(
      typeof detail === "object" && detail
        ? Object.values(detail as Record<string, unknown>).flat().join(" ")
        : "Não foi possível concluir a operação."
    );
  }

  const createFornecedor = useMutation({
    mutationFn: () => fornecedoresApi.create({ nome: novoNome.trim() }),
    onSuccess: () => {
      setNovoNome("");
      setSearchDebounced("");
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  const renameFornecedor = useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      fornecedoresApi.update(id, { nome: nome.trim() }),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  const deleteFornecedor = useMutation({
    mutationFn: (id: string) => fornecedoresApi.delete(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-brand-gray">Fornecedores</h2>
      <p className="mb-6 text-sm text-brand-gray-muted">
        Cadastre fornecedores para associar às operações. O campo é opcional no
        lançamento. Excluir mantém as operações já registradas.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (novoNome.trim() && !nomeJaExiste) createFornecedor.mutate();
        }}
        className="mb-6 rounded-lg border bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <FieldLabel htmlFor="forn-nome" label="Novo fornecedor" />
            <input
              id="forn-nome"
              value={novoNome}
              maxLength={100}
              placeholder="Ex.: Materiais Silva"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={searchDebounced.length >= 1 && sugestoes.length > 0}
              onChange={(e) => {
                setNovoNome(e.target.value);
                setError(null);
              }}
              className="w-full rounded border px-3 py-2"
            />
            {searchDebounced.length >= 1 && sugestoes.length > 0 && (
              <div className="mt-2 rounded border border-brand-gray-border bg-brand-gray-light/40 px-3 py-2 text-sm">
                <p className="mb-1.5 text-xs font-medium text-brand-gray-muted">
                  {nomeJaExiste
                    ? "Já existe um fornecedor com esse nome:"
                    : "Fornecedores parecidos:"}
                </p>
                <ul className="space-y-1">
                  {sugestoes.map((f) => {
                    const exact = f.nome.toLowerCase() === nomeNormalizado;
                    return (
                      <li
                        key={f.id}
                        className={
                          exact
                            ? "font-medium text-brand-gray"
                            : "text-brand-gray-muted"
                        }
                      >
                        {f.nome}
                        {exact ? " (já cadastrado)" : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createFornecedor.isPending || !novoNome.trim() || nomeJaExiste}
              className="rounded bg-brand-blue px-4 py-2 text-sm text-white hover:bg-brand-blue-dark disabled:opacity-50"
            >
              Adicionar
            </button>
          </div>
        </div>
      </form>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-brand-gray-muted">Carregando...</p>
      ) : total === 0 ? (
        <p className="text-sm text-brand-gray-muted">Nenhum fornecedor cadastrado.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {fornecedores.map((forn) => {
              const isEditing = editing?.id === forn.id;
              return (
                <div
                  key={forn.id}
                  className="rounded-lg border border-brand-gray-border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    {isEditing ? (
                      <form
                        className="flex flex-1 gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editing.nome.trim()) renameFornecedor.mutate(editing);
                        }}
                      >
                        <input
                          autoFocus
                          value={editing.nome}
                          maxLength={100}
                          onChange={(e) => setEditing({ id: forn.id, nome: e.target.value })}
                          className="flex-1 rounded border px-2 py-1 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded bg-brand-green px-3 py-1 text-xs text-white"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded border px-3 py-1 text-xs text-brand-gray"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="font-medium text-brand-gray">{forn.nome}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditing({ id: forn.id, nome: forn.nome })}
                            className="text-xs text-brand-gray-muted hover:text-brand-gray"
                          >
                            Renomear
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Excluir o fornecedor "${forn.nome}"? As operações existentes são mantidas.`
                                )
                              ) {
                                deleteFornecedor.mutate(forn.id);
                              }
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-brand-gray-muted">
            <div className="flex flex-wrap items-center gap-3">
              <p>
                Mostrando {rangeStart}–{rangeEnd} de {total}
              </p>
              <label className="flex items-center gap-2">
                <span>Por página</span>
                <select
                  value={pageSize}
                  onChange={(e) =>
                    setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                  }
                  className="rounded border px-2 py-1.5 text-brand-gray"
                  aria-label="Quantidade por página"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border px-3 py-1.5 text-brand-gray hover:bg-brand-gray-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="tabular-nums">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded border px-3 py-1.5 text-brand-gray hover:bg-brand-gray-light disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
