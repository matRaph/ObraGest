from decimal import Decimal

from ..models import Operacao, TipoOperacao


def compute_dashboard_data(
    *,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    obra_id: str | None = None,
) -> dict:
    operacoes = Operacao.objects.select_related("obra", "categoria", "subcategoria")
    if obra_id:
        operacoes = operacoes.filter(obra_id=obra_id)
    if data_inicio:
        operacoes = operacoes.filter(data__gte=data_inicio)
    if data_fim:
        operacoes = operacoes.filter(data__lte=data_fim)

    total_receitas = Decimal("0")
    total_despesas = Decimal("0")
    total_despesas_pendentes = Decimal("0")
    total_investimentos = Decimal("0")
    total_devolucoes_investimento = Decimal("0")
    total_devolucoes_pendentes = Decimal("0")
    por_obra: dict = {}
    por_cidade: dict = {}
    por_categoria: dict = {}

    def _delta(op) -> Decimal:
        if op.tipo == TipoOperacao.RECEITA:
            return op.valor
        if op.tipo == TipoOperacao.DESPESA and op.pago:
            return -op.valor
        return Decimal("0")

    def _somar_categoria(op, tipo_visao: str) -> None:
        cat_key = f"{op.categoria_id}:{tipo_visao}"
        if cat_key not in por_categoria:
            por_categoria[cat_key] = {
                "categoria_id": op.categoria_id,
                "nome": op.categoria.nome,
                "tipo": tipo_visao,
                "total": Decimal("0"),
                "_subs": {},
            }
        entry = por_categoria[cat_key]
        entry["total"] += op.valor

        sub_key = str(op.subcategoria_id) if op.subcategoria_id else "__none__"
        sub_nome = op.subcategoria.nome if op.subcategoria_id else "Sem subcategoria"
        if sub_key not in entry["_subs"]:
            entry["_subs"][sub_key] = {
                "subcategoria_id": op.subcategoria_id,
                "nome": sub_nome,
                "total": Decimal("0"),
            }
        entry["_subs"][sub_key]["total"] += op.valor

    for op in operacoes:
        if op.contabiliza_como_devolucao_investimento:
            total_devolucoes_investimento += op.valor
            if not op.pago:
                total_devolucoes_pendentes += op.valor
            continue

        delta = _delta(op)
        if op.tipo == TipoOperacao.RECEITA:
            total_receitas += op.valor
        elif op.tipo == TipoOperacao.DESPESA:
            if op.pago:
                total_despesas += op.valor
            else:
                total_despesas_pendentes += op.valor
        if op.contabiliza_como_investimento:
            total_investimentos += op.valor

        obra_key = str(op.obra_id)
        if obra_key not in por_obra:
            por_obra[obra_key] = {
                "obra_id": op.obra_id,
                "nome": op.obra.nome,
                "cidade": op.obra.cidade,
                "receitas": Decimal("0"),
                "despesas": Decimal("0"),
                "investimentos": Decimal("0"),
                "saldo": Decimal("0"),
            }
        cidade = op.obra.cidade
        if cidade not in por_cidade:
            por_cidade[cidade] = {
                "cidade": cidade,
                "receitas": Decimal("0"),
                "despesas": Decimal("0"),
                "investimentos": Decimal("0"),
                "saldo": Decimal("0"),
            }

        for bucket in (por_obra[obra_key], por_cidade[cidade]):
            if op.tipo == TipoOperacao.RECEITA:
                bucket["receitas"] += op.valor
            elif op.tipo == TipoOperacao.DESPESA and op.pago:
                bucket["despesas"] += op.valor
            if op.contabiliza_como_investimento:
                bucket["investimentos"] += op.valor
            bucket["saldo"] += delta

        _somar_categoria(op, op.tipo)
        if op.tipo == TipoOperacao.DESPESA and op.tambem_investimento and op.pago:
            _somar_categoria(op, TipoOperacao.INVESTIMENTO)

    categorias = []
    for entry in sorted(
        por_categoria.values(),
        key=lambda x: (
            {TipoOperacao.DESPESA: 0, TipoOperacao.RECEITA: 1}.get(x["tipo"], 2),
            x["nome"],
        ),
    ):
        subs = sorted(
            entry.pop("_subs").values(),
            key=lambda s: s["total"],
            reverse=True,
        )
        entry["subcategorias"] = subs
        categorias.append(entry)

    return {
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "total_despesas_pendentes": total_despesas_pendentes,
        "total_investimentos": total_investimentos,
        "total_devolucoes_investimento": total_devolucoes_investimento,
        "total_devolucoes_pendentes": total_devolucoes_pendentes,
        "saldo": total_receitas - total_despesas,
        "por_obra": list(por_obra.values()),
        "por_cidade": list(por_cidade.values()),
        "por_categoria": categorias,
    }
