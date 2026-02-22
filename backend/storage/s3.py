import logging
import boto3
from botocore.exceptions import ClientError
from django.conf import settings

logger = logging.getLogger(__name__)

class MinIOStorage:
    def __init__(self):
        self.endpoint_url = f"http{'s' if settings.MINIO_USE_SSL else ''}://{settings.MINIO_ENDPOINT}"
        self.public_endpoint_url = f"http{'s' if settings.MINIO_PUBLIC_USE_SSL else ''}://{settings.MINIO_PUBLIC_ENDPOINT}"
        self.browser_endpoint_url = f"http{'s' if settings.MINIO_BROWSER_USE_SSL else ''}://{settings.MINIO_BROWSER_ENDPOINT}"
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.bucket_name = settings.MINIO_BUCKET_NAME
        
        self.client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=boto3.session.Config(signature_version='s3v4')
        )
        self.public_client = self.client
        if self.public_endpoint_url != self.endpoint_url:
            self.public_client = boto3.client(
                's3',
                endpoint_url=self.public_endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=boto3.session.Config(signature_version='s3v4')
            )

        # Used to generate URLs the browser can actually open (e.g. localhost:9000),
        # regardless of Docker-internal service names like `minio:9000`.
        self.browser_client = self.public_client
        if self.browser_endpoint_url != self.public_endpoint_url:
            self.browser_client = boto3.client(
                's3',
                endpoint_url=self.browser_endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=boto3.session.Config(signature_version='s3v4')
            )
        
        try:
            self._ensure_bucket_exists()
        except Exception as e:
            logger.warning(f"MinIO initial check failed: {e}")

    def _ensure_bucket_exists(self):
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            try:
                self.client.create_bucket(Bucket=self.bucket_name)
                logger.info(f"Created bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to create bucket {self.bucket_name}: {e}")
                raise

    def upload_file(self, file_obj, filename: str, content_type: str = 'application/pdf') -> str:
        """
        Uploads a file-like object to MinIO and returns the URL.
        """
        try:
            self.client.upload_fileobj(
                file_obj,
                self.bucket_name,
                filename,
                ExtraArgs={'ContentType': content_type or 'application/octet-stream'}
            )

            # Return a presigned URL that the browser can resolve (MINIO_BROWSER_ENDPOINT).
            url = self.browser_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': filename},
                ExpiresIn=24 * 3600
            )
            logger.info(f"Successfully uploaded {filename} to MinIO.")
            return url
        except Exception as e:
            logger.error(f"Failed to upload {filename} to MinIO: {e}")
            raise

    def get_file_content(self, filename: str) -> bytes:
        """
        Downloads file content from MinIO.
        """
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=filename)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Failed to download {filename} from MinIO: {e}")
            raise

    def get_presigned_url(self, filename: str, expires_in: int = 3600) -> str:
        """
        Returns a presigned URL for a given object key.
        """
        try:
            return self.browser_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': filename},
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {filename}: {e}")
            raise

    def delete_file(self, filename: str):
        """
        Deletes a file from MinIO.
        """
        try:
            self.client.delete_object(self.bucket_name, filename)
        except Exception as e:
            logger.error(f"Failed to delete {filename} from MinIO: {e}")
            raise

minio_client = MinIOStorage()
