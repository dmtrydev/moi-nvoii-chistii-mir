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
    <div className="min-h-screen glass-bg text-[#f5fff7] p-4 md:p-6">
      <div className="glass-shell min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)] flex overflow-hidden">
      <aside className="w-[280px] border-r border-[#72b77d]/25 bg-[#0f1f17]/42 p-4 md:p-5 flex flex-col gap-5">
        <div>
          <div className="glass-kicker">Система управления</div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-[#f5fff7]">Личный кабинет</div>
        </div>
        <nav className="flex flex-col gap-2">
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
            <div className="glass-kicker">Администрирование</div>
            <nav className="flex flex-col gap-2">
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
        <div className="mt-auto glass-panel p-3 space-y-3 text-xs">
          <div className="glass-muted">Пользователь: {user?.email ?? '—'}</div>
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
            className="w-full glass-btn-soft"
          >
            На главную
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-5 overflow-auto">
        <Outlet />
      </main>
      </div>
    </div>
  );
}
