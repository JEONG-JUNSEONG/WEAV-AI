from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0009_document_pdf_file_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='session',
            name='reference_image_urls',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
