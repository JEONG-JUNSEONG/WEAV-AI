# Drop attachment_urls column if it exists (e.g. from a previous branch).
# Model no longer has this field; DB may still have it from 0005_message_attachment_urls.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("chats", "0004_imagerecord_mask_url_imagerecord_metadata_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE chats_message DROP COLUMN IF EXISTS attachment_urls;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
