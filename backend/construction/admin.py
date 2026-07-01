from django.contrib import admin

from .models import Categoria, Obra, Operacao


@admin.register(Obra)
class ObraAdmin(admin.ModelAdmin):
    list_display = ["nome", "cidade", "status", "data_inicio", "criado_em"]
    list_filter = ["status", "cidade"]
    search_fields = ["nome", "cidade"]


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nome", "tipo", "padrao", "ativa"]
    list_filter = ["tipo", "padrao", "ativa"]


@admin.register(Operacao)
class OperacaoAdmin(admin.ModelAdmin):
    list_display = ["obra", "categoria", "valor", "tipo", "data"]
    list_filter = ["tipo", "data"]
    search_fields = ["obra__nome", "descricao"]
