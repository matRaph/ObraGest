from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0011_operacao_grupo_parcela"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacao",
            name="data_compra",
            field=models.DateField(blank=True, null=True),
        ),
    ]
