import CityInput from "./CityInput";
import FieldLabel from "./FieldLabel";
import { DESCRICAO_MAX_LENGTH, limitText, NOME_MAX_LENGTH } from "../constants/limits";
import { statusLabels } from "../api/client";
import type { ObraStatus } from "../types";

const statusOptions: ObraStatus[] = ["planejada", "em_andamento", "concluida", "pausada"];

export interface ObraFormData {
  nome: string;
  cidade: string;
  status: ObraStatus;
  data_inicio: string;
  descricao: string;
}

interface ObraFormProps {
  form: ObraFormData;
  onChange: (form: ObraFormData) => void;
  cities: string[];
  onSubmit: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  submitLabel?: string;
}

export default function ObraForm({
  form,
  onChange,
  cities,
  onSubmit,
  onCancel,
  isPending = false,
  submitLabel = "Salvar obra",
}: ObraFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-lg border bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="obra-nome" label="Nome da obra" />
          <input
            id="obra-nome"
            required
            maxLength={NOME_MAX_LENGTH}
            placeholder="Ex.: Residencial Solar"
            value={form.nome}
            onChange={(e) => onChange({ ...form, nome: limitText(e.target.value, NOME_MAX_LENGTH) })}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <FieldLabel htmlFor="obra-cidade" label="Cidade" />
          <CityInput
            id="obra-cidade"
            required
            value={form.cidade}
            onChange={(cidade) => onChange({ ...form, cidade })}
            cities={cities}
            placeholder="Ex.: São Paulo"
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <FieldLabel htmlFor="obra-status" label="Status" />
          <select
            id="obra-status"
            required
            value={form.status}
            onChange={(e) => onChange({ ...form, status: e.target.value as ObraStatus })}
            className="w-full rounded border px-3 py-2"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="obra-data-inicio" label="Data de início" optional />
          <input
            id="obra-data-inicio"
            type="date"
            value={form.data_inicio}
            onChange={(e) => onChange({ ...form, data_inicio: e.target.value })}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div className="col-span-full">
          <FieldLabel htmlFor="obra-descricao" label="Descrição" optional />
          <textarea
            id="obra-descricao"
            maxLength={DESCRICAO_MAX_LENGTH}
            placeholder="Detalhes, endereço, responsável..."
            value={form.descricao}
            onChange={(e) =>
              onChange({ ...form, descricao: limitText(e.target.value, DESCRICAO_MAX_LENGTH) })
            }
            className="w-full rounded border px-3 py-2"
            rows={2}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export const emptyObraForm: ObraFormData = {
  nome: "",
  cidade: "",
  status: "planejada",
  data_inicio: "",
  descricao: "",
};

export function obraToForm(obra: {
  nome: string;
  cidade: string;
  status: ObraStatus;
  data_inicio: string | null;
  descricao: string;
}): ObraFormData {
  return {
    nome: obra.nome,
    cidade: obra.cidade,
    status: obra.status,
    data_inicio: obra.data_inicio ?? "",
    descricao: obra.descricao,
  };
}
