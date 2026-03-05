import { useState } from 'react';

const CONTACTS = {
  phone: { label: 'Телефон', value: '8 800 ***-**-**', href: 'tel:88000000000' },
  email: { label: 'Email', value: 'info@example.com', href: 'mailto:info@example.com' },
};

export function ContactsMenu(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {isOpen && (
        <div
          className="rounded-2xl border border-white/15 bg-[#262626] px-5 py-4 shadow-xl min-w-[220px]"
          role="dialog"
          aria-label="Контакты"
        >
          <p className="text-xs uppercase tracking-widest text-white/50 mb-3">
            Получить консультацию
          </p>
          <ul className="space-y-3">
            <li>
              <span className="text-[11px] uppercase tracking-wider text-white/60">
                {CONTACTS.phone.label}
              </span>
              <a
                href={CONTACTS.phone.href}
                className="block font-medium text-white hover:text-[#8bc34a] transition-colors mt-0.5"
              >
                {CONTACTS.phone.value}
              </a>
            </li>
            <li>
              <span className="text-[11px] uppercase tracking-wider text-white/60">
                {CONTACTS.email.label}
              </span>
              <a
                href={CONTACTS.email.href}
                className="block font-medium text-white hover:text-[#8bc34a] transition-colors mt-0.5 break-all"
              >
                {CONTACTS.email.value}
              </a>
            </li>
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-[#4caf50] px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-[#43a047] transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={isOpen ? 'Закрыть контакты' : 'Получить консультацию — контакты'}
      >
        <span>Получить консультацию</span>
      </button>
    </div>
  );
}
