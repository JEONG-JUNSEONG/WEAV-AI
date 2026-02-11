from typing import Optional, List

from apps.chats.services import memory_service


def get_rag_context_string(session_id: int, query: str, limit: int = 5, max_chars: int = 800, exclude_sources: Optional[List[str]] = None) -> str:
    """Returns a concise context string from RAG memories (e.g. for prepending to image prompt)."""
    memories = memory_service.search_memory([session_id], query, limit=limit, exclude_sources=exclude_sources)
    if not memories:
        return ""
    items = []
    for m in memories:
        if m.metadata and m.metadata.get("type") == "image_generation":
            items.append(f"[Image] {m.content}")
        else:
            items.append(f"- {m.content}")
    text = "## Context\n" + "\n".join(items)
    if len(text) > max_chars:
        text = text[: max_chars - 20] + "...(truncated)"
    return text


def get_rag_enhanced_system_prompt(
    session_id: int,
    user_prompt: str,
    base_system_prompt: str = "You are a helpful AI assistant.",
    recent_conversation: str = "",
    exclude_sources: Optional[List[str]] = None,
) -> str:
    """
    Constructs a system prompt with recent conversation, RAG context, and Visual Continuity instructions.
    """
    # 0. Recent conversation (last few turns) so follow-up questions like "그 다음역은?" are understood
    recent_section = ""
    if recent_conversation.strip():
        recent_section = "## Recent conversation\n" + recent_conversation.strip() + "\n\n"

    # 1. Retrieve relevant memories (Shared Context potential here by expanding session_ids)
    memories = memory_service.search_memory([session_id], user_prompt, limit=5, exclude_sources=exclude_sources)

    # 2. Format memories
    memory_context = ""
    if memories:
        memory_items = []
        for m in memories:
            if m.metadata and m.metadata.get("type") == "image_generation":
                memory_items.append(f"[Image Generated] {m.content} (ID: {m.metadata.get('image_record_id')})")
            else:
                memory_items.append(f"- {m.content}")
        memory_context = "## Context History\n" + "\n".join(memory_items)

    # 3. Kling / Visual Continuity Instructions
    # Instruct the LLM to maintain consistency by referencing previous image parameters.
    visual_continuity_instructions = (
        "\n## Visual Continuity Instructions\n"
        "When the user requests to MODIFY an existing image (e.g., 'change cat to dog', 'add hat'):\n"
        "1. Identify the previous image from Context History.\n"
        "2. Use its 'seed' and 'image_url' (as reference) to maintain style/layout.\n"
        "3. Explicitly mention which image ID you are modifying.\n"
        "4. For Kling, use the 'reference_image_url' parameter to ensure consistency."
    )

    # Combine: base + recent conversation + RAG context + instructions
    full_prompt = f"{base_system_prompt}\n\n{recent_section}{memory_context}\n{visual_continuity_instructions}"

    # 4. Length Check (Soft limit 4000 chars to allow recent conversation)
    if len(full_prompt) > 4000:
        allowed_context_len = 4000 - len(base_system_prompt) - len(recent_section) - len(visual_continuity_instructions) - 100
        if allowed_context_len > 0 and memory_context:
            memory_context = memory_context[:allowed_context_len] + "...(truncated)"
            full_prompt = f"{base_system_prompt}\n\n{recent_section}{memory_context}\n{visual_continuity_instructions}"
        else:
            full_prompt = f"{base_system_prompt}\n\n{recent_section}{visual_continuity_instructions}"

    return full_prompt
