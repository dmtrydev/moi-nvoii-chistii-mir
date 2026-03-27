import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export default function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'SUPERADMIN';

  const mainLinks = [
    { to: '/dashboard', label: 'Панель' },
    { to: '/dashboard/profile', label: 'Профиль' },
    { to: '/dashboard/upload', label: 'Загрузка лицензии' },
    { to: '/map', label: 'Карта' },
    { to: '/directory', label: 'Справочник ФККО' },
  ];
  const adminLinks = [
    { to: '/admin/dashboard', label: 'Обзор админки' },
    { to: '/admin/licenses', label: 'Объекты' },
    { to: '/admin/logs', label: 'Журнал действий' },
  ];

  return (
    <div className="min-h-screen glass-bg text-ink p-4 md:p-6 page-enter">
      <div className="glass-shell min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)] flex overflow-hidden">
        <aside className="w-[280px] shrink-0 bg-sidebar flex flex-col gap-6 p-5 md:p-6 border-r border-white/[0.06]">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Система управления</div>
            <div className="mt-2 text-xl font-semibold tracking-tight text-white">Личный кабинет</div>
          </div>
          <nav className="flex flex-col gap-1.5">
            {mainLinks.map((l) => {
              const active =
                l.to === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`glass-nav-item ${active ? 'is-active' : ''}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {isAdmin && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Администрирование</div>
              <nav className="flex flex-col gap-1.5">
                {adminLinks.map((l) => {
                  const active = location.pathname.startsWith(l.to);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`glass-nav-item ${active ? 'is-active' : ''}`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
          <div className="mt-auto rounded-2xl bg-white/[0.06] border border-white/[0.08] p-4 space-y-3 text-xs text-white/80 shadow-inner">
            <div className="text-white/60">Пользователь: {user?.email ?? '—'}</div>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="w-full glass-btn-dark"
            >
              Выйти
            </button>
            <Link
              to="/"
              className="w-full inline-flex h-11 items-center justify-center rounded-2xl text-sm font-semibold bg-white/10 text-white border border-white/15 hover:bg-white/15 transition-colors duration-200"
            >
              На главную
            </Link>
          </div>
        </aside>
        <main className="flex-1 min-w-0 bg-app-bg p-6 md:p-8 lg:p-10 overflow-auto brand-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
