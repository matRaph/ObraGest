from django.core.management.base import BaseCommand

from construction.models import Categoria, TipoOperacao


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


class Command(BaseCommand):
    help = "Cria categorias padrão do sistema"

    def handle(self, *args, **options):
        created = 0
        for nome, tipo in CATEGORIAS_PADRAO:
            _, was_created = Categoria.objects.get_or_create(
                nome=nome,
                defaults={"tipo": tipo, "padrao": True, "ativa": True},
            )
            if was_created:
                created += 1
        self.stdout.write(
            self.style.SUCCESS(f"Categorias padrão verificadas. {created} criada(s).")
        )
