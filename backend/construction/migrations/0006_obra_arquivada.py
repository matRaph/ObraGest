from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0005_fornecedor_quantidade_operacao"),
    ]

    operations = [
        migrations.AddField(
            model_name="obra",
            name="arquivada",
            field=models.BooleanField(default=False),
        ),
    ]
