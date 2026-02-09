import os
import logging
from openai import OpenAI
from pgvector.django import CosineDistance
from django.conf import settings
from .models import ChatMemory, Session

logger = logging.getLogger(__name__)

class ChatMemoryService:
    def __init__(self):
        # Allow override via settings or env
        api_key = getattr(settings, 'OPENAI_API_KEY', os.environ.get("OPENAI_API_KEY"))
        if api_key:
            self.client = OpenAI(api_key=api_key)
        else:
            self.client = None
            logger.warning("OPENAI_API_KEY not found. RAG functionality will be limited.")

    def embed_text(self, text: str) -> list[float]:
        """Generates embedding for the given text using OpenAI."""
        if not self.client:
            # Return zero vector if no client (for testing/dev safety)
            return [0.0] * 1536

        try:
            response = self.client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return [0.0] * 1536

    def add_memory(self, session_id: int, content: str, metadata: dict = None):
        """Adds a memory item to the vector store."""
        if not content:
            return

        embedding = self.embed_text(content)
        ChatMemory.objects.create(
            session_id=session_id,
            content=content,
            embedding=embedding,
            metadata=metadata or {}
        )

    def search_memory(self, session_ids: list[int], query: str, limit: int = 5):
        """Retrieves relevant memories based on semantic similarity."""
        embedding = self.embed_text(query)

        # Filter by sessions
        qs = ChatMemory.objects.filter(session_id__in=session_ids)

        # Order by Cosine Distance (smaller is closer)
        return qs.order_by(CosineDistance('embedding', embedding))[:limit]

    
    def get_relevant_context(self, session_id: int, query: str, max_chars: int = 3000) -> str:
        """
        Retrieves relevant context for the given query within the character limit.
        Prioritizes semantic relevance (cosine similarity).
        """
        if not query:
            return ""

        # Fetch top relevant chunks
        # We fetch a bit more initially to filter/sort
        memories = self.search_memory([session_id], query, limit=10)
        
        context_parts = []
        current_length = 0
        
        for memory in memories:
            content = memory.content.strip()
            if current_length + len(content) + 1 > max_chars:
                break
            
            # Format: [Source: source_name] Content
            # Or just content. Let's keep it simple or use metadata.
            source = memory.metadata.get('source', 'chat')
            formatted_content = f"[{source.upper()}]: {content}"
            
            context_parts.append(formatted_content)
            current_length += len(formatted_content) + 1
            
        return "\n".join(context_parts)

    def get_image_context(self, session_id: int) -> dict:
        """
        Retrieves context for image generation, specifically for Kling AI visual consistency.
        Returns:
            dict: {
                'seed': int,
                'reference_image_url': str,
                'mask_url': str,
                'multi_elements': list
            }
        """
        from .models import ImageRecord
        
        # Get latest image record to maintain continuity
        last_image = ImageRecord.objects.filter(session_id=session_id).first()
        if not last_image:
            return {}
            
        context = {
            'seed': last_image.seed,
            'reference_image_url': last_image.image_url, # Key for "Reference Image"
            'mask_url': last_image.mask_url,
            'multi_elements': last_image.metadata.get('multi_elements', []),
            # Pass other relevant metadata if needed
        }
        
        # Filter out None values
        return {k: v for k, v in context.items() if v is not None}

# Singleton instance
memory_service = ChatMemoryService()
