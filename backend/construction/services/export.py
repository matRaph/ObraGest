import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone

from ..models import Obra, ObraStatus, Operacao, TipoOperacao
from ..serializers import _obra_totais
from .dashboard import compute_dashboard_data

STATUS_LABELS = {
    ObraStatus.PLANEJADA: "Planejada",
    ObraStatus.EM_ANDAMENTO: "Em andamento",
    ObraStatus.CONCLUIDA: "Concluída",
    ObraStatus.PAUSADA: "Pausada",
}

TIPO_LABELS = {
    TipoOperacao.DESPESA: "Despesa",
    TipoOperacao.RECEITA: "Receita",
    TipoOperacao.INVESTIMENTO: "Investimento",
}


def _format_valor_csv(valor: Decimal | str | int | float) -> str:
    n = Decimal(str(valor))
    return f"{n:.2f}".replace(".", ",")


def _format_data_br(value: date | str | None) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        value = date.fromisoformat(value[:10])
    return value.strftime("%d/%m/%Y")


def _format_quantidade(value: Decimal | None) -> str:
    if value is None:
        return ""
    normalized = value.normalize()
    if normalized == normalized.to_integral_value():
        return str(int(normalized))
    text = f"{normalized:f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


def _sanitize_filename_part(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9À-ú\s]", "", text).strip()


def _rows_to_csv_bytes(rows: list[list[str]]) -> bytes:
    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer, lineterminator="\r\n")
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue().encode("utf-8")


def csv_file_response(filename: str, content: bytes) -> HttpResponse:
    response = HttpResponse(content, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _tipo_operacao_label(op: Operacao) -> str:
    if op.contabiliza_como_devolucao_investimento:
        return "Devolução de investimento"
    if op.tipo == TipoOperacao.DESPESA and op.tambem_investimento:
        return "Despesa / Investimento"
    return TIPO_LABELS.get(op.tipo, op.tipo)


def build_obra_export(obra: Obra, operacoes: list[Operacao]) -> tuple[str, bytes]:
    totais = _obra_totais(obra)
    rows: list[list[str]] = []

    rows.append(["RELATÓRIO DA OBRA"])
    rows.append([])
    rows.append(["Nome", obra.nome])
    rows.append(["Cidade", obra.cidade])
    rows.append(["Status", STATUS_LABELS.get(obra.status, obra.status)])
    rows.append(["Início", _format_data_br(obra.data_inicio)])
    if obra.descricao:
        rows.append(["Descrição", obra.descricao])
    rows.append([])

    rows.append(["RESUMO FINANCEIRO"])
    rows.append(["Receitas", _format_valor_csv(totais["total_receitas"])])
    rows.append(["Despesas pagas", _format_valor_csv(totais["total_despesas"])])
    rows.append(
        ["Despesas não pagas", _format_valor_csv(totais["total_despesas_pendentes"])]
    )
    rows.append(["Investimentos", _format_valor_csv(totais["total_investimentos"])])
    rows.append(
        [
            "Devoluções de investimento",
            _format_valor_csv(totais["total_devolucoes_investimento"]),
        ]
    )
    rows.append(
        [
            "Devoluções pendentes",
            _format_valor_csv(totais["total_devolucoes_pendentes"]),
        ]
    )
    rows.append(["Saldo", _format_valor_csv(totais["saldo"])])
    rows.append([])

    rows.append(["OPERAÇÕES"])
    rows.append(
        [
            "Data",
            "Tipo",
            "Categoria",
            "Subcategoria",
            "Fornecedor",
            "Descrição",
            "Situação",
            "Qtd.",
            "Valor (R$)",
        ]
    )

    total_receitas = Decimal("0")
    total_despesas = Decimal("0")
    total_investimentos = Decimal("0")
    total_devolucoes = Decimal("0")

    for op in operacoes:
        if op.contabiliza_como_devolucao_investimento:
            total_devolucoes += op.valor
        elif op.tipo == TipoOperacao.RECEITA:
            total_receitas += op.valor
        elif op.tipo == TipoOperacao.INVESTIMENTO:
            total_investimentos += op.valor
        elif op.tipo == TipoOperacao.DESPESA:
            total_despesas += op.valor
            if op.tambem_investimento:
                total_investimentos += op.valor

        situacao = ""
        if op.tipo == TipoOperacao.DESPESA:
            situacao = "Paga" if op.pago else "Não paga"

        rows.append(
            [
                _format_data_br(op.data),
                _tipo_operacao_label(op),
                op.categoria.nome,
                op.subcategoria.nome if op.subcategoria_id else "",
                op.fornecedor.nome if op.fornecedor_id else "",
                op.descricao or "",
                situacao,
                _format_quantidade(op.quantidade),
                _format_valor_csv(op.valor),
            ]
        )

    rows.append([])
    rows.append(["TOTAIS DA LISTAGEM", "", "", "", "", "", "", "", ""])
    rows.append(
        ["Total receitas", "", "", "", "", "", "", "", _format_valor_csv(total_receitas)]
    )
    rows.append(
        ["Total despesas", "", "", "", "", "", "", "", _format_valor_csv(total_despesas)]
    )
    rows.append(
        [
            "Total investimentos",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            _format_valor_csv(total_investimentos),
        ]
    )
    rows.append(
        [
            "Total devoluções de investimento",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            _format_valor_csv(total_devolucoes),
        ]
    )

    hoje = timezone.localdate().isoformat()
    nome_sanitizado = _sanitize_filename_part(obra.nome)
    filename = f"ObraGest - {nome_sanitizado} - {hoje}.csv"
    return filename, _rows_to_csv_bytes(rows)


def build_dashboard_export(
    *,
    data_inicio: str | None,
    data_fim: str | None,
    obra_id: str | None = None,
    obra_nome: str | None = None,
) -> tuple[str, bytes]:
    data = compute_dashboard_data(
        data_inicio=data_inicio,
        data_fim=data_fim,
        obra_id=obra_id,
    )
    rows: list[list[str]] = []
    periodo = f"{_format_data_br(data_inicio)} a {_format_data_br(data_fim)}"

    rows.append(["RELATÓRIO DE DASHBOARD — OBRAGEST"])
    rows.append(["Gerado em", datetime.now().strftime("%d/%m/%Y %H:%M:%S")])
    rows.append(["Período", periodo])
    if obra_nome:
        rows.append(["Obra", obra_nome])
    rows.append([])

    rows.append(["RESUMO GERAL"])
    rows.append(["Receitas", _format_valor_csv(data["total_receitas"])])
    rows.append(["Despesas pagas", _format_valor_csv(data["total_despesas"])])
    rows.append(
        ["Despesas não pagas", _format_valor_csv(data["total_despesas_pendentes"])]
    )
    rows.append(["Investimentos", _format_valor_csv(data["total_investimentos"])])
    rows.append(
        [
            "Devoluções de investimento",
            _format_valor_csv(data["total_devolucoes_investimento"]),
        ]
    )
    rows.append(
        [
            "Devoluções pendentes",
            _format_valor_csv(data["total_devolucoes_pendentes"]),
        ]
    )
    rows.append(["Saldo", _format_valor_csv(data["saldo"])])
    rows.append([])

    rows.append(["DISTRIBUIÇÃO POR CATEGORIA"])
    rows.append(["Tipo", "Categoria", "Subcategoria", "Total (R$)"])
    for cat in data["por_categoria"]:
        rows.append(
            [
                TIPO_LABELS.get(cat["tipo"], cat["tipo"]),
                cat["nome"],
                "",
                _format_valor_csv(cat["total"]),
            ]
        )
        for sub in cat["subcategorias"]:
            if sub["subcategoria_id"]:
                rows.append(
                    [
                        "",
                        cat["nome"],
                        sub["nome"],
                        _format_valor_csv(sub["total"]),
                    ]
                )
    rows.append([])

    if data["por_obra"]:
        rows.append(["RESUMO POR OBRA"])
        rows.append(
            [
                "Obra",
                "Cidade",
                "Receitas (R$)",
                "Despesas (R$)",
                "Investimentos (R$)",
                "Saldo (R$)",
            ]
        )
        for obra in data["por_obra"]:
            rows.append(
                [
                    obra["nome"],
                    obra["cidade"],
                    _format_valor_csv(obra["receitas"]),
                    _format_valor_csv(obra["despesas"]),
                    _format_valor_csv(obra["investimentos"]),
                    _format_valor_csv(obra["saldo"]),
                ]
            )
        rows.append([])

    if data["por_cidade"]:
        rows.append(["RESUMO POR CIDADE"])
        rows.append(
            [
                "Cidade",
                "Receitas (R$)",
                "Despesas (R$)",
                "Investimentos (R$)",
                "Saldo (R$)",
            ]
        )
        for cidade in data["por_cidade"]:
            rows.append(
                [
                    cidade["cidade"],
                    _format_valor_csv(cidade["receitas"]),
                    _format_valor_csv(cidade["despesas"]),
                    _format_valor_csv(cidade["investimentos"]),
                    _format_valor_csv(cidade["saldo"]),
                ]
            )

    hoje = timezone.localdate().isoformat()
    nome_parte = f" - {_sanitize_filename_part(obra_nome)}" if obra_nome else ""
    filename = f"ObraGest - Dashboard{nome_parte} - {hoje}.csv"
    return filename, _rows_to_csv_bytes(rows)
