"use client";
import { useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Accessible modal wrapper.
 *
 * - role="dialog" + aria-modal + aria-labelledby
 * - Esc key closes
 * - Body scroll lock while open
 * - Focus is moved into the dialog on open and restored on close
 *
 * Existing modals throughout the app use ad-hoc divs; new modals SHOULD use
 * this component. Migration of legacy modals is incremental.
 */
export function Modal({
  open, onClose, title, children, maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    // Focus first focusable child
    const first = ref.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 id={titleId} className="font-bold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="text-slate-400 hover:text-slate-700 rounded p-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
