from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0008_categoria_devolucao_investimento"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacao",
            name="itens",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
