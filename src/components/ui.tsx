"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { STATUS_META, type RideStatus } from "@/lib/types";

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "nova" | "ghost" | "danger" | "success" | "outline";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-pulse-500 text-night-950 hover:bg-pulse-400 shadow-[0_8px_24px_rgba(61,155,255,0.35)] disabled:hover:bg-pulse-500",
  nova: "bg-nova-500 text-white hover:bg-nova-400 shadow-[0_8px_24px_rgba(139,92,246,0.3)]",
  ghost: "bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10",
  outline: "bg-transparent text-pulse-300 border border-pulse-500/50 hover:bg-pulse-500/10",
  danger: "bg-stop-500/90 text-white hover:bg-stop-400",
  success: "bg-go-500 text-night-950 hover:bg-go-400 shadow-[0_8px_24px_rgba(16,185,129,0.3)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ---------------------------------- Cards --------------------------------- */

export function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass-soft rounded-xl ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  accent = "pulse",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "pulse" | "nova" | "go" | "warn" | "stop";
}) {
  const accents: Record<string, string> = {
    pulse: "text-pulse-400",
    nova: "text-nova-400",
    go: "text-go-400",
    warn: "text-warn-400",
    stop: "text-stop-400",
  };
  return (
    <GlassCard className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold ${accents[accent]}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </GlassCard>
  );
}

/* ---------------------------------- Badge --------------------------------- */

const TONE_CLASSES: Record<string, string> = {
  accent: "bg-pulse-500/15 text-pulse-300 border-pulse-500/30",
  info: "bg-slate-500/15 text-slate-300 border-slate-400/25",
  success: "bg-go-500/15 text-go-400 border-go-500/30",
  warn: "bg-warn-500/15 text-warn-400 border-warn-500/30",
  danger: "bg-stop-500/15 text-stop-400 border-stop-500/30",
  nova: "bg-nova-500/15 text-nova-300 border-nova-500/30",
};

export function Badge({ tone = "info", children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone] ?? TONE_CLASSES.info}`}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: RideStatus }) {
  const meta = STATUS_META[status];
  const dot: Record<string, string> = {
    accent: "bg-pulse-400",
    info: "bg-slate-400",
    success: "bg-go-400",
    warn: "bg-warn-400",
    danger: "bg-stop-400",
  };
  return (
    <Badge tone={meta.tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[meta.tone]} ${meta.tone === "accent" || meta.tone === "warn" ? "animate-pulse" : ""}`} />
      {meta.label}
    </Badge>
  );
}

/* --------------------------------- Inputs --------------------------------- */

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Field({ label, hint, id, className = "", ...rest }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </label>
      <input id={fieldId} className={`input-base ${className}`} {...rest} />
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function SelectField({ label, id, className = "", children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </label>
      <select id={fieldId} className={`input-base appearance-none ${className}`} {...rest}>
        {children}
      </select>
    </div>
  );
}

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border border-pulse-500/30 bg-gradient-to-br from-pulse-600/40 to-nova-500/40 font-display font-bold text-pulse-300"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

/* ---------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" className="absolute inset-0 bg-night-950/70 backdrop-blur-sm" onClick={onClose} />
      <GlassCard className="mt-slide-up relative w-full max-w-md p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </GlassCard>
    </div>
  );
}

/* ------------------------------- Progress bar ------------------------------ */

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ async states ------------------------------- */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400" role="status">
      <Spinner className="h-6 w-6 text-pulse-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-stop-500/25 bg-stop-500/10 px-4 py-8 text-center">
      <p className="text-sm font-medium text-stop-400">{message}</p>
      {onRetry ? (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
      <p className="font-display text-sm font-semibold text-slate-300">{title}</p>
      {body ? <p className="max-w-xs text-xs text-slate-500">{body}</p> : null}
    </div>
  );
}

/* ---------------------------------- Toasts --------------------------------- */

type ToastTone = "info" | "success" | "warn" | "danger";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type ToastListener = (items: ToastItem[]) => void;

const toastState: { items: ToastItem[]; listeners: Set<ToastListener>; nextId: number } = {
  items: [],
  listeners: new Set(),
  nextId: 1,
};

function emitToasts() {
  for (const listener of toastState.listeners) listener([...toastState.items]);
}

export function toast(message: string, tone: ToastTone = "info"): void {
  const item = { id: toastState.nextId++, message, tone };
  toastState.items = [...toastState.items.slice(-3), item];
  emitToasts();
  setTimeout(() => {
    toastState.items = toastState.items.filter((t) => t.id !== item.id);
    emitToasts();
  }, 4200);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const listener: ToastListener = (next) => setItems(next);
    toastState.listeners.add(listener);
    return () => {
      toastState.listeners.delete(listener);
    };
  }, []);

  const toneClass: Record<ToastTone, string> = {
    info: "border-pulse-500/40 text-pulse-300",
    success: "border-go-500/40 text-go-400",
    warn: "border-warn-500/40 text-warn-400",
    danger: "border-stop-500/40 text-stop-400",
  };

  return (
    <div aria-live="polite" className="pointer-events-none fixed left-1/2 top-4 z-[1400] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className={`mt-slide-up glass rounded-xl border px-4 py-3 text-sm font-medium ${toneClass[t.tone]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ brand pieces ------------------------------- */

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="font-display font-bold tracking-tight text-slate-100">
      MALTOWN <span className="text-pulse-400">RiDE</span>
      {!compact && <span className="sr-only"> — African mobility platform</span>}
    </span>
  );
}

export function useDebouncedCallback<T extends (...args: never[]) => void>(fn: T, delay: number): T {
  const [state] = useState(() => ({ timer: undefined as ReturnType<typeof setTimeout> | undefined }));
  return useCallback(
    ((...args: Parameters<T>) => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => fn(...args), delay);
    }) as T,
    [fn, delay, state],
  );
}
