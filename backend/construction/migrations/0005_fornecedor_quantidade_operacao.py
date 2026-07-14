import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0004_categoria_subcategoria_investimento"),
    ]

    operations = [
        migrations.CreateModel(
            name="Fornecedor",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("nome", models.CharField(max_length=100)),
                ("ativa", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name_plural": "fornecedores",
                "ordering": ["nome"],
            },
        ),
        migrations.AddField(
            model_name="operacao",
            name="quantidade",
            field=models.DecimalField(
                blank=True, decimal_places=4, max_digits=12, null=True
            ),
        ),
        migrations.AddField(
            model_name="operacao",
            name="fornecedor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="operacoes",
                to="construction.fornecedor",
            ),
        ),
        migrations.AddConstraint(
            model_name="fornecedor",
            constraint=models.UniqueConstraint(
                condition=models.Q(("ativa", True)),
                fields=("nome",),
                name="unique_fornecedor_ativo",
            ),
        ),
    ]
