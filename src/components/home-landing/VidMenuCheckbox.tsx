import type { JSX } from 'react';

/** Чекбокс строки «Вид обращения» по макету (градиент + галочка / пустой квадрат). */

export function VidMenuCheckboxChecked(): JSX.Element {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#c8e06a_0%,#a8c83a_100%)] shadow-[0_2px_8px_rgba(160,200,50,0.25)]"
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
