from django.contrib import admin

from .models import Categoria, Fornecedor, Obra, Operacao


@admin.register(Obra)
class ObraAdmin(admin.ModelAdmin):
    list_display = ["nome", "cidade", "status", "arquivada", "data_inicio", "criado_em"]
    list_filter = ["status", "arquivada", "cidade"]
    search_fields = ["nome", "cidade"]


@admin.register(Fornecedor)
class FornecedorAdmin(admin.ModelAdmin):
    list_display = ["nome", "ativa"]
    list_filter = ["ativa"]
    search_fields = ["nome"]


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nome", "tipo", "padrao", "ativa"]
    list_filter = ["tipo", "padrao", "ativa"]


@admin.register(Operacao)
class OperacaoAdmin(admin.ModelAdmin):
    list_display = ["obra", "categoria", "fornecedor", "valor", "quantidade", "tipo", "data"]
    list_filter = ["tipo", "data"]
    search_fields = ["obra__nome", "descricao"]
