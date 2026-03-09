import React, { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import type { Task } from '../types';
import { FiUploadCloud, FiX, FiFile, FiCheck, FiBell, FiPlus } from 'react-icons/fi';

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

const formatReminderLabel = (iso: string): string => {
  try { return format(new Date(iso), 'd MMM, HH:mm', { locale: ru }); }
  catch { return iso; }
};

// ─── Stable style constants ───────────────────────────────────────────────────

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

// ─── CharCounter ──────────────────────────────────────────────────────────────

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

// ─── FileItem ─────────────────────────────────────────────────────────────────

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

// ─── DeadlineField ────────────────────────────────────────────────────────────

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

// ─── DropZone ─────────────────────────────────────────────────────────────────

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

// ─── ReminderPicker ───────────────────────────────────────────────────────────

interface ReminderPickerProps {
  deadline: string;
  reminders: string[];
  onChange: (reminders: string[]) => void;
}

const ReminderPicker = memo<ReminderPickerProps>(function ReminderPicker({ deadline, reminders, onChange }) {
  const [customValue, setCustomValue] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const deadlineDate = useMemo(() => (deadline ? new Date(deadline) : null), [deadline]);

  // Presets: 2 days and 1 day before deadline at 15:00
  const presets = useMemo(() => {
    if (!deadlineDate) return [];
    const now = new Date();
    return [2, 1].map(days => {
      const d = new Date(deadlineDate);
      d.setDate(d.getDate() - days);
      d.setHours(15, 0, 0, 0);
      const iso = d.toISOString();
      const isPast = d <= now;
      const isSelected = reminders.some(r => {
        const diff = Math.abs(new Date(r).getTime() - d.getTime());
        return diff < 60_000;
      });
      return { label: `За ${days} ${days === 1 ? 'день' : 'дня'}`, iso, isPast, isSelected };
    });
  }, [deadlineDate, reminders]);

  const togglePreset = useCallback((iso: string, isSelected: boolean) => {
    const presetMs = new Date(iso).getTime();
    if (isSelected) {
      onChange(reminders.filter(r => Math.abs(new Date(r).getTime() - presetMs) >= 60_000));
    } else {
      onChange([...reminders, iso]);
    }
  }, [reminders, onChange]);

  const removeReminder = useCallback((iso: string) => {
    onChange(reminders.filter(r => r !== iso));
  }, [reminders, onChange]);

  const handleAddCustom = useCallback(() => {
    if (!customValue) return;
    const d = new Date(customValue);
    if (isNaN(d.getTime())) return;
    const iso = d.toISOString();
    if (!reminders.includes(iso)) onChange([...reminders, iso]);
    setCustomValue('');
    setShowCustom(false);
  }, [customValue, reminders, onChange]);

  const handleCustomKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); }
  }, [handleAddCustom]);

  return (
    <div className="animate-field-in" style={{ animationDelay: '0.11s' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, background: 'rgba(108,92,231,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FiBell size={12} style={{ color: '#6C5CE7' }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Напоминания
        </span>
      </div>

      {/* Card body */}
      <div style={{
        background: 'linear-gradient(145deg, #FAFAFE 0%, #F7F4FF 100%)',
        borderRadius: 16,
        border: '1px solid rgba(108,92,231,0.12)',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>

        {/* Quick presets */}
        {deadlineDate ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presets.map(preset => (
              <motion.button
                key={preset.label}
                type="button"
                whileTap={{ scale: preset.isPast ? 1 : 0.93 }}
                disabled={preset.isPast}
                onClick={() => togglePreset(preset.iso, preset.isSelected)}
                style={{
                  padding: '7px 13px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  border: preset.isSelected
                    ? '1.5px solid rgba(108,92,231,0.55)'
                    : '1.5px solid rgba(108,92,231,0.18)',
                  background: preset.isSelected
                    ? 'linear-gradient(135deg, rgba(108,92,231,0.18) 0%, rgba(162,155,254,0.14) 100%)'
                    : 'rgba(108,92,231,0.05)',
                  color: preset.isPast ? '#C4B5FD' : preset.isSelected ? '#5B4CC8' : '#8B7DD8',
                  cursor: preset.isPast ? 'not-allowed' : 'pointer',
                  opacity: preset.isPast ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: preset.isSelected ? '0 2px 8px rgba(108,92,231,0.15)' : 'none',
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {preset.isSelected ? (
                    <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <FiCheck size={10} strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <motion.span key="bell" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <FiBell size={10} />
                    </motion.span>
                  )}
                </AnimatePresence>
                {preset.label}
                {preset.isPast && <span style={{ fontSize: 10, opacity: 0.7 }}>· прошло</span>}
              </motion.button>
            ))}

            {/* Custom time toggle */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={() => setShowCustom(v => !v)}
              style={{
                padding: '7px 13px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: showCustom
                  ? '1.5px solid rgba(108,92,231,0.55)'
                  : '1.5px dashed rgba(108,92,231,0.3)',
                background: showCustom ? 'rgba(108,92,231,0.1)' : 'transparent',
                color: showCustom ? '#6C5CE7' : '#A29BFE',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <motion.span
                animate={{ rotate: showCustom ? 45 : 0 }}
                transition={{ duration: 0.18 }}
              >
                <FiPlus size={11} strokeWidth={3} />
              </motion.span>
              Своё время
            </motion.button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C4B5FD', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: '#A29BFE' }}>Укажи дедлайн, чтобы настроить напоминания</p>
          </div>
        )}

        {/* Custom datetime input */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                <input
                  type="datetime-local"
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  onKeyDown={handleCustomKeyDown}
                  className="input-field flex-1"
                  style={{ fontSize: 13, padding: '9px 12px' }}
                />
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={handleAddCustom}
                  disabled={!customValue}
                  style={{
                    padding: '9px 15px',
                    borderRadius: 12,
                    background: customValue
                      ? 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))'
                      : 'rgba(108,92,231,0.08)',
                    color: customValue ? '#fff' : '#C4B5FD',
                    border: 'none',
                    cursor: customValue ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    boxShadow: customValue ? '0 3px 10px rgba(108,92,231,0.3)' : 'none',
                  }}
                >
                  Добавить
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected reminders list */}
        <AnimatePresence>
          {reminders.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <div style={{ height: 1, background: 'rgba(108,92,231,0.08)', borderRadius: 1 }} />
              {reminders.map(iso => (
                <motion.div
                  key={iso}
                  layout
                  initial={{ opacity: 0, x: -14, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 14, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 11,
                    background: 'rgba(108,92,231,0.07)',
                    border: '1px solid rgba(108,92,231,0.14)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: '#5B4CC8' }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 7,
                      background: 'rgba(108,92,231,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <FiBell size={10} style={{ color: '#6C5CE7' }} />
                    </span>
                    {formatReminderLabel(iso)}
                  </span>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.88 }}
                    onClick={() => removeReminder(iso)}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', border: 'none',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#EF4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <FiX size={10} />
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auto-reminder hint */}
        <AnimatePresence>
          {reminders.length === 0 && deadlineDate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 6,
                background: 'rgba(162,155,254,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FiBell size={9} style={{ color: '#A29BFE' }} />
              </span>
              <p style={{ fontSize: 11, color: '#A29BFE', lineHeight: 1.4 }}>
                Авто-напоминание за 1–2 дня до дедлайна
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
  const [reminders, setReminders] = useState<string[]>([]);
  const [files, setFiles]         = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tg, hapticFeedback } = useTelegram();

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value.slice(0, 2000));
  }, []);

  const handleDeadlineChange = useCallback((v: string) => setDeadline(v), []);
  const handleRemindersChange = useCallback((r: string[]) => setReminders(r), []);

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

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
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
      const reminder_at = reminders.length > 0 ? reminders : undefined;
      if (isEditMode && editTask) {
        await api.updateTask(editTask.id, { text, deadline: utcDate, reminder_at });
      } else {
        await api.createTask({ text, deadline: utcDate, files: files.length > 0 ? files : undefined, reminder_at });
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
  }, [text, deadline, reminders, isEditMode, editTask, files, hapticFeedback, tg, onSuccess]);

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
        {/* Text */}
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
            <CharCounter length={text.length} />
          </div>
        </div>

        {/* Deadline */}
        <DeadlineField value={deadline} onChange={handleDeadlineChange} />

        {/* Reminders */}
        <ReminderPicker deadline={deadline} reminders={reminders} onChange={handleRemindersChange} />

        {/* Drop zone */}
        <DropZone
          isDragOver={isDragOver}
          fileCount={files.length}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
        />

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

        {/* File list */}
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
