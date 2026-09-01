// ============================================================
// Confirmation dialogs.
//
// Six destructive actions used window.confirm(), which renders an OS dialog
// naming localhost, cannot say what is about to be deleted in any useful
// detail, and looks nothing like the rest of the product. It also blocks the
// event loop, which makes it unusable in an automated walkthrough.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Delete key?', danger: true }))) return;
//
// Resolves true or false. Escape and the backdrop both resolve false, so a
// caller that ignores the result still cannot destroy anything by accident.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  /** Optional second line. Say what will be lost, not "are you sure". */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for anything that destroys data. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  // Falling back to window.confirm keeps a component usable outside the
  // provider (tests, storybook) instead of throwing.
  return ctx || (async (o: ConfirmOptions) => window.confirm(o.body ? `${o.title}\n\n${o.body}` : o.title));
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => settle(false)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title}
            className="relative w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl p-5"
          >
            <div className="text-[15px] font-semibold text-gray-900">{pending.title}</div>
            {pending.body && (
              <div className="text-[13px] text-gray-600 mt-1.5 leading-relaxed">{pending.body}</div>
            )}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => settle(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                {pending.cancelLabel || 'Cancel'}
              </button>
              <button
                ref={confirmButtonRef}
                onClick={() => settle(true)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  pending.danger
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {pending.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
