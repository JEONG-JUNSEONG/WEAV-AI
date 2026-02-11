import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Settings2, Upload, X, ArrowUp, ImagePlus, Info, Paperclip } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useChat } from '@/contexts/ChatContext';
import { useLayout } from '@/contexts/LayoutContext';
import {
  IMAGE_MODEL_SETTINGS,
  CHAT_PROMPT_MAX_LENGTH,
  CHAT_PROMPT_MAX_LENGTH_BY_MODEL,
  IMAGE_PROMPT_MAX_LENGTH,
  IMAGE_PROMPT_MAX_LENGTH_BY_MODEL,
  IMAGE_MODEL_ID_IMAGEN4,
  IMAGE_MODEL_ID_FLUX,
  IMAGE_MODEL_ID_GEMINI,
  IMAGE_MODEL_ID_KLING,
  IMAGE_MODEL_ID_NANO_BANANA,
  imageModelSupportsReference,
  validateChatPrompt,
  validateImagePrompt,
} from '@/constants/models';
import { chatApi } from '@/services/api/chatApi';
import { useToast } from '@/contexts/ToastContext';
import { ModelSelector } from './ModelSelector';

export function ChatInput({
  rightOffset = 0,
  onHeightChange,
}: {
  rightOffset?: number;
  onHeightChange?: (height: number) => void;
}) {
  const { currentSession } = useApp();
  const {
    sendChatMessage,
    sendImageRequest,
    sending,
    error,
    clearError,
    stopGeneration,
    getChatModel,
    setChatModel,
    getImageModel,
    setImageModel,
    getImageSettings,
    setImageSettings,
    getDocuments,
    refreshDocuments,
    regeneratePrompt,
    clearRegeneratePrompt,
    regenerateChat,
    regenerateImagePrompt,
    clearRegenerateImagePrompt,
    regenerateImage,
    getReferenceImageId,
    setReferenceImageId,
    getReferenceImageUrl,
    setReferenceImageUrl,
    getAttachmentItems,
    updateAttachmentItems,
    removeAttachmentItem,
    clearAttachmentItems,
  } = useChat();
  const { showToast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [imageSettingsOpen, setImageSettingsOpen] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxTextareaHeight, setMaxTextareaHeight] = useState<number | null>(null);

  if (!currentSession) return null;

  const chatModel = getChatModel(currentSession.id);
  const imageModel = getImageModel(currentSession.id);
  const isChat = currentSession.kind === 'chat';
  const isRegenerateMode =
    isChat && regeneratePrompt != null && regeneratePrompt.sessionId === currentSession.id;
  const isRegenerateImageMode =
    !isChat && regenerateImagePrompt != null && regenerateImagePrompt.sessionId === currentSession.id;
  const modelSettings = !isChat ? IMAGE_MODEL_SETTINGS[imageModel] : null;
  const imageSettings = !isChat ? getImageSettings(currentSession.id, imageModel) : null;
  const sessionId = currentSession.id;
  const attachmentItems = !isChat ? getAttachmentItems(sessionId) : [];
  const attachmentCount = attachmentItems.length;
  const referenceImageId = !isChat ? getReferenceImageId(sessionId) : null;
  const referenceImageUrl = !isChat ? getReferenceImageUrl(sessionId) : null;
  const hasReference = !isChat && (referenceImageId != null || referenceImageUrl != null);
  const documents = isChat ? getDocuments(sessionId) : [];
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);

  const getAttachmentPolicy = () => {
    if (isChat) return { maxCount: 0, blockMessage: '' };
    const isRegenLimited = isRegenerateImageMode;
    if (imageModel === IMAGE_MODEL_ID_NANO_BANANA) {
      const baseMax = hasReference ? 1 : 2;
      return { maxCount: isRegenLimited ? Math.min(1, baseMax) : baseMax, blockMessage: '' };
    }
    if (imageModel === IMAGE_MODEL_ID_KLING) {
      const baseMax = hasReference ? 0 : 1;
      return {
        maxCount: isRegenLimited ? Math.min(1, baseMax) : baseMax,
        blockMessage: hasReference
          ? 'Kling은 참조 이미지 사용 시 추가 첨부를 지원하지 않습니다. Nano Banana를 사용하세요.'
          : 'Kling은 이미지 첨부를 1개까지만 지원합니다. 2개 첨부가 필요하면 Nano Banana를 사용하세요.',
      };
    }
    if (imageModel === IMAGE_MODEL_ID_IMAGEN4 || imageModel === IMAGE_MODEL_ID_FLUX || imageModel === IMAGE_MODEL_ID_GEMINI) {
      return {
        maxCount: 0,
        blockMessage: '이 모델은 이미지 첨부를 지원하지 않습니다. Nano Banana 또는 Kling을 사용하세요.',
      };
    }
    return { maxCount: 0, blockMessage: '이 모델은 이미지 첨부를 지원하지 않습니다.' };
  };

  const attachmentPolicy = getAttachmentPolicy();
  const maxAttachments = attachmentPolicy.maxCount;
  const getModelInfoLines = () => {
    if (isChat) return [];
    if (imageModel === IMAGE_MODEL_ID_NANO_BANANA) {
      return [
        '참조 이미지 지원',
        '참조 미사용: 이미지 첨부 최대 2개',
        '참조 사용: 이미지 첨부 최대 1개',
        '텍스트만 입력 시 Gemini 3 Pro TTI 사용',
        '이미지 첨부/참조 사용 시 Nano Banana Pro Edit 사용',
      ];
    }
    if (imageModel === IMAGE_MODEL_ID_KLING) {
      return [
        '참조 이미지 지원',
        '참조 미사용: 이미지 1개 첨부 + 텍스트',
        '참조 사용: 텍스트만 가능 (첨부 불가)',
        '이미지 2개 이상 첨부는 미지원 — Nano Banana 권장',
      ];
    }
    if (imageModel === IMAGE_MODEL_ID_GEMINI) {
      return [
        '텍스트 전용 또는 참조 1개 기반 생성',
        '이미지 첨부 미지원',
      ];
    }
    if (imageModel === IMAGE_MODEL_ID_IMAGEN4 || imageModel === IMAGE_MODEL_ID_FLUX) {
      return [
        '텍스트 전용 TTI',
        '이미지 첨부 미지원 — Nano Banana/Kling 권장',
      ];
    }
    return [];
  };
  const modelInfoLines = getModelInfoLines();

  useEffect(() => {
    if (regeneratePrompt?.sessionId === currentSession?.id) {
      setPrompt(regeneratePrompt.prompt);
      inputRef.current?.focus();
    }
  }, [regeneratePrompt?.sessionId, regeneratePrompt?.prompt, currentSession?.id]);

  useEffect(() => {
    if (regenerateImagePrompt?.sessionId === currentSession?.id) {
      setPrompt(regenerateImagePrompt.prompt);
      inputRef.current?.focus();
    }
  }, [regenerateImagePrompt?.sessionId, regenerateImagePrompt?.prompt, currentSession?.id]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(style.lineHeight || '0') || 20;
    const padTop = Number.parseFloat(style.paddingTop || '0') || 0;
    const padBottom = Number.parseFloat(style.paddingBottom || '0') || 0;
    setMaxTextareaHeight(lineHeight * 4 + padTop + padBottom);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !onHeightChange) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect?.height ?? 0;
      onHeightChange(h);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onHeightChange]);

  useEffect(() => {
    if (!isChat) {
      setMentionOpen(false);
      setMentionQuery('');
    }
  }, [isChat]);

  useEffect(() => {
    if (isChat && currentSession) {
      refreshDocuments(currentSession.id).catch(() => {});
    }
  }, [isChat, currentSession?.id, refreshDocuments]);

  const updateMentionState = (value: string, caret: number) => {
    if (!isChat) {
      setMentionOpen(false);
      return;
    }
    const upto = value.slice(0, caret);
    const quotedMatch = /@"([^"]*)$/.exec(upto);
    const match = /@([^\s@]*)$/.exec(upto);
    const activeMatch = quotedMatch ?? match;
    if (activeMatch) {
      setMentionOpen(true);
      setMentionQuery(activeMatch[1]);
      const startIndex = activeMatch.index ?? (caret - activeMatch[1].length - 1);
      setMentionStart(startIndex);
      setMentionIndex(0);
      refreshDocuments(sessionId).catch(() => {});
    } else {
      setMentionOpen(false);
      setMentionQuery('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || sending) return;

    if (isChat) {
      const result = validateChatPrompt(text, chatModel);
      if (!result.valid) {
        showToast(result.message);
        return;
      }
    } else {
      const result = validateImagePrompt(text, imageModel);
      if (!result.valid) {
        showToast(result.message);
        return;
      }
      if (attachmentCount > maxAttachments) {
        showToast(attachmentPolicy.blockMessage || `이미지는 최대 ${maxAttachments}개까지 첨부 가능합니다.`);
        return;
      }
      if (maxAttachments === 0 && attachmentCount > 0) {
        showToast(attachmentPolicy.blockMessage || '이 모델은 이미지 첨부를 지원하지 않습니다.');
        return;
      }
      if (attachmentItems.some((item) => !item.remoteUrl)) {
        showToast('이미지 업로드가 완료될 때까지 기다려 주세요.');
        return;
      }
    }

    setPrompt('');
    setMentionOpen(false);
    if (isRegenerateMode && currentSession) {
      clearRegeneratePrompt();
      await regenerateChat(currentSession.id, { prompt: text, model: chatModel });
    } else if (isRegenerateImageMode && currentSession) {
      clearRegenerateImagePrompt();
      await regenerateImage(currentSession.id, { prompt: text });
    } else if (isChat) {
      await sendChatMessage(text, chatModel);
    } else {
      await sendImageRequest(text, imageModel);
    }
  };

  const sortedDocuments = isChat
    ? [...documents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];
  const mentionCandidates = isChat
    ? sortedDocuments.filter((doc) =>
        doc.original_name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];
  const mentionVisible = mentionOpen && mentionCandidates.length > 0;

  const selectMention = (docName: string) => {
    const input = inputRef.current;
    if (!input) return;
    const caret = input.selectionStart ?? prompt.length;
    const before = prompt.slice(0, mentionStart);
    const after = prompt.slice(caret);
    const insertion = /\\s/.test(docName) ? `@"${docName}"` : `@${docName}`;
    const spacer = after.startsWith(' ') || after === '' ? ' ' : ' ';
    const next = `${before}${insertion}${spacer}${after}`;
    setPrompt(next);
    setMentionOpen(false);
    setMentionQuery('');
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length + spacer.length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  };

  const formatDocTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yy}-${mm}-${dd} ${hh}:${min}`;
  };

  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentSession || currentSession.kind !== 'image') return;
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다 (JPEG, PNG, WebP)');
      return;
    }
    setUploadingRef(true);
    try {
      const { url } = await chatApi.uploadReferenceImage(file);
      setReferenceImageUrl(currentSession.id, url);
      showToast('참조 이미지가 업로드되었습니다');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploadingRef(false);
    }
  };

  const handleUploadAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length || !currentSession || currentSession.kind !== 'image') return;
    if (maxAttachments <= 0) {
      showToast(attachmentPolicy.blockMessage || '이 모델은 이미지 첨부를 지원하지 않습니다.');
      return;
    }
    if (files.some((f) => !f.type.startsWith('image/'))) {
      showToast('이미지 파일만 업로드할 수 있습니다 (JPEG, PNG, WebP)');
      return;
    }
    const remaining = maxAttachments - attachmentCount;
    if (remaining <= 0) {
      showToast(attachmentPolicy.blockMessage || `이미지는 최대 ${maxAttachments}개까지 첨부 가능합니다.`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    const previewItems = toUpload.map((file) => ({
      previewUrl: URL.createObjectURL(file),
      status: 'uploading' as const,
    }));
    setUploadingAttachments(true);
    updateAttachmentItems(sessionId, (prev) => [...prev, ...previewItems]);
    try {
      const { urls } = await chatApi.uploadImageAttachments(toUpload);
      updateAttachmentItems(sessionId, (prev) => {
        const urlMap = new Map(previewItems.map((item, idx) => [item.previewUrl, urls[idx]]));
        return prev.map((item) => {
          const remote = urlMap.get(item.previewUrl);
          if (!remote) return item;
          return { ...item, remoteUrl: remote, status: 'ready' };
        });
      });
      if (files.length > remaining) {
        showToast(attachmentPolicy.blockMessage || `이미지는 최대 ${maxAttachments}개까지 첨부 가능합니다.`);
      }
    } catch (err) {
      updateAttachmentItems(sessionId, (prev) =>
        prev.map((item) => (previewItems.some((p) => p.previewUrl === item.previewUrl) ? { ...item, status: 'error' } : item))
      );
      showToast(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleAttachmentClick = () => {
    if (maxAttachments <= 0) {
      showToast(attachmentPolicy.blockMessage || '이 모델은 이미지 첨부를 지원하지 않습니다.');
      return;
    }
    attachInputRef.current?.click();
  };

  const supportsReference = !isChat && imageModelSupportsReference(imageModel);
  const hasRefImage = hasReference;

  const promptMaxLen = isChat
    ? (CHAT_PROMPT_MAX_LENGTH_BY_MODEL[chatModel] ?? CHAT_PROMPT_MAX_LENGTH)
    : (IMAGE_PROMPT_MAX_LENGTH_BY_MODEL[imageModel] ?? IMAGE_PROMPT_MAX_LENGTH);
  const showCharCount = prompt.length > 0 && prompt.length >= promptMaxLen * 0.8;
  const isOverLimit = prompt.length > promptMaxLen;

  const { sidebarOpen } = useLayout();

  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = maxTextareaHeight ?? el.scrollHeight;
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > next ? 'auto' : 'hidden';
  };

  useEffect(() => {
    resizeTextarea();
  }, [prompt, maxTextareaHeight]);

  return (
      <div
        ref={containerRef}
        className={`fixed bottom-0 right-0 p-4 transition-[left] duration-300 ease-out ${
          sidebarOpen ? 'left-72' : 'left-0'
        }`}
        style={rightOffset > 0 ? { right: rightOffset } : undefined}
      >
      {error && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between rounded-lg bg-destructive/50 text-destructive-foreground px-3 py-2 text-sm animate-fade-in-up">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="hover:text-primary transition-colors duration-200">
            닫기
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto rounded-2xl border border-border bg-background shadow-sm overflow-visible animate-fade-in-up"
      >
        {/* 위쪽: 미디어 버튼 + 입력 + 전송 */}
        <div className="flex items-center gap-2 p-3">
          {!isChat && (
            <>
              <input
                ref={attachInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                multiple
                onChange={handleUploadAttachments}
                disabled={uploadingAttachments || sending}
              />
              <button
                type="button"
                onClick={handleAttachmentClick}
                disabled={uploadingAttachments || sending}
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border transition-colors duration-200 disabled:opacity-50 ${
                  attachmentCount > 0
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={
                  attachmentCount > 0
                    ? (maxAttachments > 0 ? `첨부 이미지 ${attachmentCount}/${maxAttachments}` : `첨부 이미지 ${attachmentCount}개`)
                    : '이미지 첨부'
                }
                aria-label="이미지 첨부"
              >
                {uploadingAttachments ? <span className="text-xs">…</span> : <Paperclip size={18} />}
              </button>
              {attachmentCount > 0 && (
                <button
                  type="button"
                  onClick={() => clearAttachmentItems(sessionId)}
                  className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="첨부 해제"
                  title="첨부 해제"
                >
                  <X size={18} />
                </button>
              )}
            </>
          )}
          {supportsReference && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleUploadReference}
                disabled={uploadingRef || sending}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadingRef || sending}
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border transition-colors duration-200 disabled:opacity-50 ${
                  hasRefImage
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={hasRefImage ? '참조 이미지 사용 중' : '참조 이미지 업로드'}
                aria-label={hasRefImage ? '참조 이미지 사용 중' : '참조 이미지 업로드'}
              >
                {uploadingRef ? (
                  <span className="text-xs">…</span>
                ) : hasRefImage ? (
                  <ImagePlus size={20} />
                ) : (
                  <Upload size={20} />
                )}
              </button>
              {hasRefImage && (
                <button
                  type="button"
                  onClick={() => {
                    setReferenceImageUrl(currentSession.id, null);
                    setReferenceImageId(currentSession.id, null);
                  }}
                  className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="참조 해제"
                >
                  <X size={18} />
                </button>
              )}
            </>
          )}
          <div className="relative flex-1 flex items-center">
            <textarea
              ref={inputRef}
              rows={1}
              value={prompt}
              onChange={(e) => {
                const value = e.target.value;
                setPrompt(value);
                const caret = e.target.selectionStart ?? value.length;
                updateMentionState(value, caret);
                resizeTextarea();
              }}
              onKeyDown={(e) => {
                if ((e.nativeEvent as KeyboardEvent).isComposing) return;
                if (e.key === 'Enter' && !e.shiftKey && (!mentionOpen || mentionCandidates.length === 0)) {
                  e.preventDefault();
                  const form = (e.currentTarget as HTMLTextAreaElement).form;
                  if (form) form.requestSubmit();
                  return;
                }
                if (!mentionOpen || mentionCandidates.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const selected = mentionCandidates[mentionIndex];
                  if (selected) selectMention(selected.original_name);
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  const selected = mentionCandidates[mentionIndex];
                  if (selected) selectMention(selected.original_name);
                } else if (e.key === 'Escape') {
                  setMentionOpen(false);
                }
              }}
              placeholder={
                isRegenerateMode
                  ? '수정 후 Enter 또는 재질문 버튼으로 재생성'
                  : isRegenerateImageMode
                    ? '수정 후 Enter 또는 재생성 버튼으로 재생성'
                    : isChat
                      ? '메시지를 입력하세요...'
                      : '이미지 설명을 입력하세요...'
              }
              className="w-full min-h-[48px] max-h-[160px] py-2.5 pl-4 pr-12 text-base text-foreground placeholder-muted-foreground bg-muted/40 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200 resize-none leading-6"
              disabled={sending}
              maxLength={promptMaxLen}
              aria-invalid={isOverLimit}
              aria-describedby={showCharCount ? 'prompt-char-count' : undefined}
            />
            {showCharCount && (
              <span
                id="prompt-char-count"
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums pointer-events-none ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
                aria-live="polite"
              >
                {prompt.length.toLocaleString()} / {(promptMaxLen / 1000).toFixed(0)}천
              </span>
            )}
            {mentionVisible && (
              <div className="absolute left-0 right-0 bottom-full mb-2 z-20 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  {mentionCandidates.map((doc, idx) => (
                    <button
                      key={`${doc.id}-${doc.original_name}`}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/70 transition-colors ${
                        idx === mentionIndex ? 'bg-muted/70' : ''
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMention(doc.original_name);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{doc.original_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {doc.status === 'completed' ? '완료' : doc.status === 'failed' ? '실패' : '처리 중'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDocTime(doc.created_at)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {sending ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors duration-200"
              aria-label="중단"
            >
              <X size={22} />
            </button>
          ) : isRegenerateMode ? (
            <>
              <button
                type="button"
                onClick={() => { clearRegeneratePrompt(); setPrompt(''); }}
                className="shrink-0 px-4 h-12 rounded-xl text-muted-foreground font-medium hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors duration-200"
                aria-label="재질문"
              >
                <ArrowUp size={22} />
              </button>
            </>
          ) : isRegenerateImageMode ? (
            <>
              <button
                type="button"
                onClick={() => { clearRegenerateImagePrompt(); setPrompt(''); }}
                className="shrink-0 px-4 h-12 rounded-xl text-muted-foreground font-medium hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors duration-200"
                aria-label="재생성"
              >
                <ArrowUp size={22} />
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors duration-200"
              aria-label={isChat ? '전송' : '생성'}
            >
              <ArrowUp size={22} />
            </button>
          )}
        </div>

        {!isChat && attachmentCount > 0 && (
          <div className="px-3 pb-2">
            <div className="flex flex-wrap gap-2">
              {attachmentItems.map((item, idx) => (
                <div key={`${item.previewUrl}-${idx}`} className="relative w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted/40">
                  <img src={item.previewUrl || item.remoteUrl} alt={`attachment-${idx + 1}`} className="w-full h-full object-cover" />
                  {item.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center">
                      업로드 중
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div className="absolute inset-0 bg-destructive/70 text-destructive-foreground text-[10px] flex items-center justify-center">
                      실패
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachmentItem(sessionId, idx)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="첨부 이미지 삭제"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 아래쪽: 모델 + 설정 (펼침) */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-0 border-t border-border/50 [&_select]:min-h-0 [&_select]:h-9 [&_select]:py-1.5 [&_select]:min-w-[160px]">
          <ModelSelector
            kind={currentSession.kind}
            value={isChat ? chatModel : imageModel}
            onChange={isChat ? (m) => setChatModel(currentSession.id, m) : (m) => setImageModel(currentSession.id, m)}
          />
          {!isChat && modelSettings && imageSettings && (
            <>
              <button
                type="button"
                onClick={() => setImageSettingsOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-200"
              >
                <Settings2 size={16} />
                설정
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ease-out ${imageSettingsOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`grid w-full transition-[grid-template-rows] duration-200 ease-out ${
                  imageSettingsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 pl-0 pt-2">
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>비율</span>
                    <select
                      value={imageSettings.aspect_ratio}
                      onChange={(e) => setImageSettings(currentSession.id, { aspect_ratio: e.target.value })}
                      className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {modelSettings.aspectRatios.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>생성 수</span>
                    <select
                      value={imageSettings.num_images}
                      onChange={(e) => setImageSettings(currentSession.id, { num_images: Number(e.target.value) })}
                      className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {Array.from({ length: modelSettings.numImagesMax }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  {modelSettings.resolutions && modelSettings.resolutions.length > 0 && (
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>해상도</span>
                      <select
                        value={imageSettings.resolution ?? ''}
                        onChange={(e) => setImageSettings(currentSession.id, { resolution: e.target.value || undefined })}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {modelSettings.resolutions.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {modelSettings.outputFormats && modelSettings.outputFormats.length > 0 && (
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>포맷</span>
                      <select
                        value={imageSettings.output_format ?? ''}
                        onChange={(e) => setImageSettings(currentSession.id, { output_format: e.target.value || undefined })}
                        className="bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {modelSettings.outputFormats.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {modelSettings.supportsSeed && (
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <span>Seed</span>
                      <input
                        type="number"
                        value={imageSettings.seed ?? ''}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setImageSettings(currentSession.id, { seed: v === '' ? undefined : Number(v) });
                        }}
                        placeholder="—"
                        className="w-20 bg-muted/50 border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                  )}
                  </div>
                </div>
              </div>
            </>
          )}
          {!isChat && modelInfoLines.length > 0 && (
            <div className="w-full flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <Info size={14} className="mt-0.5" />
              <div className="flex flex-col gap-1">
                {modelInfoLines.map((line) => (
                  <p key={line}>- {line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
