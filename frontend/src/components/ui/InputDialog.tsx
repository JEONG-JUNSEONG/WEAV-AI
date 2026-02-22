import React, { useEffect, useRef, useState } from 'react';

export type InputDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function InputDialog({
  open,
  title,
  message,
  placeholder = '입력하세요',
  defaultValue = '',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      confirmingRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const runConfirmOnce = (val: string) => {
    if (confirmingRef.current || !val.trim()) return;
    confirmingRef.current = true;
    onConfirm(val.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      e.stopPropagation();
      runConfirmOnce(value.trim());
    }
  };

  const handleConfirm = () => {
    runConfirmOnce(value);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/78 p-4 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdrop}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="input-dialog-title"
      aria-describedby="input-dialog-desc"
    >
      <div
        className="bg-card/90 border border-border/65 rounded-xl max-w-sm w-full p-5 backdrop-blur-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="input-dialog-title" className="text-lg font-semibold text-foreground mb-2">
          {title}
        </h2>
        {message && (
          <p id="input-dialog-desc" className="text-sm text-muted-foreground mb-4">
            {message}
          </p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 mb-5 rounded-xl bg-secondary/55 border border-border/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-200"
        />
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border/70 bg-secondary/55 text-muted-foreground hover:bg-secondary/75 font-medium transition-colors duration-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-xl border border-primary/45 bg-primary/20 text-foreground font-medium transition-colors duration-200 hover:bg-primary/26 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
