from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Categoria, Fornecedor, Obra, Operacao, TipoOperacao


class ObraOperacaoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.categoria = Categoria.objects.create(
            nome="Materiais",
            tipo=TipoOperacao.DESPESA,
        )
        self.categoria_investimento = Categoria.objects.create(
            nome="Equipamentos",
            tipo=TipoOperacao.INVESTIMENTO,
        )
        self.fornecedor = Fornecedor.objects.create(nome="Casa dos Materiais")
        self.obra_ativa = Obra.objects.create(nome="Ativa", cidade="Recife")
        self.obra_arquivada = Obra.objects.create(
            nome="Arquivada",
            cidade="Olinda",
            arquivada=True,
        )
        self.operacao_ativa = Operacao.objects.create(
            obra=self.obra_ativa,
            categoria=self.categoria,
            fornecedor=self.fornecedor,
            valor=Decimal("150.00"),
            quantidade=Decimal("10"),
            data=date(2026, 7, 1),
            tipo=TipoOperacao.DESPESA,
            descricao="Compra de cimento especial",
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

    def test_filtra_operacoes_por_fornecedor_e_descricao(self):
        url = reverse("obra-operacoes", args=[self.obra_ativa.id])

        response = self.client.get(url, {"fornecedor": str(self.fornecedor.id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [str(self.operacao_ativa.id)],
        )

        response = self.client.get(url, {"descricao": "CIMENTO ESPECIAL"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [str(self.operacao_ativa.id)],
        )

        response = self.client.get(url, {"descricao": "inexistente"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])

    def test_despesa_paga_tambem_conta_como_investimento_sem_duplicar_saldo(self):
        update_response = self.client.patch(
            reverse("operacao-detail", args=[self.operacao_ativa.id]),
            {"tambem_investimento": True},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)
        self.operacao_ativa.refresh_from_db()
        self.assertTrue(self.operacao_ativa.tambem_investimento)

        obra_response = self.client.get(
            reverse("obra-detail", args=[self.obra_ativa.id])
        )
        self.assertEqual(
            Decimal(obra_response.data["total_despesas"]), Decimal("150.00")
        )
        self.assertEqual(
            Decimal(obra_response.data["total_investimentos"]), Decimal("150.00")
        )
        self.assertEqual(Decimal(obra_response.data["saldo"]), Decimal("-150.00"))

        filtro_response = self.client.get(
            reverse("obra-operacoes", args=[self.obra_ativa.id]),
            {"tipo": TipoOperacao.INVESTIMENTO},
        )
        self.assertEqual(
            [item["id"] for item in filtro_response.data["results"]],
            [str(self.operacao_ativa.id)],
        )
        filtro_despesa_response = self.client.get(
            reverse("obra-operacoes", args=[self.obra_ativa.id]),
            {"tipo": TipoOperacao.DESPESA},
        )
        self.assertEqual(
            [item["id"] for item in filtro_despesa_response.data["results"]],
            [str(self.operacao_ativa.id)],
        )

        dashboard_response = self.client.get(reverse("dashboard"))
        self.assertEqual(
            Decimal(dashboard_response.data["total_investimentos"]),
            Decimal("150.00"),
        )
        resumo_obra = next(
            item
            for item in dashboard_response.data["por_obra"]
            if str(item["obra_id"]) == str(self.obra_ativa.id)
        )
        self.assertEqual(Decimal(resumo_obra["despesas"]), Decimal("150.00"))
        self.assertEqual(Decimal(resumo_obra["investimentos"]), Decimal("150.00"))
        self.assertEqual(Decimal(resumo_obra["saldo"]), Decimal("-150.00"))
        categorias_investimento = [
            item
            for item in dashboard_response.data["por_categoria"]
            if item["tipo"] == TipoOperacao.INVESTIMENTO
            and str(item["categoria_id"]) == str(self.categoria.id)
        ]
        self.assertEqual(len(categorias_investimento), 1)
        self.assertEqual(
            Decimal(categorias_investimento[0]["total"]), Decimal("150.00")
        )

    def test_despesa_nao_paga_nao_conta_como_investimento(self):
        self.operacao_ativa.tambem_investimento = True
        self.operacao_ativa.pago = False
        self.operacao_ativa.save()

        obra_response = self.client.get(
            reverse("obra-detail", args=[self.obra_ativa.id])
        )
        self.assertEqual(
            Decimal(obra_response.data["total_investimentos"]), Decimal("0.00")
        )
        self.assertEqual(
            Decimal(obra_response.data["total_despesas_pendentes"]),
            Decimal("150.00"),
        )

        filtro_response = self.client.get(
            reverse("obra-operacoes", args=[self.obra_ativa.id]),
            {"tipo": TipoOperacao.INVESTIMENTO},
        )
        self.assertEqual(filtro_response.data["results"], [])

    def test_rejeita_flag_de_investimento_em_operacao_que_nao_e_despesa(self):
        response = self.client.post(
            reverse("obra-operacoes", args=[self.obra_ativa.id]),
            {
                "categoria": str(self.categoria_investimento.id),
                "valor": "500.00",
                "data": "2026-07-05",
                "tambem_investimento": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("tambem_investimento", response.data)
