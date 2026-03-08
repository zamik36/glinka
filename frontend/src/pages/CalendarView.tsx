import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  format,
  subHours,
  addMonths,
  subMonths,
  getDay,
  isPast,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  FiChevronLeft, FiChevronRight,
  FiClock, FiCalendar, FiAlertTriangle, FiCheckCircle,
} from 'react-icons/fi';
import { api } from '../api/client';
import type { Task } from '../types';

// ─── Pure helpers (outside component — never recreated) ───────────────────────

function getMondayIndex(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function taskDotColor(task: Task): string {
  if (task.is_completed) return 'var(--success)';
  if (isPast(new Date(task.deadline))) return 'var(--danger)';
  return 'var(--accent)';
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const EMPTY_DOTS: string[] = [];      // stable empty-array ref for cells with no tasks

// Framer-motion variants — constant, defined once
const SLIDE: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir * -40 }),
};

// ─── DayCell — memoized, re-renders ONLY when its own props change ─────────────
interface DayCellProps {
  day: Date;
  isToday: boolean;
  isSelected: boolean;
  dots: string[];
  onSelect: (day: Date) => void;
}

const DayCell = memo<DayCellProps>(function DayCell({ day, isToday, isSelected, dots, onSelect }) {
  const isWeekend = getMondayIndex(day) >= 5;

  return (
    <motion.button
      whileTap={{ scale: 0.84 }}
      onClick={() => onSelect(day)}
      style={{
        height: 44,
        borderRadius: 12,
        border: 'none',
        background: isSelected
          ? 'linear-gradient(135deg, #6C5CE7, #A29BFE)'
          : isToday
            ? 'rgba(108, 92, 231, 0.1)'
            : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        boxShadow: isSelected
          ? '0 4px 14px rgba(108, 92, 231, 0.4)'
          : isToday
            ? '0 0 0 2px rgba(108, 92, 231, 0.35)'
            : 'none',
      }}
    >
      <span style={{
        fontSize: 13,
        fontWeight: isToday || isSelected ? 700 : isWeekend ? 500 : 400,
        color: isSelected ? '#fff'
          : isToday ? 'var(--accent)'
          : isWeekend ? 'var(--accent-light)'
          : 'var(--text-primary)',
        lineHeight: 1,
      }}>
        {format(day, 'd')}
      </span>

      {dots.length > 0 && (
        <div style={{ display: 'flex', gap: 2 }}>
          {dots.map((color, i) => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: isSelected ? 'rgba(255,255,255,0.85)' : color,
            }} />
          ))}
        </div>
      )}
    </motion.button>
  );
});

// ─── CalendarView ─────────────────────────────────────────────────────────────

export const CalendarView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection]       = useState(0); // -1 prev / +1 next — used in JSX (custom prop)

  useEffect(() => {
    api.getTasks()
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, []);

  // Stable "today" — computed once on mount
  const today    = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // O(N) build → O(1) lookup per cell, recomputed only when tasks change
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const k = toDateKey(new Date(task.deadline));
      const bucket = map.get(k);
      if (bucket) bucket.push(task);
      else map.set(k, [task]);
    }
    return map;
  }, [tasks]);

  // Dot colors per date key — derived from tasksByDate, recomputed only when tasks change
  const dotsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [k, dayTasks] of tasksByDate) {
      map.set(k, dayTasks.slice(0, 3).map(taskDotColor));
    }
    return map;
  }, [tasksByDate]);

  // Calendar grid cells — recomputed only when month changes, not on date selection
  const cells = useMemo<(Date | null)[]>(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd   = endOfMonth(currentMonth);
    const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const leading    = getMondayIndex(monthStart);
    const result: (Date | null)[] = [...Array<null>(leading).fill(null), ...days];
    const trailing = (7 - (result.length % 7)) % 7;
    for (let i = 0; i < trailing; i++) result.push(null);
    return result;
  }, [currentMonth]);

  // Derived string key for selected date — avoids Date comparisons downstream
  const selectedDateKey = selectedDate ? toDateKey(selectedDate) : null;

  // O(1) lookup — recomputed only when selection or tasks change
  const selectedTasks = useMemo(
    () => (selectedDateKey ? (tasksByDate.get(selectedDateKey) ?? []) : []),
    [selectedDateKey, tasksByDate],
  );

  // Stable navigation callbacks
  const goToPrev = useCallback(() => {
    setDirection(-1);
    setCurrentMonth(m => subMonths(m, 1));
    setSelectedDate(null);
  }, []);

  const goToNext = useCallback(() => {
    setDirection(1);
    setCurrentMonth(m => addMonths(m, 1));
    setSelectedDate(null);
  }, []);

  // Stable select handler — functional updater avoids capturing selectedDate
  const handleDaySelect = useCallback((day: Date) => {
    setSelectedDate(prev => (prev && isSameDay(prev, day) ? null : day));
  }, []);

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Calendar Card ─────────────────────────────── */}
      <div style={{
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(108, 92, 231, 0.14)',
      }}>

        {/* Gradient header */}
        <div style={{
          background: 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)',
          padding: '18px 16px 16px',
        }}>
          {/* Month navigator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <motion.button whileTap={{ scale: 0.82 }} onClick={goToPrev} style={navBtnStyle}>
              <FiChevronLeft style={{ color: '#fff', fontSize: 17 }} />
            </motion.button>

            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.h2
                key={currentMonth.toISOString()}
                custom={direction}
                variants={SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{ fontWeight: 700, fontSize: 17, color: '#fff', textTransform: 'capitalize', letterSpacing: 0.2 }}
              >
                {format(currentMonth, 'LLLL yyyy', { locale: ru })}
              </motion.h2>
            </AnimatePresence>

            <motion.button whileTap={{ scale: 0.82 }} onClick={goToNext} style={navBtnStyle}>
              <FiChevronRight style={{ color: '#fff', fontSize: 17 }} />
            </motion.button>
          </div>

          {/* Day-of-week labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DAY_LABELS.map((label, i) => (
              <div key={label} style={{
                textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                color: i >= 5 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)',
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ background: 'var(--surface-elevated)', padding: '12px 10px 16px', overflow: 'hidden' }}>
          {loading ? (
            <SkeletonGrid />
          ) : (
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={currentMonth.toISOString()}
                custom={direction}
                variants={SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}
              >
                {cells.map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`} />;
                  const k = toDateKey(day);
                  return (
                    <DayCell
                      key={day.toISOString()}
                      day={day}
                      isToday={k === todayKey}
                      isSelected={k === selectedDateKey}
                      dots={dotsByDate.get(k) ?? EMPTY_DOTS}
                      onSelect={handleDaySelect}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
      {/* ── End Calendar Card ─────────────────────────── */}

      {/* Tasks section */}
      <div style={{ marginTop: 20 }}>
        <AnimatePresence mode="wait">
          {selectedDate ? (
            <motion.div
              key={selectedDateKey!}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 3, height: 16, borderRadius: 2,
                  background: 'linear-gradient(to bottom, var(--gradient-start), var(--gradient-end))',
                }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {format(selectedDate, 'EEEE, d MMMM', { locale: ru })}
                </h3>
              </div>

              {selectedTasks.length === 0 ? (
                <div style={{
                  background: 'var(--surface-elevated)', borderRadius: 16,
                  padding: '28px 16px', textAlign: 'center',
                  boxShadow: '0 2px 12px rgba(108,92,231,0.06)',
                }}>
                  <FiCalendar style={{ fontSize: 36, color: 'var(--accent-soft)', display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Нет задач на этот день</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedTasks.map((task, i) => (
                    <TaskCard key={task.id} task={task} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 12 }}
            >
              Нажми на дату, чтобы увидеть задачи
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── TaskCard — memoized, re-renders only when task data changes ───────────────

interface TaskCardProps { task: Task; index: number; }

const TaskCard = memo<TaskCardProps>(function TaskCard({ task, index }) {
  const deadline    = useMemo(() => new Date(task.deadline), [task.deadline]);
  const reminderTime = useMemo(() => subHours(deadline, 2), [deadline]);
  const overdue     = !task.is_completed && isPast(deadline);
  const statusColor = task.is_completed ? 'var(--success)' : overdue ? 'var(--danger)' : 'var(--accent)';
  const statusLabel = task.is_completed ? 'Готово' : overdue ? 'Просрочено' : 'Активно';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 2px 16px rgba(108, 92, 231, 0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        borderRadius: '0 2px 2px 0',
        background: statusColor,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <p style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
          textDecoration: task.is_completed ? 'line-through' : 'none',
          opacity: task.is_completed ? 0.55 : 1,
          wordBreak: 'break-word', flex: 1, lineHeight: 1.4,
        }}>
          {task.text}
        </p>

        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
          color: statusColor, background: `${statusColor}18`,
          borderRadius: 6, padding: '3px 7px',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {task.is_completed
            ? <FiCheckCircle style={{ fontSize: 10 }} />
            : overdue
              ? <FiAlertTriangle style={{ fontSize: 10 }} />
              : <FiClock style={{ fontSize: 10 }} />
          }
          {statusLabel}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        <TimeBlock
          icon={overdue ? <FiAlertTriangle style={{ fontSize: 11, color: 'var(--danger)' }} /> : <FiClock style={{ fontSize: 11, color: 'var(--accent)' }} />}
          iconBg={overdue ? 'rgba(239,68,68,0.1)' : 'rgba(108,92,231,0.1)'}
          label="Дедлайн"
          time={format(deadline, 'HH:mm')}
          timeColor={overdue ? 'var(--danger)' : 'var(--text-primary)'}
        />

        {!task.is_completed && (
          <>
            <div style={{ width: 1, background: 'var(--border-light)', alignSelf: 'stretch' }} />
            <TimeBlock
              icon={<FiClock style={{ fontSize: 11, color: 'var(--text-muted)' }} />}
              iconBg="rgba(108,92,231,0.06)"
              label="Напоминание"
              time={format(reminderTime, 'HH:mm')}
              timeColor="var(--text-secondary)"
            />
          </>
        )}
      </div>
    </motion.div>
  );
});

// ─── Small presentational components ─────────────────────────────────────────

function TimeBlock({ icon, iconBg, label, time, timeColor }: {
  icon: React.ReactNode; iconBg: string;
  label: string; time: string; timeColor: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: timeColor }}>{time}</div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {Array.from({ length: 35 }, (_, i) => (
        <div key={i} style={{
          height: 44, borderRadius: 10,
          background: 'linear-gradient(90deg, #f0eeff 25%, #f8f7ff 50%, #f0eeff 75%)',
          backgroundSize: '400px 100%',
          animation: 'shimmer 1.4s infinite',
        }} />
      ))}
    </div>
  );
}

// Shared style object for nav buttons (prevents inline object creation per render)
const navBtnStyle: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10,
  background: 'rgba(255,255,255,0.18)',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.25)',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
