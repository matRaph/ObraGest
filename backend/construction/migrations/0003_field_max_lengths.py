from django.db import migrations, models

import construction.constants as constants


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0002_categoria_unique_nome_tipo"),
    ]

    operations = [
        migrations.AlterField(
            model_name="obra",
            name="nome",
            field=models.CharField(max_length=constants.NOME_MAX_LENGTH),
        ),
        migrations.AlterField(
            model_name="obra",
            name="descricao",
            field=models.TextField(blank=True, max_length=constants.DESCRICAO_MAX_LENGTH),
        ),
        migrations.AlterField(
            model_name="operacao",
            name="descricao",
            field=models.TextField(blank=True, max_length=constants.DESCRICAO_MAX_LENGTH),
        ),
    ]
