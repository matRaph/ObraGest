import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0003_field_max_lengths"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="categoria",
            name="unique_categoria_nome_tipo",
        ),
        migrations.AlterField(
            model_name="categoria",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("receita", "Receita"),
                    ("despesa", "Despesa"),
                    ("investimento", "Investimento"),
                ],
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="categoria",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="subcategorias",
                to="construction.categoria",
            ),
        ),
        migrations.AddField(
            model_name="operacao",
            name="subcategoria",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="operacoes_subcategoria",
                to="construction.categoria",
            ),
        ),
        migrations.AddField(
            model_name="operacao",
            name="pago",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="operacao",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("receita", "Receita"),
                    ("despesa", "Despesa"),
                    ("investimento", "Investimento"),
                ],
                max_length=12,
            ),
        ),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(
                condition=models.Q(("ativa", True), ("parent__isnull", True)),
                fields=("nome", "tipo"),
                name="unique_categoria_top_ativa",
            ),
        ),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(
                condition=models.Q(("ativa", True), ("parent__isnull", False)),
                fields=("nome", "tipo", "parent"),
                name="unique_categoria_sub_ativa",
            ),
        ),
    ]
