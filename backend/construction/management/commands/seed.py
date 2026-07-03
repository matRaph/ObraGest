from datetime import date
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from construction.models import Categoria, Obra, ObraStatus, Operacao, TipoOperacao

OBRAS = [
    {
        "nome": "Residencial Solar",
        "cidade": "São Paulo",
        "status": ObraStatus.EM_ANDAMENTO,
        "data_inicio": date(2026, 1, 15),
        "descricao": "Obra residencial de 120 m².",
    },
    {
        "nome": "Comercial Centro",
        "cidade": "Campinas",
        "status": ObraStatus.PLANEJADA,
        "data_inicio": date(2026, 3, 1),
        "descricao": "Reforma de loja no centro.",
    },
]

SUBCATEGORIAS = [
    ("Material", TipoOperacao.DESPESA, "Cimento"),
    ("Material", TipoOperacao.DESPESA, "Aço"),
    ("Mão de obra", TipoOperacao.DESPESA, "Pedreiro"),
]

# obra_nome, categoria, subcategoria|None, valor, data, pago, descricao
OPERACOES = [
    (
        "Residencial Solar",
        "Recebimento de cliente",
        None,
        "80000.00",
        date(2026, 6, 1),
        True,
        "Entrada do cliente",
    ),
    (
        "Residencial Solar",
        "Material",
        "Cimento",
        "3500.00",
        date(2026, 6, 5),
        True,
        "50 sacos de cimento",
    ),
    (
        "Residencial Solar",
        "Material",
        "Aço",
        "12000.00",
        date(2026, 6, 10),
        False,
        "Estrutura metálica — a pagar",
    ),
    (
        "Residencial Solar",
        "Mão de obra",
        "Pedreiro",
        "4500.00",
        date(2026, 6, 12),
        True,
        "Semana de alvenaria",
    ),
    (
        "Residencial Solar",
        "Aquisição de equipamento",
        None,
        "18000.00",
        date(2026, 6, 15),
        True,
        "Betoneira e andaimes",
    ),
    (
        "Comercial Centro",
        "Adiantamento",
        None,
        "15000.00",
        date(2026, 5, 20),
        True,
        "Adiantamento do contrato",
    ),
    (
        "Comercial Centro",
        "Administrativo",
        None,
        "800.00",
        date(2026, 5, 25),
        False,
        "Projeto arquitetônico — pendente",
    ),
]


class Command(BaseCommand):
    help = "Popula o banco com categorias padrão e dados de exemplo (idempotente)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--only-categories",
            action="store_true",
            help="Cria apenas as categorias padrão, sem obras/operações.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_categories")

        if options["only_categories"]:
            self.stdout.write(self.style.SUCCESS("Seed concluído (apenas categorias)."))
            return

        obras_criadas = self._seed_obras()
        subs_criadas = self._seed_subcategorias()
        ops_criadas = self._seed_operacoes()

        self.stdout.write(
            self.style.SUCCESS(
                "Seed concluído: "
                f"{obras_criadas} obra(s), "
                f"{subs_criadas} subcategoria(s), "
                f"{ops_criadas} operação(ões) criadas."
            )
        )

    def _seed_obras(self) -> int:
        created = 0
        for dados in OBRAS:
            _, was_created = Obra.objects.get_or_create(
                nome=dados["nome"],
                cidade=dados["cidade"],
                defaults={
                    "status": dados["status"],
                    "data_inicio": dados["data_inicio"],
                    "descricao": dados["descricao"],
                },
            )
            if was_created:
                created += 1
        return created

    def _seed_subcategorias(self) -> int:
        created = 0
        for cat_nome, tipo, sub_nome in SUBCATEGORIAS:
            parent = Categoria.objects.filter(
                nome=cat_nome, tipo=tipo, parent__isnull=True, ativa=True
            ).first()
            if not parent:
                continue
            _, was_created = Categoria.objects.get_or_create(
                nome=sub_nome,
                tipo=tipo,
                parent=parent,
                defaults={"ativa": True},
            )
            if was_created:
                created += 1
        return created

    def _get_categoria(self, nome: str, tipo: str | None = None) -> Categoria | None:
        qs = Categoria.objects.filter(nome=nome, parent__isnull=True, ativa=True)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs.first()

    def _get_subcategoria(self, parent: Categoria, nome: str) -> Categoria | None:
        return Categoria.objects.filter(
            nome=nome, parent=parent, ativa=True
        ).first()

    def _seed_operacoes(self) -> int:
        created = 0
        for (
            obra_nome,
            cat_nome,
            sub_nome,
            valor,
            data,
            pago,
            descricao,
        ) in OPERACOES:
            obra = Obra.objects.filter(nome=obra_nome).first()
            if not obra or obra.operacoes.filter(descricao=descricao).exists():
                continue

            categoria = self._get_categoria(cat_nome)
            if not categoria:
                continue

            subcategoria = None
            if sub_nome:
                subcategoria = self._get_subcategoria(categoria, sub_nome)

            Operacao.objects.create(
                obra=obra,
                categoria=categoria,
                subcategoria=subcategoria,
                valor=Decimal(valor),
                data=data,
                pago=pago,
                descricao=descricao,
            )
            created += 1
        return created
