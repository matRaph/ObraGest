import uuid

from django.db import models
from django.db.models import Q


from .constants import DESCRICAO_MAX_LENGTH, NOME_MAX_LENGTH


class ObraStatus(models.TextChoices):
    PLANEJADA = "planejada", "Planejada"
    EM_ANDAMENTO = "em_andamento", "Em andamento"
    CONCLUIDA = "concluida", "Concluída"
    PAUSADA = "pausada", "Pausada"


class TipoOperacao(models.TextChoices):
    RECEITA = "receita", "Receita"
    DESPESA = "despesa", "Despesa"
    INVESTIMENTO = "investimento", "Investimento"


class Obra(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=NOME_MAX_LENGTH)
    cidade = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=ObraStatus.choices,
        default=ObraStatus.PLANEJADA,
    )
    data_inicio = models.DateField(null=True, blank=True)
    descricao = models.TextField(blank=True, max_length=DESCRICAO_MAX_LENGTH)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self) -> str:
        return self.nome


class Categoria(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100)
    tipo = models.CharField(max_length=12, choices=TipoOperacao.choices)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="subcategorias",
        null=True,
        blank=True,
    )
    padrao = models.BooleanField(default=False)
    ativa = models.BooleanField(default=True)

    class Meta:
        ordering = ["nome"]
        verbose_name_plural = "categorias"
        constraints = [
            models.UniqueConstraint(
                fields=["nome", "tipo"],
                condition=Q(parent__isnull=True, ativa=True),
                name="unique_categoria_top_ativa",
            ),
            models.UniqueConstraint(
                fields=["nome", "tipo", "parent"],
                condition=Q(parent__isnull=False, ativa=True),
                name="unique_categoria_sub_ativa",
            ),
        ]

    @property
    def is_subcategoria(self) -> bool:
        return self.parent_id is not None

    def __str__(self) -> str:
        if self.parent_id:
            return f"{self.parent.nome} › {self.nome}"
        return self.nome


class Operacao(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    obra = models.ForeignKey(Obra, on_delete=models.CASCADE, related_name="operacoes")
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="operacoes"
    )
    subcategoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="operacoes_subcategoria",
        null=True,
        blank=True,
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data = models.DateField()
    tipo = models.CharField(max_length=12, choices=TipoOperacao.choices)
    pago = models.BooleanField(default=True)
    descricao = models.TextField(blank=True, max_length=DESCRICAO_MAX_LENGTH)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-criado_em"]
        verbose_name_plural = "operações"

    def save(self, *args, **kwargs):
        self.tipo = self.categoria.tipo
        if self.tipo != TipoOperacao.DESPESA:
            self.pago = True
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.obra.nome} - {self.valor}"
