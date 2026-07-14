from decimal import Decimal
import logging
import zipfile

logger = logging.getLogger(__name__)

from django.db.models import (
    Case,
    DecimalField,
    F,
    IntegerField,
    Q,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.conf import settings
from django.http import FileResponse
from django.shortcuts import redirect
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Categoria, Fornecedor, Obra, Operacao, TipoOperacao
from .serializers import (
    CategoriaSerializer,
    FornecedorSerializer,
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
from .services import google_drive


class FornecedorViewSet(viewsets.ModelViewSet):
    serializer_class = FornecedorSerializer

    def get_queryset(self):
        return Fornecedor.objects.filter(ativa=True).order_by("nome")

    def perform_destroy(self, instance: Fornecedor):
        instance.ativa = False
        instance.save(update_fields=["ativa"])


class CategoriaViewSet(viewsets.ModelViewSet):
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        qs = Categoria.objects.filter(ativa=True).prefetch_related("subcategorias")
        if self.action == "list":
            qs = qs.filter(parent__isnull=True)
        return qs.annotate(
            tipo_order=Case(
                When(tipo=TipoOperacao.DESPESA, then=Value(0)),
                When(tipo=TipoOperacao.RECEITA, then=Value(1)),
                default=Value(2),
                output_field=IntegerField(),
            )
        ).order_by("tipo_order", "nome")

    def perform_destroy(self, instance: Categoria):
        instance.ativa = False
        instance.save(update_fields=["ativa"])
        instance.subcategorias.update(ativa=False)


class ObraViewSet(viewsets.ModelViewSet):
    queryset = Obra.objects.all()

    def get_queryset(self):
        qs = Obra.objects.prefetch_related("operacoes").annotate(
            _receitas=Coalesce(
                Sum(
                    "operacoes__valor",
                    filter=Q(operacoes__tipo=TipoOperacao.RECEITA),
                ),
                Value(Decimal("0")),
                output_field=DecimalField(),
            ),
            _despesas_pagas=Coalesce(
                Sum(
                    "operacoes__valor",
                    filter=Q(operacoes__tipo=TipoOperacao.DESPESA, operacoes__pago=True),
                ),
                Value(Decimal("0")),
                output_field=DecimalField(),
            ),
        ).annotate(
            saldo=F("_receitas") - F("_despesas_pagas"),
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
            qs = obra.operacoes.select_related("categoria", "subcategoria", "fornecedor")
            tipo = request.query_params.get("tipo")
            categoria = request.query_params.get("categoria")
            subcategoria = request.query_params.get("subcategoria")
            pago = request.query_params.get("pago")
            data_inicio = request.query_params.get("data_inicio")
            data_fim = request.query_params.get("data_fim")
            ordering = request.query_params.get("ordering", "-data")

            if tipo:
                qs = qs.filter(tipo=tipo)
            if categoria:
                qs = qs.filter(categoria_id=categoria)
            if subcategoria:
                qs = qs.filter(subcategoria_id=subcategoria)
            if pago in ("true", "false"):
                qs = qs.filter(pago=(pago == "true"))
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


class OperacaoViewSet(viewsets.ModelViewSet):
    queryset = Operacao.objects.select_related("categoria", "obra", "fornecedor")
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
        obra_id = request.query_params.get("obra")

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
        por_obra: dict = {}
        por_cidade: dict = {}
        por_categoria: dict = {}

        def _delta(op) -> Decimal:
            if op.tipo == TipoOperacao.RECEITA:
                return op.valor
            if op.tipo == TipoOperacao.DESPESA and op.pago:
                return -op.valor
            return Decimal("0")

        for op in operacoes:
            delta = _delta(op)
            if op.tipo == TipoOperacao.RECEITA:
                total_receitas += op.valor
            elif op.tipo == TipoOperacao.DESPESA:
                if op.pago:
                    total_despesas += op.valor
                else:
                    total_despesas_pendentes += op.valor
            elif op.tipo == TipoOperacao.INVESTIMENTO:
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
                elif op.tipo == TipoOperacao.INVESTIMENTO:
                    bucket["investimentos"] += op.valor
                bucket["saldo"] += delta

            cat_key = str(op.categoria_id)
            if cat_key not in por_categoria:
                por_categoria[cat_key] = {
                    "categoria_id": op.categoria_id,
                    "nome": op.categoria.nome,
                    "tipo": op.categoria.tipo,
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

        return Response(
            {
                "total_receitas": total_receitas,
                "total_despesas": total_despesas,
                "total_despesas_pendentes": total_despesas_pendentes,
                "total_investimentos": total_investimentos,
                "saldo": total_receitas - total_despesas,
                "por_obra": list(por_obra.values()),
                "por_cidade": list(por_cidade.values()),
                "por_categoria": categorias,
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


class GoogleDriveStatusView(APIView):
    def get(self, request):
        return Response(google_drive.get_status())


class GoogleDriveAuthView(APIView):
    def get(self, request):
        if not google_drive.is_configured():
            path = google_drive.get_status()["credentials_path"]
            return Response(
                {
                    "error": (
                        "Credenciais do Google não configuradas. "
                        f"Coloque o arquivo JSON em {path}."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            return Response({"auth_url": google_drive.get_auth_url()})
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleDriveCallbackView(APIView):
    def get(self, request):
        error = request.GET.get("error")
        if error:
            logger.warning("Google OAuth recusado pelo usuário: %s", error)
            return redirect(f"{settings.FRONTEND_URL}/configuracoes?google_drive=error")

        code = request.GET.get("code")
        if not code:
            return redirect(f"{settings.FRONTEND_URL}/configuracoes?google_drive=error")

        oauth_state = request.GET.get("state")
        try:
            google_drive.handle_oauth_callback(code, oauth_state)
            google_drive.upload_backup(force=True)
        except Exception:
            logger.exception("Falha no callback OAuth do Google Drive.")
            return redirect(f"{settings.FRONTEND_URL}/configuracoes?google_drive=error")

        return redirect(f"{settings.FRONTEND_URL}/configuracoes?google_drive=connected")


class GoogleDriveDisconnectView(APIView):
    def post(self, request):
        google_drive.disconnect()
        return Response({"message": "Google Drive desconectado."})


class GoogleDriveSyncView(APIView):
    def post(self, request):
        if not google_drive.is_connected():
            return Response(
                {"error": "Google Drive não conectado."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = google_drive.upload_backup(force=True)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if result is None:
            return Response({"message": "Nenhuma alteração detectada no banco de dados."})
        return Response(
            {"message": "Backup enviado para o Google Drive.", "backup": result},
            status=status.HTTP_201_CREATED,
        )


class GoogleDriveRestoreView(APIView):
    def post(self, request):
        file_id = request.data.get("file_id")
        if not file_id:
            return Response(
                {"error": "Informe o file_id do backup no Drive."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            google_drive.restore_from_drive(file_id)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"message": "Backup restaurado do Google Drive com sucesso."})
