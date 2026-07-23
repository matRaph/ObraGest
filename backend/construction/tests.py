from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Categoria, Obra, Operacao, TipoOperacao


class ObraOperacaoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.categoria = Categoria.objects.create(
            nome="Materiais",
            tipo=TipoOperacao.DESPESA,
        )
        self.obra_ativa = Obra.objects.create(nome="Ativa", cidade="Recife")
        self.obra_arquivada = Obra.objects.create(
            nome="Arquivada",
            cidade="Olinda",
            arquivada=True,
        )
        self.operacao_ativa = Operacao.objects.create(
            obra=self.obra_ativa,
            categoria=self.categoria,
            valor=Decimal("150.00"),
            quantidade=Decimal("10"),
            data=date(2026, 7, 1),
            tipo=TipoOperacao.DESPESA,
        )
        Operacao.objects.create(
            obra=self.obra_arquivada,
            categoria=self.categoria,
            valor=Decimal("150.00"),
            data=date(2026, 7, 2),
            tipo=TipoOperacao.DESPESA,
        )

    def test_listagem_separa_obras_ativas_e_arquivadas(self):
        response = self.client.get(reverse("obra-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["nome"] for item in response.data["results"]], ["Ativa"])

        response = self.client.get(reverse("obra-list"), {"arquivada": "true"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["nome"] for item in response.data["results"]],
            ["Arquivada"],
        )

    def test_obra_arquivada_continua_acessivel_e_editavel(self):
        detail_url = reverse("obra-detail", args=[self.obra_arquivada.id])
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["arquivada"])

        response = self.client.patch(
            detail_url,
            {"arquivada": False, "nome": "Restaurada"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.obra_arquivada.refresh_from_db()
        self.assertFalse(self.obra_arquivada.arquivada)
        self.assertEqual(self.obra_arquivada.nome, "Restaurada")

    def test_dashboard_inclui_movimentacoes_de_obras_arquivadas(self):
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data["total_despesas"]), Decimal("300.00"))
        self.assertEqual(len(response.data["por_obra"]), 2)

    def test_criacao_preserva_valor_total_quando_existe_quantidade(self):
        response = self.client.post(
            reverse("obra-operacoes", args=[self.obra_ativa.id]),
            {
                "categoria": str(self.categoria.id),
                "valor": "150.00",
                "quantidade": "10",
                "data": "2026-07-03",
                "descricao": "Dez unidades",
                "pago": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        operacao = Operacao.objects.get(id=response.data["id"])
        self.assertEqual(operacao.valor, Decimal("150.00"))
        self.assertEqual(operacao.quantidade, Decimal("10"))

    def test_edicao_atualiza_campos_e_remove_quantidade(self):
        response = self.client.patch(
            reverse("operacao-detail", args=[self.operacao_ativa.id]),
            {
                "categoria": str(self.categoria.id),
                "valor": "175.00",
                "quantidade": None,
                "data": "2026-07-04",
                "descricao": "Valor corrigido",
                "pago": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.operacao_ativa.refresh_from_db()
        self.assertEqual(self.operacao_ativa.valor, Decimal("175.00"))
        self.assertIsNone(self.operacao_ativa.quantidade)
        self.assertEqual(self.operacao_ativa.data, date(2026, 7, 4))
        self.assertEqual(self.operacao_ativa.descricao, "Valor corrigido")
        self.assertFalse(self.operacao_ativa.pago)
