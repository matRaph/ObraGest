import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fornecedoresApi } from "../api/client";
import FieldLabel from "../components/FieldLabel";

export default function FornecedoresPage() {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [editing, setEditing] = useState<{ id: string; nome: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: () => fornecedoresApi.list(),
  });

  const fornecedores = (data?.results ?? []).sort((a, b) => a.nome.localeCompare(b.nome));

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
          if (novoNome.trim()) createFornecedor.mutate();
        }}
        className="mb-6 rounded-lg border bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <FieldLabel htmlFor="forn-nome" label="Novo fornecedor" />
            <input
              id="forn-nome"
              value={novoNome}
              maxLength={100}
              placeholder="Ex.: Materiais Silva"
              onChange={(e) => setNovoNome(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createFornecedor.isPending}
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
      ) : fornecedores.length === 0 ? (
        <p className="text-sm text-brand-gray-muted">Nenhum fornecedor cadastrado.</p>
      ) : (
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
      )}
    </div>
  );
}
