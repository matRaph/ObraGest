from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0006_obra_arquivada"),
    ]

    operations = [
        migrations.AddField(
            model_name="operacao",
            name="tambem_investimento",
            field=models.BooleanField(default=False),
        ),
    ]
