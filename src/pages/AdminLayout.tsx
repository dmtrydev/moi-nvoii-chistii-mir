import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';

export default function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isModeratorOrAbove = user?.role === 'MODERATOR' || user?.role === 'SUPERADMIN';
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const mainLinks = [
    { to: '/dashboard', label: 'Панель' },
    { to: '/dashboard/profile', label: 'Профиль' },
    { to: '/dashboard/upload', label: 'Загрузка лицензии' },
    { to: '/dashboard/support', label: 'Поддержка' },
    { to: '/map', label: 'Карта' },
    { to: '/directory', label: 'Справочник ФККО' },
  ];
  const adminLinks = [
    { to: '/admin/dashboard', label: 'Обзор админки' },
    { to: '/admin/licenses', label: 'Объекты' },
    { to: '/admin/support', label: 'Чаты поддержки' },
    { to: '/admin/logs', label: 'Журнал действий' },
  ];

  return (
    <div className="min-h-screen text-ink p-3 md:p-4 page-enter">
      <div className="relative min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-2rem)] flex gap-3 overflow-hidden rounded-[28px] border border-white/55 bg-white/20 backdrop-blur-[8px]">
        <aside className="w-[280px] shrink-0 flex flex-col gap-6 p-5 md:p-6 rounded-[24px] bg-[#17191c]/92 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
          {isModeratorOrAbove && (
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
                {isSuperAdmin ? (
                  <Link
                    to="/admin/users"
                    className={`glass-nav-item ${location.pathname.startsWith('/admin/users') ? 'is-active' : ''}`}
                  >
                    Пользователи
                  </Link>
                ) : null}
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
        <main className="flex-1 min-w-0 rounded-[24px] bg-white/28 p-3 md:p-4 overflow-auto brand-scroll backdrop-blur-[14px] border border-white/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
