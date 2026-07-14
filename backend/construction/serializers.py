from decimal import Decimal

from rest_framework import serializers

from .constants import DESCRICAO_MAX_LENGTH, NOME_MAX_LENGTH
from .models import Categoria, Fornecedor, Obra, Operacao, TipoOperacao


class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = ["id", "nome", "ativa"]
        validators = []

    def validate(self, attrs):
        nome = attrs.get("nome", getattr(self.instance, "nome", None))
        duplicados = Fornecedor.objects.filter(nome=nome, ativa=True)
        if self.instance is not None:
            duplicados = duplicados.exclude(pk=self.instance.pk)
        if duplicados.exists():
            raise serializers.ValidationError(
                {"nome": "Já existe um fornecedor ativo com esse nome."}
            )
        return attrs


class SubcategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nome", "tipo", "parent", "padrao", "ativa"]
        read_only_fields = ["tipo", "padrao"]


class CategoriaSerializer(serializers.ModelSerializer):
    subcategorias = serializers.SerializerMethodField()
    tipo = serializers.ChoiceField(choices=TipoOperacao.choices, required=False)

    class Meta:
        model = Categoria
        fields = ["id", "nome", "tipo", "parent", "padrao", "ativa", "subcategorias"]
        read_only_fields = ["padrao"]
        # As constraints de unicidade são condicionais (apenas categorias ativas),
        # então validamos manualmente em vez de usar o UniqueTogetherValidator do DRF.
        validators = []

    def get_subcategorias(self, obj: Categoria) -> list:
        subs = [s for s in obj.subcategorias.all() if s.ativa]
        subs.sort(key=lambda s: s.nome)
        return SubcategoriaSerializer(subs, many=True).data

    def validate(self, attrs):
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        nome = attrs.get("nome", getattr(self.instance, "nome", None))

        if parent is not None:
            if parent.parent_id is not None:
                raise serializers.ValidationError(
                    {"parent": "Subcategorias não podem ter subcategorias."}
                )
            tipo = parent.tipo
            attrs["tipo"] = tipo
        else:
            tipo = attrs.get("tipo", getattr(self.instance, "tipo", None))
            if self.instance is None and not tipo:
                raise serializers.ValidationError(
                    {"tipo": "Informe o tipo da categoria."}
                )

        duplicadas = Categoria.objects.filter(
            nome=nome, tipo=tipo, parent=parent, ativa=True
        )
        if self.instance is not None:
            duplicadas = duplicadas.exclude(pk=self.instance.pk)
        if duplicadas.exists():
            raise serializers.ValidationError(
                {"nome": "Já existe uma categoria ativa com esse nome."}
            )
        return attrs


def _obra_totais(obra: Obra) -> dict:
    receitas = Decimal("0")
    despesas_pagas = Decimal("0")
    despesas_pendentes = Decimal("0")
    investimentos = Decimal("0")

    for op in obra.operacoes.all():
        if op.tipo == TipoOperacao.RECEITA:
            receitas += op.valor
        elif op.tipo == TipoOperacao.DESPESA:
            if op.pago:
                despesas_pagas += op.valor
            else:
                despesas_pendentes += op.valor
        elif op.tipo == TipoOperacao.INVESTIMENTO:
            investimentos += op.valor

    return {
        "total_receitas": receitas,
        "total_despesas": despesas_pagas,
        "total_despesas_pendentes": despesas_pendentes,
        "total_investimentos": investimentos,
        "saldo": receitas - despesas_pagas,
    }


class _ObraTotaisMixin(serializers.ModelSerializer):
    total_receitas = serializers.SerializerMethodField()
    total_despesas = serializers.SerializerMethodField()
    total_despesas_pendentes = serializers.SerializerMethodField()
    total_investimentos = serializers.SerializerMethodField()
    saldo = serializers.SerializerMethodField()
    data_primeira_operacao = serializers.SerializerMethodField()

    def _cached_totais(self, obj: Obra) -> dict:
        cache = getattr(obj, "_totais_cache", None)
        if cache is None:
            cache = _obra_totais(obj)
            obj._totais_cache = cache
        return cache

    def get_total_receitas(self, obj: Obra) -> Decimal:
        return self._cached_totais(obj)["total_receitas"]

    def get_total_despesas(self, obj: Obra) -> Decimal:
        return self._cached_totais(obj)["total_despesas"]

    def get_total_despesas_pendentes(self, obj: Obra) -> Decimal:
        return self._cached_totais(obj)["total_despesas_pendentes"]

    def get_total_investimentos(self, obj: Obra) -> Decimal:
        return self._cached_totais(obj)["total_investimentos"]

    def get_saldo(self, obj: Obra) -> Decimal:
        return self._cached_totais(obj)["saldo"]

    def get_data_primeira_operacao(self, obj: Obra):
        primeira = (
            obj.operacoes.order_by("data", "criado_em")
            .values_list("data", flat=True)
            .first()
        )
        return primeira


class ObraListSerializer(_ObraTotaisMixin):
    nome = serializers.CharField(max_length=NOME_MAX_LENGTH)
    descricao = serializers.CharField(
        max_length=DESCRICAO_MAX_LENGTH, required=False, allow_blank=True
    )

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
            "total_despesas_pendentes",
            "total_investimentos",
            "saldo",
            "data_primeira_operacao",
        ]


class ObraDetailSerializer(_ObraTotaisMixin):
    nome = serializers.CharField(max_length=NOME_MAX_LENGTH)
    descricao = serializers.CharField(
        max_length=DESCRICAO_MAX_LENGTH, required=False, allow_blank=True
    )

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
            "total_despesas_pendentes",
            "total_investimentos",
            "saldo",
            "data_primeira_operacao",
        ]


class OperacaoSerializer(serializers.ModelSerializer):
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True)
    subcategoria_nome = serializers.CharField(
        source="subcategoria.nome", read_only=True, default=None
    )
    fornecedor_nome = serializers.CharField(
        source="fornecedor.nome", read_only=True, default=None
    )
    descricao = serializers.CharField(
        max_length=DESCRICAO_MAX_LENGTH, required=False, allow_blank=True
    )

    class Meta:
        model = Operacao
        fields = [
            "id",
            "obra",
            "categoria",
            "categoria_nome",
            "subcategoria",
            "subcategoria_nome",
            "fornecedor",
            "fornecedor_nome",
            "valor",
            "quantidade",
            "data",
            "tipo",
            "pago",
            "descricao",
            "criado_em",
        ]
        read_only_fields = ["tipo", "obra"]

    def validate_categoria(self, categoria: Categoria) -> Categoria:
        if not categoria.ativa:
            raise serializers.ValidationError("Categoria inativa.")
        if categoria.parent_id is not None:
            raise serializers.ValidationError(
                "Selecione uma categoria principal, não uma subcategoria."
            )
        return categoria

    def validate_fornecedor(self, fornecedor: Fornecedor | None) -> Fornecedor | None:
        if fornecedor is not None and not fornecedor.ativa:
            raise serializers.ValidationError("Fornecedor inativo.")
        return fornecedor

    def validate(self, attrs):
        categoria = attrs.get("categoria", getattr(self.instance, "categoria", None))
        subcategoria = attrs.get(
            "subcategoria", getattr(self.instance, "subcategoria", None)
        )
        if subcategoria is not None:
            if not subcategoria.ativa:
                raise serializers.ValidationError(
                    {"subcategoria": "Subcategoria inativa."}
                )
            if categoria is None or subcategoria.parent_id != categoria.id:
                raise serializers.ValidationError(
                    {"subcategoria": "A subcategoria não pertence à categoria escolhida."}
                )
        return attrs
