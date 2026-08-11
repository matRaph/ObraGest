from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import logging
import zipfile

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


logger = logging.getLogger(__name__)


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
        qs = Obra.objects.prefetch_related("operacoes__categoria").annotate(
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
                    filter=Q(
                        operacoes__tipo=TipoOperacao.DESPESA,
                        operacoes__pago=True,
                        operacoes__categoria__devolucao_investimento=False,
                    ),
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

        if self.action == "list":
            arquivada = self.request.query_params.get("arquivada", "false").lower()
            qs = qs.filter(arquivada=arquivada == "true")
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
            Obra.objects.filter(arquivada=False)
            .values_list("cidade", flat=True)
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
            fornecedor = request.query_params.get("fornecedor")
            descricao = request.query_params.get("descricao", "").strip()
            pago = request.query_params.get("pago")
            data_inicio = request.query_params.get("data_inicio")
            data_fim = request.query_params.get("data_fim")
            ordering = request.query_params.get("ordering", "-data")

            if tipo == TipoOperacao.INVESTIMENTO:
                qs = qs.filter(
                    tipo=TipoOperacao.INVESTIMENTO,
                    categoria__devolucao_investimento=False,
                )
            elif tipo == "despesa_investimento":
                qs = qs.filter(
                    tipo=TipoOperacao.DESPESA,
                    tambem_investimento=True,
                    categoria__devolucao_investimento=False,
                )
            elif tipo == TipoOperacao.DESPESA:
                qs = qs.filter(
                    tipo=TipoOperacao.DESPESA,
                    tambem_investimento=False,
                    categoria__devolucao_investimento=False,
                )
            elif tipo == "devolucao":
                qs = qs.filter(categoria__devolucao_investimento=True)
            elif tipo == TipoOperacao.RECEITA:
                qs = qs.filter(tipo=tipo)
            if categoria:
                qs = qs.filter(categoria_id=categoria)
            if subcategoria:
                qs = qs.filter(subcategoria_id=subcategoria)
            if fornecedor:
                qs = qs.filter(fornecedor_id=fornecedor)
            if descricao:
                qs = qs.filter(descricao__icontains=descricao)
            if pago in ("true", "false"):
                qs = qs.filter(pago=(pago == "true"))
            if data_inicio:
                qs = qs.filter(data__gte=data_inicio)
            if data_fim:
                qs = qs.filter(data__lte=data_fim)

            allowed = {
                "data": ("data", "criado_em"),
                "-data": ("-data", "-criado_em"),
                "valor": ("valor", "-data", "-criado_em"),
                "-valor": ("-valor", "-data", "-criado_em"),
            }
            qs = qs.order_by(*allowed.get(ordering, ("-data", "-criado_em")))

            page = self.paginate_queryset(qs)
            serializer = OperacaoSerializer(page or qs, many=True)
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response(serializer.data)

        serializer = OperacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(obra=obra)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="operacoes/lote")
    def operacoes_lote(self, request, pk=None):
        obra = self.get_object()

        itens = request.data.get("itens")
        if not itens or not isinstance(itens, list) or len(itens) == 0:
            return Response(
                {"itens": "Informe ao menos um item."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        categoria_id = request.data.get("categoria")
        subcategoria_id = request.data.get("subcategoria") or None
        fornecedor_id = request.data.get("fornecedor") or None
        num_parcelas = request.data.get("num_parcelas")
        data_primeira_str = request.data.get("data_primeira_parcela")
        tambem_investimento = bool(request.data.get("tambem_investimento", False))
        descricao_payload = str(request.data.get("descricao", "")).strip()

        # Validações básicas
        if not categoria_id:
            return Response(
                {"categoria": "Informe a categoria da nota."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not data_primeira_str:
            return Response(
                {"data_primeira_parcela": "Informe a data da primeira parcela."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            num_parcelas = int(num_parcelas)
            if num_parcelas < 1:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"num_parcelas": "Número de parcelas deve ser inteiro maior que zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            categoria = Categoria.objects.get(pk=categoria_id)
        except Categoria.DoesNotExist:
            return Response(
                {"categoria": "Categoria não encontrada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not categoria.ativa:
            return Response(
                {"categoria": "Categoria inativa."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if categoria.parent_id is not None:
            return Response(
                {"categoria": "Selecione uma categoria principal, não uma subcategoria."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subcategoria = None
        if subcategoria_id:
            try:
                subcategoria = Categoria.objects.get(pk=subcategoria_id)
            except Categoria.DoesNotExist:
                return Response(
                    {"subcategoria": "Subcategoria não encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if subcategoria.parent_id != categoria.id:
                return Response(
                    {"subcategoria": "A subcategoria não pertence à categoria escolhida."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        fornecedor = None
        if fornecedor_id:
            try:
                fornecedor = Fornecedor.objects.get(pk=fornecedor_id)
            except Fornecedor.DoesNotExist:
                return Response(
                    {"fornecedor": "Fornecedor não encontrado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not fornecedor.ativa:
                return Response(
                    {"fornecedor": "Fornecedor inativo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            data_primeira = date.fromisoformat(data_primeira_str)
        except ValueError:
            return Response(
                {"data_primeira_parcela": "Data inválida. Use o formato AAAA-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calcular total dos itens
        try:
            total = sum(Decimal(str(item.get("valor", "0"))) for item in itens)
        except Exception:
            return Response(
                {"itens": "Valores dos itens inválidos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if total <= 0:
            return Response(
                {"itens": "O valor total dos itens deve ser maior que zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calcular valor de cada parcela com arredondamento
        centavo = Decimal("0.01")
        valor_parcela = (total / num_parcelas).quantize(centavo, rounding=ROUND_HALF_UP)
        # Última parcela absorve a diferença de arredondamento
        valor_ultima = total - valor_parcela * (num_parcelas - 1)

        criadas = []
        for i in range(num_parcelas):
            data_parcela = data_primeira + timedelta(days=30 * i)
            valor = valor_ultima if i == num_parcelas - 1 else valor_parcela
            op = Operacao(
                obra=obra,
                categoria=categoria,
                subcategoria=subcategoria,
                fornecedor=fornecedor,
                valor=valor,
                data=data_parcela,
                pago=False,
                tambem_investimento=(
                    tambem_investimento
                    and categoria.tipo == TipoOperacao.DESPESA
                    and not categoria.contabiliza_como_devolucao_investimento
                ),
                descricao=descricao_payload,
                itens=itens,
                parcela_num=i + 1,
                parcela_total=num_parcelas,
            )
            op.save()
            criadas.append(op)

        serializer = OperacaoSerializer(criadas, many=True)
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

            sub_key = (
                str(op.subcategoria_id) if op.subcategoria_id else "__none__"
            )
            sub_nome = (
                op.subcategoria.nome if op.subcategoria_id else "Sem subcategoria"
            )
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
            if (
                op.tipo == TipoOperacao.DESPESA
                and op.tambem_investimento
                and op.pago
            ):
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

        return Response(
            {
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
                {
                    "error": "Google Drive não conectado.",
                    "needs_reauth": True,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = google_drive.upload_backup(force=True)
        except google_drive.GoogleDriveReauthRequired as exc:
            return Response(
                {"error": str(exc), "needs_reauth": True},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            return Response(
                {"error": google_drive.friendly_drive_error(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
                if google_drive.is_network_error(exc)
                else status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

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
        except google_drive.GoogleDriveReauthRequired as exc:
            return Response(
                {"error": str(exc), "needs_reauth": True},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            return Response(
                {"error": google_drive.friendly_drive_error(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
                if google_drive.is_network_error(exc)
                else status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": "Backup restaurado do Google Drive com sucesso."})
