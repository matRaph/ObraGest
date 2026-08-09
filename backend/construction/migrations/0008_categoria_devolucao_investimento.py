from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0007_operacao_tambem_investimento"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoria",
            name="devolucao_investimento",
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.CheckConstraint(
                condition=Q(devolucao_investimento=False)
                | Q(parent__isnull=True, tipo="despesa"),
                name="devolucao_apenas_despesa_top",
            ),
        ),
    ]
