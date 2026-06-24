/**
 * NotificationToast — Custom toast notification system
 *
 * This module exports:
 *  - useNotify() hook — imperative toast API
 *  - NotificationProvider — Required wrapper component
 *  - NotificationContainer — Renders the toast stack
 *
 * Props/API:
 *  useNotify():
 *    notify.success(message, options?)
 *    notify.error(message, options?)
 *    notify.info(message, options?)
 *    notify.warning(message, options?)
 *    notify.loading(message, options?) → returns id for dismissal
 *    notify.dismiss(id)
 *    notify.promise(promise, { loading, success, error })
 *
 *  Options:
 *    duration   — ms before auto-dismiss (default: 5000, 0 = no auto-dismiss)
 *    description — Optional detail text
 *    action      — { label, onClick } CTA button
 *
 * Usage:
 *  // Wrap app:
 *  <NotificationProvider>
 *    <App />
 *    <NotificationContainer />
 *  </NotificationProvider>
 *
 *  // Inside component:
 *  const notify = useNotify();
 *  notify.success("Resume uploaded!");
 *  notify.error("Upload failed", { description: "Check your connection." });
 *  await notify.promise(uploadFile(), {
 *    loading: "Uploading resume…",
 *    success: "Resume uploaded!",
 *    error: "Upload failed.",
 *  });
 */

import * as React from "react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "warning" | "loading";

interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  action?: ToastAction;
  duration: number;
  createdAt: number;
}

interface NotifyOptions {
  description?: string;
  action?: ToastAction;
  duration?: number;
}

interface NotifyContextValue {
  success: (message: string, options?: NotifyOptions) => string;
  error: (message: string, options?: NotifyOptions) => string;
  info: (message: string, options?: NotifyOptions) => string;
  warning: (message: string, options?: NotifyOptions) => string;
  loading: (message: string, options?: Omit<NotifyOptions, "duration">) => string;
  dismiss: (id: string) => void;
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) },
    options?: NotifyOptions
  ) => Promise<T>;
}

const NotifyContext = React.createContext<NotifyContextValue | null>(null);

let idCounter = 0;
const genId = () => `toast-${Date.now()}-${++idCounter}`;

/* ── Provider ─────────────────────────────────────────────── */
function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const add = React.useCallback((type: ToastType, message: string, options?: NotifyOptions): string => {
    const id = genId();
    const duration = options?.duration ?? (type === "loading" ? 0 : type === "error" ? 7000 : 5000);

    setToasts((prev) => [
      { id, type, message, description: options?.description, action: options?.action, duration, createdAt: Date.now() },
      ...prev,
    ]);

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify: NotifyContextValue = React.useMemo(
    () => ({
      success: (msg, opts) => add("success", msg, opts),
      error: (msg, opts) => add("error", msg, opts),
      info: (msg, opts) => add("info", msg, opts),
      warning: (msg, opts) => add("warning", msg, opts),
      loading: (msg, opts) => add("loading", msg, { ...opts, duration: 0 }),
      dismiss,
      promise: async (promise, messages, opts) => {
        const id = add("loading", messages.loading, { duration: 0 });
        try {
          const result = await promise;
          dismiss(id);
          add("success", typeof messages.success === "function" ? messages.success(result) : messages.success, opts);
          return result;
        } catch (err) {
          dismiss(id);
          add("error", typeof messages.error === "function" ? messages.error(err) : messages.error, opts);
          throw err;
        }
      },
    }),
    [add, dismiss]
  );

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <NotificationContainer toasts={toasts} onDismiss={dismiss} />
    </NotifyContext.Provider>
  );
}

/* ── Hook ─────────────────────────────────────────────────── */
function useNotify(): NotifyContextValue {
  const ctx = React.useContext(NotifyContext);
  if (!ctx) throw new Error("useNotify must be used within <NotificationProvider>");
  return ctx;
}

/* ── Toast Icons ──────────────────────────────────────────── */
const toastConfig: Record<ToastType, { icon: React.ReactNode; cls: string }> = {
  success: {
    cls: "border-success/20 bg-card",
    icon: (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    ),
  },
  error: {
    cls: "border-destructive/20 bg-card",
    icon: (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  },
  info: {
    cls: "border-info/20 bg-card",
    icon: (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      </div>
    ),
  },
  warning: {
    cls: "border-warning/20 bg-card",
    icon: (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
    ),
  },
  loading: {
    cls: "border-border/50 bg-card",
    icon: (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <svg className="h-4 w-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      </div>
    ),
  },
};

/* ── Toast Item ───────────────────────────────────────────── */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const cfg = toastConfig[toast.type];

  return (
    <div
      role="alert"
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
        "transition-all duration-300",
        visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-2 opacity-0 scale-95",
        cfg.cls
      )}
    >
      {cfg.icon}

      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-snug">{toast.message}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-xs font-semibold text-primary hover:underline focus-visible:outline-none"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.type !== "loading" && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className={cn(
            "shrink-0 rounded-md p-0.5 text-muted-foreground",
            "hover:text-foreground hover:bg-muted/60 transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Container ────────────────────────────────────────────── */
function NotificationContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export { NotificationProvider, NotificationContainer, useNotify };
