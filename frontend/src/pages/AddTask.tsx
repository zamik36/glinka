import React, { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { Task } from '../types';
import { FiUploadCloud, FiX, FiFile, FiCheck } from 'react-icons/fi';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const toLocalDatetime = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ─── Stable style constants — never recreated ────────────────────────────────

const dropZoneBase: React.CSSProperties = {
  cursor: 'pointer',
  borderRadius: 16,
  padding: '20px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

// ─── CharCounter — only re-renders on text.length change ─────────────────────

const CharCounter = memo<{ length: number }>(function CharCounter({ length }) {
  const percent = Math.min((length / 2000) * 100, 100);
  const isNearLimit = percent > 90;
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
      <svg width="18" height="18" className="-rotate-90">
        <circle cx="9" cy="9" r="7" fill="none" stroke="#F3F0FF" strokeWidth="2" />
        <circle
          cx="9" cy="9" r="7" fill="none"
          stroke={isNearLimit ? '#EF4444' : '#6C5CE7'}
          strokeWidth="2"
          strokeDasharray={`${(percent / 100) * 44} 44`}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] font-medium" style={{ color: isNearLimit ? '#EF4444' : 'var(--text-muted)' }}>
        {length}/2000
      </span>
    </div>
  );
});

// ─── FileItem — only re-renders when its own file changes ────────────────────

interface FileItemProps {
  file: File;
  index: number;
  previewUrl: string | undefined;
  onRemove: (index: number) => void;
}

const FileItem = memo<FileItemProps>(function FileItem({ file, index, previewUrl, onRemove }) {
  const isImage = file.type.startsWith('image/');
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{ background: '#FAFAFE', border: '1px solid var(--border-light)' }}
    >
      {isImage && previewUrl ? (
        <img src={previewUrl} alt={file.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F3F0FF' }}>
          <FiFile style={{ color: '#6C5CE7' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: '#FEF2F2' }}
      >
        <FiX className="text-xs" style={{ color: '#EF4444' }} />
      </button>
    </motion.div>
  );
});

// ─── DeadlineField — never re-renders on text changes ────────────────────────

interface DeadlineFieldProps {
  value: string;
  onChange: (v: string) => void;
}

const DeadlineField = memo<DeadlineFieldProps>(function DeadlineField({ value, onChange }) {
  return (
    <div className="animate-field-in" style={{ animationDelay: '0.08s' }}>
      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
        Дедлайн
      </label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </div>
  );
});

// ─── DropZone — never re-renders on text/deadline changes ─────────────────────

interface DropZoneProps {
  isDragOver: boolean;
  fileCount: number;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

const DropZone = memo<DropZoneProps>(function DropZone({ isDragOver, fileCount, onDragOver, onDragLeave, onDrop, onClick }) {
  return (
    <div className="animate-field-in" style={{ animationDelay: '0.13s' }}>
      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
        Файлы <span className="normal-case font-normal">(до {MAX_FILES}, макс 10 МБ)</span>
      </label>
      <motion.div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        style={{
          ...dropZoneBase,
          border: `2px dashed ${isDragOver ? '#6C5CE7' : '#E5E0FF'}`,
          background: isDragOver ? '#F3F0FF' : '#FAFAFE',
        }}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#F3F0FF' }}>
          <FiUploadCloud className="text-xl" style={{ color: '#6C5CE7' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {fileCount > 0 ? `${fileCount} файл(ов) добавлено` : 'Нажми или перетащи файлы'}
        </p>
      </motion.div>
    </div>
  );
});

// ─── AddTask — main component ─────────────────────────────────────────────────

type Props = {
  onSuccess: () => void;
  onClose?: () => void;
  editTask?: Task | null;
};

export const AddTask: React.FC<Props> = ({ onSuccess, onClose, editTask }) => {
  const isEditMode = !!editTask;
  const [text, setText]           = useState(editTask?.text ?? '');
  const [deadline, setDeadline]   = useState(editTask ? toLocalDatetime(editTask.deadline) : '');
  const [files, setFiles]         = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tg, hapticFeedback } = useTelegram();

  // Stable handlers — never recreated between keystrokes
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value.slice(0, 2000));
  }, []);

  const handleDeadlineChange = useCallback((v: string) => setDeadline(v), []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) { tg.showAlert(`Файл ${f.name} больше 10 МБ`); continue; }
      valid.push(f);
    }
    setFiles(prev => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        tg.showAlert(`Максимум ${MAX_FILES} файлов`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, [tg]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);
  const handleDropZoneClick = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !deadline) return tg.showAlert('Заполни все поля');
    try {
      setIsSubmitting(true);
      const utcDate = new Date(deadline).toISOString();
      if (isEditMode && editTask) {
        await api.updateTask(editTask.id, { text, deadline: utcDate });
      } else {
        await api.createTask({ text, deadline: utcDate, files: files.length > 0 ? files : undefined });
      }
      hapticFeedback();
      tg.showAlert('Сохранено!');
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      tg.showAlert(`Ошибка: ${message}`);
      console.error('Task save failed:', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [text, deadline, isEditMode, editTask, files, hapticFeedback, tg, onSuccess]);

  // Preview URLs for image files
  const previewUrls = useMemo(
    () => files.filter(f => f.type.startsWith('image/')).map(f => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );
  useEffect(() => () => { previewUrls.forEach(p => URL.revokeObjectURL(p.url)); }, [previewUrls]);
  const getPreviewUrl = useCallback((file: File) => previewUrls.find(p => p.file === file)?.url, [previewUrls]);

  return (
    <div className="px-5 pb-8 pt-2">
      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isEditMode ? '✏️' : '📝'}</span>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEditMode ? 'Редактировать' : 'Новое задание'}
          </h2>
        </div>
        {onClose && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: '#F3F0FF' }}
          >
            <FiX className="text-sm" style={{ color: '#6C5CE7' }} />
          </motion.button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Text field — animates in via CSS, re-renders on keystroke (expected) */}
        <div className="animate-field-in">
          <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Описание
          </label>
          <div className="relative">
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder="Что нужно сделать..."
              maxLength={2000}
              className="input-field resize-none h-28"
            />
            {/* Isolated — only this re-renders on keystroke */}
            <CharCounter length={text.length} />
          </div>
        </div>

        {/* Deadline — memoized, does NOT re-render on text change */}
        <DeadlineField value={deadline} onChange={handleDeadlineChange} />

        {/* Drop zone — memoized */}
        <DropZone
          isDragOver={isDragOver}
          fileCount={files.length}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* File list — each item memoized */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
              {files.map((file, i) => (
                <FileItem
                  key={`${file.name}-${file.size}-${i}`}
                  file={file}
                  index={i}
                  previewUrl={getPreviewUrl(file)}
                  onRemove={removeFile}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="btn-gradient mt-1 flex items-center justify-center gap-2 animate-field-in"
          style={{ animationDelay: '0.18s' }}
        >
          {isSubmitting ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
              Сохранение...
            </>
          ) : (
            <>
              <FiCheck className="text-lg" strokeWidth={3} />
              {isEditMode ? 'Обновить' : 'Сохранить'}
            </>
          )}
        </motion.button>
      </form>
    </div>
  );
};
