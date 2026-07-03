import uuid

from django.db import models


from .constants import DESCRICAO_MAX_LENGTH, NOME_MAX_LENGTH


class ObraStatus(models.TextChoices):
    PLANEJADA = "planejada", "Planejada"
    EM_ANDAMENTO = "em_andamento", "Em andamento"
    CONCLUIDA = "concluida", "Concluída"
    PAUSADA = "pausada", "Pausada"


class TipoOperacao(models.TextChoices):
    RECEITA = "receita", "Receita"
    DESPESA = "despesa", "Despesa"


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
    tipo = models.CharField(max_length=10, choices=TipoOperacao.choices)
    padrao = models.BooleanField(default=False)
    ativa = models.BooleanField(default=True)

    class Meta:
        ordering = ["nome"]
        verbose_name_plural = "categorias"
        constraints = [
            models.UniqueConstraint(fields=["nome", "tipo"], name="unique_categoria_nome_tipo"),
        ]

    def __str__(self) -> str:
        return self.nome


class Operacao(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    obra = models.ForeignKey(Obra, on_delete=models.CASCADE, related_name="operacoes")
    categoria = models.ForeignKey(
        Categoria, on_delete=models.PROTECT, related_name="operacoes"
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data = models.DateField()
    tipo = models.CharField(max_length=10, choices=TipoOperacao.choices)
    descricao = models.TextField(blank=True, max_length=DESCRICAO_MAX_LENGTH)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-data", "-criado_em"]
        verbose_name_plural = "operações"

    def save(self, *args, **kwargs):
        self.tipo = self.categoria.tipo
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.obra.nome} - {self.valor}"
