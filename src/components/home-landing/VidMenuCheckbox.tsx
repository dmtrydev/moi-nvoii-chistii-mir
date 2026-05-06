import type { JSX } from 'react';

/** Чекбокс строки «Вид обращения» по макету (градиент + галочка / пустой квадрат). */

export function VidMenuCheckboxChecked(): JSX.Element {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/90 bg-[linear-gradient(128deg,rgba(219,236,168,0.96)_0%,rgba(188,220,87,0.98)_100%)] shadow-[0_3px_14px_rgba(163,200,59,0.55),inset_0_0_8px_rgba(255,255,255,0.55)]"
      aria-hidden
    >
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <path
          d="M2 8L7.5 13.5L18 2"
          stroke="#2b3335"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function VidMenuCheckboxUnchecked(): JSX.Element {
  return (
    <div
      className="box-border h-9 w-9 shrink-0 rounded-[10px] border-[1.5px] border-[rgba(200,205,200,0.7)] bg-[rgba(255,255,255,0.55)]"
      aria-hidden
    />
  );
}

export function VidMenuCheckboxCheckedSm(): JSX.Element {
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-white/90 bg-[linear-gradient(128deg,rgba(219,236,168,0.96)_0%,rgba(188,220,87,0.98)_100%)] shadow-[0_2px_10px_rgba(163,200,59,0.5),inset_0_0_6px_rgba(255,255,255,0.55)]"
      aria-hidden
    >
      <svg width="14" height="11" viewBox="0 0 20 16" fill="none">
        <path
          d="M2 8L7.5 13.5L18 2"
          stroke="#2b3335"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function VidMenuCheckboxUncheckedSm(): JSX.Element {
  return (
    <div
      className="box-border h-6 w-6 shrink-0 rounded-[7px] border-[1.5px] border-[rgba(200,205,200,0.7)] bg-[rgba(255,255,255,0.55)]"
      aria-hidden
    />
  );
}
