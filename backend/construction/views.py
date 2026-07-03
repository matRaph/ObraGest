from decimal import Decimal
import zipfile

from django.db.models import Case, DecimalField, F, IntegerField, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Categoria, Obra, Operacao, TipoOperacao
from .serializers import (
    CategoriaSerializer,
    ExtratoItemSerializer,
    ObraDetailSerializer,
    ObraListSerializer,
    OperacaoSerializer,
)
from .services.backup import (
    build_backup_archive,
    create_backup,
    list_backups,
    restore_backup,
    restore_backup_file,
)


class CategoriaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        return (
            Categoria.objects.filter(ativa=True)
            .annotate(
                tipo_order=Case(
                    When(tipo=TipoOperacao.DESPESA, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            .order_by("tipo_order", "nome")
        )


class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()

    def get_queryset(self):
        qs = Obra.objects.annotate(
            total_receitas=Coalesce(
                Sum(
                    Case(
                        When(operacoes__tipo=TipoOperacao.RECEITA, then=F("operacoes__valor")),
                        default=Value(0),
                        output_field=DecimalField(),
                    )
                ),
                Value(Decimal("0")),
            ),
            total_despesas=Coalesce(
                Sum(
                    Case(
                        When(operacoes__tipo=TipoOperacao.DESPESA, then=F("operacoes__valor")),
                        default=Value(0),
                        output_field=DecimalField(),
                    )
                ),
                Value(Decimal("0")),
            ),
        ).annotate(
            saldo=F("total_receitas") - F("total_despesas"),
        )

        cidade = self.request.query_params.get("cidade")
        status_filter = self.request.query_params.get("status")
        ordering = self.request.query_params.get("ordering", "-criado_em")

        if cidade:
            qs = qs.filter(cidade__icontains=cidade)
        if status_filter:
            qs = qs.filter(status=status_filter)

        allowed_orderings = {
            "nome": "nome",
            "-nome": "-nome",
            "cidade": "cidade",
            "-cidade": "-cidade",
            "saldo": "saldo",
            "-saldo": "-saldo",
            "criado_em": "criado_em",
            "-criado_em": "-criado_em",
        }
        return qs.order_by(allowed_orderings.get(ordering, "-criado_em"))

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ObraDetailSerializer
        return ObraListSerializer

    @action(detail=False, methods=["get"])
    def cidades(self, request):
        cidades = (
            Obra.objects.values_list("cidade", flat=True)
            .distinct()
            .order_by("cidade")
        )
        return Response(list(cidades))

    @action(detail=True, methods=["get", "post"])
    def operacoes(self, request, pk=None):
        obra = self.get_object()

        if request.method == "GET":
            qs = obra.operacoes.select_related("categoria")
            tipo = request.query_params.get("tipo")
            categoria = request.query_params.get("categoria")
            data_inicio = request.query_params.get("data_inicio")
            data_fim = request.query_params.get("data_fim")
            ordering = request.query_params.get("ordering", "-data")

            if tipo:
                qs = qs.filter(tipo=tipo)
            if categoria:
                qs = qs.filter(categoria_id=categoria)
            if data_inicio:
                qs = qs.filter(data__gte=data_inicio)
            if data_fim:
                qs = qs.filter(data__lte=data_fim)

            allowed = {"data": "data", "-data": "-data", "valor": "valor", "-valor": "-valor"}
            qs = qs.order_by(allowed.get(ordering, "-data"))

            page = self.paginate_queryset(qs)
            serializer = OperacaoSerializer(page or qs, many=True)
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data)

        serializer = OperacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(obra=obra)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def extrato(self, request, pk=None):
        obra = self.get_object()
        operacoes = obra.operacoes.select_related("categoria").order_by("data", "criado_em")

        data_inicio = request.query_params.get("data_inicio")
        data_fim = request.query_params.get("data_fim")
        if data_inicio:
            operacoes = operacoes.filter(data__gte=data_inicio)
        if data_fim:
            operacoes = operacoes.filter(data__lte=data_fim)

        saldo = Decimal("0")
        items = []
        for op in operacoes:
            if op.tipo == TipoOperacao.RECEITA:
                saldo += op.valor
            else:
                saldo -= op.valor
            items.append(
                {
                    "id": op.id,
                    "data": op.data,
                    "descricao": op.descricao,
                    "categoria_nome": op.categoria.nome,
                    "tipo": op.tipo,
                    "valor": op.valor,
                    "saldo_acumulado": saldo,
                }
            )

        serializer = ExtratoItemSerializer(items, many=True)
        return Response(serializer.data)


class OperacaoViewSet(viewsets.ModelViewSet):
    queryset = Operacao.objects.select_related("categoria", "obra")
    serializer_class = OperacaoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        obra_id = self.request.query_params.get("obra")
        if obra_id:
            qs = qs.filter(obra_id=obra_id)
        return qs


class DashboardView(APIView):
    def get(self, request):
        data_inicio = request.query_params.get("data_inicio")
        data_fim = request.query_params.get("data_fim")

        operacoes = Operacao.objects.select_related("obra", "categoria")
        if data_inicio:
            operacoes = operacoes.filter(data__gte=data_inicio)
        if data_fim:
            operacoes = operacoes.filter(data__lte=data_fim)

        total_receitas = Decimal("0")
        total_despesas = Decimal("0")
        por_obra: dict = {}
        por_cidade: dict = {}
        por_categoria: dict = {}

        for op in operacoes:
            if op.tipo == TipoOperacao.RECEITA:
                total_receitas += op.valor
                delta = op.valor
            else:
                total_despesas += op.valor
                delta = -op.valor

            obra_key = str(op.obra_id)
            if obra_key not in por_obra:
                por_obra[obra_key] = {
                    "obra_id": op.obra_id,
                    "nome": op.obra.nome,
                    "cidade": op.obra.cidade,
                    "receitas": Decimal("0"),
                    "despesas": Decimal("0"),
                    "saldo": Decimal("0"),
                }
            if op.tipo == TipoOperacao.RECEITA:
                por_obra[obra_key]["receitas"] += op.valor
            else:
                por_obra[obra_key]["despesas"] += op.valor
            por_obra[obra_key]["saldo"] += delta

            cidade = op.obra.cidade
            if cidade not in por_cidade:
                por_cidade[cidade] = {
                    "cidade": cidade,
                    "receitas": Decimal("0"),
                    "despesas": Decimal("0"),
                    "saldo": Decimal("0"),
                }
            if op.tipo == TipoOperacao.RECEITA:
                por_cidade[cidade]["receitas"] += op.valor
            else:
                por_cidade[cidade]["despesas"] += op.valor
            por_cidade[cidade]["saldo"] += delta

            cat_key = str(op.categoria_id)
            if cat_key not in por_categoria:
                por_categoria[cat_key] = {
                    "categoria_id": op.categoria_id,
                    "nome": op.categoria.nome,
                    "tipo": op.categoria.tipo,
                    "total": Decimal("0"),
                }
            por_categoria[cat_key]["total"] += op.valor

        return Response(
            {
                "total_receitas": total_receitas,
                "total_despesas": total_despesas,
                "saldo": total_receitas - total_despesas,
                "por_obra": list(por_obra.values()),
                "por_cidade": list(por_cidade.values()),
                "por_categoria": sorted(
                    por_categoria.values(),
                    key=lambda x: (0 if x["tipo"] == TipoOperacao.DESPESA else 1, x["nome"]),
                ),
            }
        )


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class BackupDownloadView(APIView):
    def get(self, request):
        filename, buffer = build_backup_archive()
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=filename,
            content_type="application/zip",
        )


class BackupView(APIView):
    def get(self, request):
        return Response({"backups": list_backups()})

    def post(self, request):
        destino = request.data.get("destino")
        backup_path = create_backup(destino=destino)
        return Response(
            {"message": "Backup criado com sucesso.", "path": str(backup_path)},
            status=status.HTTP_201_CREATED,
        )


class RestoreBackupView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if uploaded:
            if not uploaded.name.lower().endswith(".zip"):
                return Response(
                    {"error": "Envie um arquivo .zip de backup."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                restore_backup_file(uploaded)
            except (ValueError, zipfile.BadZipFile) as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"message": "Backup restaurado com sucesso."})

        backup_path = request.data.get("path")
        if not backup_path:
            return Response(
                {"error": "Envie um arquivo .zip ou informe o caminho em 'path'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            restore_backup(backup_path)
        except FileNotFoundError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Backup restaurado com sucesso."})
