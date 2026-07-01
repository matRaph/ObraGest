from decimal import Decimal

from rest_framework import serializers

from .models import Categoria, Obra, Operacao, TipoOperacao


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nome", "tipo", "padrao", "ativa"]


class ObraListSerializer(serializers.ModelSerializer):
    total_receitas = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    total_despesas = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    saldo = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Obra
        fields = [
            "id",
            "nome",
            "cidade",
            "status",
            "data_inicio",
            "descricao",
            "criado_em",
            "total_receitas",
            "total_despesas",
            "saldo",
        ]


class ObraDetailSerializer(serializers.ModelSerializer):
    total_receitas = serializers.SerializerMethodField()
    total_despesas = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = Obra
        fields = [
            "id",
            "nome",
            "cidade",
            "status",
            "data_inicio",
            "descricao",
            "criado_em",
            "total_receitas",
            "total_despesas",
            "saldo",
        ]

    def _totals(self, obj: Obra) -> tuple[Decimal, Decimal]:
        receitas = Decimal("0")
        despesas = Decimal("0")
        for op in obj.operacoes.all():
            if op.tipo == TipoOperacao.RECEITA:
                receitas += op.valor
            else:
                despesas += op.valor
        return receitas, despesas

    def get_total_receitas(self, obj: Obra) -> Decimal:
        receitas, _ = self._totals(obj)
        return receitas

    def get_total_despesas(self, obj: Obra) -> Decimal:
        _, despesas = self._totals(obj)
        return despesas

    def get_saldo(self, obj: Obra) -> Decimal:
        receitas, despesas = self._totals(obj)
        return receitas - despesas


class OperacaoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)

    class Meta:
        model = Operacao
        fields = [
            "id",
            "obra",
            "categoria",
            "categoria_nome",
            "valor",
            "data",
            "tipo",
            "descricao",
            "criado_em",
        ]
        read_only_fields = ["tipo", "obra"]

    def validate_categoria(self, categoria: Categoria) -> Categoria:
        if not categoria.ativa:
            raise serializers.ValidationError("Categoria inativa.")
        return categoria


class ExtratoItemSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    data = serializers.DateField()
    descricao = serializers.CharField()
    categoria_nome = serializers.CharField()
    tipo = serializers.CharField()
    valor = serializers.DecimalField(max_digits=12, decimal_places=2)
    saldo_acumulado = serializers.DecimalField(max_digits=12, decimal_places=2)
