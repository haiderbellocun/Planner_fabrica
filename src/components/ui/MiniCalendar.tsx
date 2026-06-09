import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarEvent {
  id: string;
  date: string; // 'YYYY-MM-DD'
  label: string;
  color?: string; // tailwind bg class e.g. 'bg-teal-500'
  onClick?: () => void;
}

interface MiniCalendarProps {
  events: CalendarEvent[];
  className?: string;
}

const MONTH_NAMES = [
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
];
const DOW = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MiniCalendar({ events, className }: MiniCalendarProps) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const cells = getMonthGrid(year, month);
  const todayKey = toKey(today);

  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  }

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className={cn('w-full rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          onClick={prevMonth}
          className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="text-3xl font-black tracking-widest text-slate-800 select-none">
          {MONTH_NAMES[month]} {year}
        </h2>

        <button
          onClick={nextMonth}
          className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* ── Day-of-week row ── */}
      <div className="grid grid-cols-7 px-2 pb-1">
        {DOW.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* ── Weeks ── */}
      <div className="px-2 pb-4">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) {
                return <div key={`empty-${wi}-${di}`} className="h-14" />;
              }

              const key = toKey(day);
              const isToday = key === todayKey;
              const dayEvents = byDate[key] ?? [];

              return (
                <div key={key} className="h-14 flex flex-col items-center pt-1 gap-0.5">
                  {/* Day number */}
                  <span
                    className={cn(
                      'h-8 w-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors',
                      isToday
                        ? 'ring-2 ring-blue-400 text-blue-500 bg-blue-50'
                        : 'text-slate-700 hover:bg-slate-100 cursor-default',
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots / chips */}
                  {dayEvents.length > 0 && (
                    <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                      {dayEvents.slice(0, 1).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={ev.onClick}
                          title={ev.label}
                          className={cn(
                            'w-full max-w-[90%] text-center text-[10px] font-medium px-1 py-0 rounded-md truncate text-white leading-tight transition-opacity hover:opacity-80',
                            ev.color ?? 'bg-teal-500',
                            !ev.onClick && 'cursor-default',
                          )}
                        >
                          {ev.label}
                        </button>
                      ))}
                      {dayEvents.length > 1 && (
                        <span className="text-[9px] text-slate-400">+{dayEvents.length - 1}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
