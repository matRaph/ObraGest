from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0010_operacao_parcela_num_total"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacao",
            name="grupo_parcela",
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
