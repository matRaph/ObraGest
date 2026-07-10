import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriasApi, tipoPluralLabels } from "../api/client";
import FieldLabel from "../components/FieldLabel";
import type { Categoria, TipoOperacao } from "../types";

const TIPOS: TipoOperacao[] = ["despesa", "receita", "investimento"];

const tipoStyles: Record<TipoOperacao, string> = {
  despesa: "border-red-200",
  receita: "border-brand-green-light",
  investimento: "border-brand-gray-border",
};

const tipoHeaderStyles: Record<TipoOperacao, string> = {
  despesa: "text-red-700",
  receita: "text-brand-green-dark",
  investimento: "text-brand-gray",
};

export default function CategoriasPage() {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<TipoOperacao>("despesa");
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; nome: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => categoriasApi.list(),
  });

  const categorias = data?.results ?? [];

  const grupos = useMemo(() => {
    return TIPOS.map((tipo) => ({
      tipo,
      itens: categorias
        .filter((c) => c.tipo === tipo)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    }));
  }, [categorias]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
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

  const createCategoria = useMutation({
    mutationFn: () => categoriasApi.create({ nome: novoNome.trim(), tipo: novoTipo }),
    onSuccess: () => {
      setNovoNome("");
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  const createSub = useMutation({
    mutationFn: ({ parent, nome }: { parent: string; nome: string }) =>
      categoriasApi.create({ nome: nome.trim(), parent }),
    onSuccess: (_data, variables) => {
      setSubInputs((prev) => ({ ...prev, [variables.parent]: "" }));
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  const renameCategoria = useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) =>
      categoriasApi.update(id, { nome: nome.trim() }),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  const deleteCategoria = useMutation({
    mutationFn: (id: string) => categoriasApi.delete(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: handleError,
  });

  function renderCategoriaCard(cat: Categoria) {
    const isEditing = editing?.id === cat.id;
    return (
      <div key={cat.id} className={`rounded-lg border ${tipoStyles[cat.tipo]} bg-white p-4 shadow-sm`}>
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (editing.nome.trim()) renameCategoria.mutate(editing);
              }}
            >
              <input
                autoFocus
                value={editing.nome}
                maxLength={100}
                onChange={(e) => setEditing({ id: cat.id, nome: e.target.value })}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <button type="submit" className="rounded bg-brand-green px-3 py-1 text-xs text-white">
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
              <div className="flex items-center gap-2">
                <span className="font-medium text-brand-gray">{cat.nome}</span>
                {cat.padrao && (
                  <span className="rounded bg-brand-gray-light px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-gray-muted">
                    padrão
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing({ id: cat.id, nome: cat.nome })}
                  className="text-xs text-brand-gray-muted hover:text-brand-gray"
                >
                  Renomear
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Excluir a categoria "${cat.nome}"${
                          cat.subcategorias.length
                            ? " e suas subcategorias"
                            : ""
                        }? As operações existentes são mantidas.`
                      )
                    ) {
                      deleteCategoria.mutate(cat.id);
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

        {cat.subcategorias.length > 0 && (
          <ul className="mt-3 space-y-1 border-l pl-3">
            {cat.subcategorias.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between text-sm">
                <span className="text-brand-gray">{sub.nome}</span>
                <button
                  onClick={() => {
                    if (confirm(`Excluir a subcategoria "${sub.nome}"?`)) {
                      deleteCategoria.mutate(sub.id);
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const nome = subInputs[cat.id]?.trim();
            if (nome) createSub.mutate({ parent: cat.id, nome });
          }}
        >
          <input
            value={subInputs[cat.id] ?? ""}
            maxLength={100}
            placeholder="Nova subcategoria"
            onChange={(e) =>
              setSubInputs((prev) => ({ ...prev, [cat.id]: e.target.value }))
            }
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-brand-gray-border px-3 py-1 text-xs text-brand-gray hover:bg-brand-gray-light"
          >
            + Subcategoria
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-semibold text-brand-gray">Categorias</h2>
      <p className="mb-6 text-sm text-brand-gray-muted">
        Gerencie suas categorias e subcategorias de operação. Excluir mantém as
        operações já lançadas (exclusão suave).
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (novoNome.trim()) createCategoria.mutate();
        }}
        className="mb-6 rounded-lg border bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <FieldLabel htmlFor="cat-nome" label="Nova categoria" />
            <input
              id="cat-nome"
              value={novoNome}
              maxLength={100}
              placeholder="Ex.: Ferramentas"
              onChange={(e) => setNovoNome(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <FieldLabel htmlFor="cat-tipo" label="Tipo" />
            <select
              id="cat-tipo"
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as TipoOperacao)}
              className="w-full rounded border px-3 py-2"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {tipoPluralLabels[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createCategoria.isPending}
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
      ) : (
        <div className="space-y-8">
          {grupos.map(({ tipo, itens }) => (
            <section key={tipo}>
              <h3 className={`mb-3 text-lg font-semibold ${tipoHeaderStyles[tipo]}`}>
                {tipoPluralLabels[tipo]}
              </h3>
              {itens.length === 0 ? (
                <p className="text-sm text-brand-gray-muted">Nenhuma categoria deste tipo.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {itens.map(renderCategoriaCard)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
