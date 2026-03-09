from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0011_job_result_json'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='processed_pages',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='document',
            name='progress_label',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='document',
            name='total_pages',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
