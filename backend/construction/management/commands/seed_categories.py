from django.core.management.base import BaseCommand
from django.db import transaction

from construction.models import Categoria, Operacao, TipoOperacao

CATEGORIAS_PADRAO = [
    ("Material", TipoOperacao.DESPESA),
    ("Mão de obra", TipoOperacao.DESPESA),
    ("Equipamento", TipoOperacao.DESPESA),
    ("Transporte", TipoOperacao.DESPESA),
    ("Administrativo", TipoOperacao.DESPESA),
    ("Recebimento de cliente", TipoOperacao.RECEITA),
    ("Adiantamento", TipoOperacao.RECEITA),
    ("Outros", TipoOperacao.DESPESA),
    ("Outros", TipoOperacao.RECEITA),
]

LEGACY_CATEGORIAS = [
    ("Outros (despesa)", TipoOperacao.DESPESA, "Outros"),
    ("Outros (receita)", TipoOperacao.RECEITA, "Outros"),
]


class Command(BaseCommand):
    help = "Cria categorias padrão do sistema"

    @transaction.atomic
    def handle(self, *args, **options):
        self._cleanup_legacy()
        created = self._seed_defaults()
        self.stdout.write(
            self.style.SUCCESS(f"Categorias padrão verificadas. {created} criada(s).")
        )

    def _cleanup_legacy(self) -> None:
        for old_nome, tipo, new_nome in LEGACY_CATEGORIAS:
            legacy = Categoria.objects.filter(nome=old_nome, tipo=tipo, padrao=True).first()
            if not legacy:
                continue

            target, _ = Categoria.objects.get_or_create(
                nome=new_nome,
                tipo=tipo,
                defaults={"padrao": True, "ativa": True},
            )
            Operacao.objects.filter(categoria=legacy).update(categoria=target)
            legacy.delete()
            self.stdout.write(f"  Migrada categoria legada: {old_nome} → {new_nome} ({tipo})")

    def _seed_defaults(self) -> int:
        created = 0
        for nome, tipo in CATEGORIAS_PADRAO:
            _, was_created = Categoria.objects.get_or_create(
                nome=nome,
                tipo=tipo,
                defaults={"padrao": True, "ativa": True},
            )
            if was_created:
                created += 1
        return created
