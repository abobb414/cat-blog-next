'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';

/**
 * 替代原生 <input type="datetime-local">。
 *
 * 原生控件的弹层是浏览器 shadow DOM：强制系统字体、Google 蓝的选中色、
 * 直角深阴影，样式完全改不动，跟这套米白/暖橙的版式放在一起极不协调。
 * 这里用设计令牌重绘一份，取值格式仍是 'YYYY-MM-DDTHH:mm'（本地时间），
 * 与原有 state / 接口完全兼容。
 *
 * 面板用 fixed 定位 + 视口边界修正，因此不受父级 overflow-hidden 裁剪
 * （动态卡片的 article 正是 overflow-hidden）。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const PANEL_W = 296;
const PANEL_H = 400;
/** 分钟步进 —— 5 分钟粒度，避免点十几次才到目标分钟 */
const MINUTE_STEP = 5;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function parseDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})/.exec(value || '');
  if (!m) return new Date();
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function toDateTimeValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function displayText(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function DateTimePicker({
  value,
  onChange,
  tone = 'brand',
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 新增表单用暖色描边、编辑表单用中性描边，与两处原有样式保持一致 */
  tone?: 'brand' | 'neutral';
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [cursor, setCursor] = useState(() => {
    const d = parseDateTime(value);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = parseDateTime(value);
  const today = new Date();

  // ---- 打开 / 关闭 ----
  /** 把一个 fixed 面板贴到按钮下方（空间不足则翻到上方），并夹进视口。
   *  返回 false 表示按钮已完全滚出视口，面板没有可依附的位置了。 */
  const positionFor = useCallback((el: HTMLElement): boolean => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return false;
    const w = panelRef.current?.offsetWidth || PANEL_W;
    const h = panelRef.current?.offsetHeight || PANEL_H;
    const left = Math.min(Math.max(12, r.left), Math.max(12, vw - w - 12));
    let top = r.bottom + 8;
    if (top + h > vh - 12) {
      const above = r.top - h - 8;
      top = above >= 12 ? above : Math.max(12, vh - h - 12);
    }
    setPos({ top, left });
    return true;
  }, []);

  const openPanel = () => {
    const el = btnRef.current;
    if (!el) return;
    const d = parseDateTime(value);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setOpen(true);
    positionFor(el);
    // 点开这一下常常伴随页面滚动（浏览器会把按钮滚进视口），
    // 下一帧面板已渲染，用它的真实尺寸再校准一次位置
    requestAnimationFrame(() => {
      if (btnRef.current) positionFor(btnRef.current);
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // 面板是 fixed，页面一滚就会跟按钮脱节 —— 所以滚动时重新贴合，
    // 而不是直接关掉（点击按钮自身就可能触发滚动，关掉会表现为"点了没反应"）
    let raf = 0;
    const reposition = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = btnRef.current;
        if (!el || !positionFor(el)) setOpen(false);
      });
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, positionFor]);

  // ---- 操作 ----
  const commit = (d: Date) => onChange(toDateTimeValue(d));

  const pickDay = (day: Date) => {
    commit(new Date(day.getFullYear(), day.getMonth(), day.getDate(), selected.getHours(), selected.getMinutes()));
    setCursor({ y: day.getFullYear(), m: day.getMonth() });
  };

  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const shiftTime = (unit: 'h' | 'm', delta: number) => {
    const d = new Date(selected);
    if (unit === 'h') d.setHours(d.getHours() + delta);
    else d.setMinutes(d.getMinutes() + delta);
    commit(d);
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    commit(new Date(now.getFullYear(), now.getMonth(), now.getDate(), selected.getHours(), selected.getMinutes()));
  };

  // ---- 网格（固定 6 行 × 7 列，避免翻月时面板高度跳动）----
  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const gridStart = new Date(cursor.y, cursor.m, 1 - firstOfMonth.getDay());
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );

  const fieldTone =
    tone === 'brand'
      ? 'border-brand-tint hover:border-brand-soft'
      : 'border-line hover:border-brand-soft';

  const ringTone = open ? 'ring-2 ring-brand/35 border-brand-soft' : '';

  const stepperBtn =
    'w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-ink-soft transition-colors hover:bg-brand-tint hover:text-brand-deep active:scale-95';

  return (
    <div className="w-full">
      <button
        ref={btnRef}
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 bg-surface px-3 py-2.5 rounded-xl border text-meta text-left transition-colors ${fieldTone} ${ringTone}`}
      >
        <Calendar className="w-4 h-4 text-brand shrink-0" />
        <span className="flex-1 truncate tabular-nums text-ink">{displayText(selected)}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="选择发布日期"
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          className="fixed z-[70] bg-surface border border-line rounded-2xl shadow-xl shadow-ink/5 p-3 select-none"
        >
          {/* 头部：翻月 + 今天 */}
          <div className="flex items-center gap-1 mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月" className={stepperBtn}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月" className={stepperBtn}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center text-meta font-semibold text-ink tabular-nums">
              {cursor.y} 年 {cursor.m + 1} 月
            </span>
            <button
              type="button"
              onClick={goToday}
              className="px-2 py-1 rounded-lg text-tiny font-medium text-brand transition-colors hover:bg-brand-tint"
            >
              今天
            </button>
          </div>

          {/* 星期表头 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="h-6 flex items-center justify-center text-tiny text-ink-faint">
                {w}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((d) => {
              const isSelected = sameDay(d, selected);
              const isToday = sameDay(d, today);
              const outside = d.getMonth() !== cursor.m;
              const base =
                'h-9 rounded-lg flex items-center justify-center text-meta tabular-nums transition-colors';
              const state = isSelected
                ? 'bg-brand text-white font-semibold shadow-sm shadow-brand/25'
                : outside
                  ? 'text-ink-faint hover:bg-mist'
                  : 'text-ink hover:bg-brand-tint';
              const todayRing = !isSelected && isToday ? 'ring-1 ring-brand-soft' : '';
              return (
                <button
                  key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                  type="button"
                  onClick={() => pickDay(d)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`${base} ${state} ${todayRing}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* 时间 */}
          <div className="mt-2 pt-2 border-t border-line flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftTime('h', -1)} aria-label="减一小时" className={stepperBtn}>
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-body font-semibold text-ink tabular-nums">
                {pad2(selected.getHours())}
              </span>
              <button type="button" onClick={() => shiftTime('h', 1)} aria-label="加一小时" className={stepperBtn}>
                <Plus className="w-3.5 h-3.5" />
              </button>

              <span className="text-ink-faint px-0.5">:</span>

              <button type="button" onClick={() => shiftTime('m', -MINUTE_STEP)} aria-label="减五分钟" className={stepperBtn}>
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-body font-semibold text-ink tabular-nums">
                {pad2(selected.getMinutes())}
              </span>
              <button type="button" onClick={() => shiftTime('m', MINUTE_STEP)} aria-label="加五分钟" className={stepperBtn}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white rounded-lg text-tiny font-medium transition-colors"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
