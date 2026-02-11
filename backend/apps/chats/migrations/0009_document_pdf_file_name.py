from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0008_message_citations_document_original_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='pdf_file_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
