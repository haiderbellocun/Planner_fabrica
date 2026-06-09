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

  // Index events by date key
  const byDate: Record<string, CalendarEvent[]> = {};
  for (const ev of events) {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  }

  // Split into weeks
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className={cn(
      'w-full rounded-2xl bg-white border border-slate-200 shadow-md overflow-hidden',
      className
    )}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
        <button
          onClick={prevMonth}
          className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-extrabold tracking-widest text-slate-700 select-none">
          {MONTH_NAMES[month]} {year}
        </h2>

        <button
          onClick={nextMonth}
          className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* ── Day-of-week row ── */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {DOW.map((d) => (
          <div key={d} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* ── Weeks ── */}
      <div className="divide-y divide-slate-100">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-slate-100">
            {week.map((day, di) => {
              if (!day) {
                return <div key={`empty-${wi}-${di}`} className="min-h-[80px] bg-slate-50/40" />;
              }

              const key = toKey(day);
              const isToday = key === todayKey;
              const dayEvents = byDate[key] ?? [];

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[80px] p-2 flex flex-col gap-1',
                    isToday && 'bg-blue-50/60',
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      'self-start h-7 w-7 flex items-center justify-center rounded-full text-sm font-semibold',
                      isToday
                        ? 'bg-blue-400 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Events */}
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={ev.onClick}
                        title={ev.label}
                        className={cn(
                          'w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded-md truncate text-white leading-tight transition-opacity hover:opacity-80',
                          ev.color ?? 'bg-primary',
                          !ev.onClick && 'cursor-default',
                        )}
                      >
                        {ev.label}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-slate-400 pl-1">
                        +{dayEvents.length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
