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
//
// Some questions have more than two answers. useChoice takes the options
// and resolves the chosen value, or null on Escape, backdrop or Cancel:
//
//   const choose = useChoice();
//   const mode = await choose({ title, options: [{ value: 'a', label: 'A', primary: true }, ...] });
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

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** The filled button, and the one Enter picks. One per dialog. */
  primary?: boolean;
}

export interface ChoiceOptions<T extends string> {
  title: string;
  body?: string;
  options: ChoiceOption<T>[];
  cancelLabel?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
type ChoiceFn = <T extends string>(options: ChoiceOptions<T>) => Promise<T | null>;

interface Dialog {
  confirm: ConfirmFn;
  choose: ChoiceFn;
}

const ConfirmContext = createContext<Dialog | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  // Falling back to window.confirm keeps a component usable outside the
  // provider (tests, storybook) instead of throwing.
  return ctx ? ctx.confirm : async (o: ConfirmOptions) => window.confirm(o.body ? `${o.title}\n\n${o.body}` : o.title);
}

export function useChoice(): ChoiceFn {
  const ctx = useContext(ConfirmContext);
  // Outside the provider there is no way to offer three answers, so the
  // fallback takes the primary option. Callers put the safe answer there.
  return ctx
    ? ctx.choose
    : async <T extends string>(o: ChoiceOptions<T>) => (o.options.find((x) => x.primary) || o.options[0]).value;
}

interface Button {
  value: string;
  label: string;
  primary: boolean;
  danger: boolean;
}

interface PendingDialog {
  title: string;
  body?: string;
  cancelLabel: string;
  buttons: Button[];
  resolve: (value: string | null) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback(
    (dialog: Omit<PendingDialog, 'resolve'>) =>
      new Promise<string | null>((resolve) => {
        setPending({ ...dialog, resolve });
      }),
    [],
  );

  const confirm = useCallback<ConfirmFn>(
    async (o) => {
      const result = await open({
        title: o.title,
        body: o.body,
        cancelLabel: o.cancelLabel || 'Cancel',
        buttons: [{ value: 'ok', label: o.confirmLabel || 'Confirm', primary: true, danger: !!o.danger }],
      });
      return result === 'ok';
    },
    [open],
  );

  const choose = useCallback(
    async (o: ChoiceOptions<string>) =>
      open({
        title: o.title,
        body: o.body,
        cancelLabel: o.cancelLabel || 'Cancel',
        buttons: o.options.map((x) => ({ value: x.value, label: x.label, primary: !!x.primary, danger: false })),
      }),
    [open],
  ) as ChoiceFn;

  const settle = useCallback((value: string | null) => {
    setPending((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    primaryButtonRef.current?.focus();
    const primary = pending.buttons.find((b) => b.primary);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(null);
      if (e.key === 'Enter' && primary) settle(primary.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={{ confirm, choose }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => settle(null)}
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
            <div className="flex items-center justify-end flex-wrap gap-2 mt-5">
              <button
                onClick={() => settle(null)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                {pending.cancelLabel}
              </button>
              {pending.buttons.map((b) => (
                <button
                  key={b.value}
                  ref={b.primary ? primaryButtonRef : undefined}
                  onClick={() => settle(b.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                    !b.primary
                      ? 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                      : b.danger
                        ? 'bg-rose-600 text-white hover:bg-rose-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
