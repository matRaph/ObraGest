from django.db import migrations, models


def merge_legacy_categorias(apps, schema_editor):
    Categoria = apps.get_model("construction", "Categoria")
    Operacao = apps.get_model("construction", "Operacao")

    legacy_map = [
        ("Outros (despesa)", "despesa", "Outros"),
        ("Outros (receita)", "receita", "Outros"),
    ]

    for old_nome, tipo, new_nome in legacy_map:
        legacy = Categoria.objects.filter(nome=old_nome, tipo=tipo, padrao=True).first()
        if not legacy:
            continue

        target, _ = Categoria.objects.get_or_create(
            nome=new_nome,
            tipo=tipo,
            defaults={"padrao": True, "ativa": True},
        )
        Operacao.objects.filter(categoria=legacy).update(categoria=target)
        legacy.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(merge_legacy_categorias, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="categoria",
            constraint=models.UniqueConstraint(
                fields=("nome", "tipo"),
                name="unique_categoria_nome_tipo",
            ),
        ),
    ]
