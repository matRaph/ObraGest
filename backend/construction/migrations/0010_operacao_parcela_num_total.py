from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0009_operacao_itens"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacao",
            name="parcela_num",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="operacao",
            name="parcela_total",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
