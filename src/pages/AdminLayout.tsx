import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';
import uploadBackground from '@/assets/home-landing/hero-background.png';

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
    <SitePublicPageShell className="relative min-h-screen overflow-hidden">
      <img
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
        alt=""
        aria-hidden="true"
        src={uploadBackground}
      />
      <SiteFrameWithTopNav>
        <div className="relative mr-3 mt-0 min-h-[calc(100vh-120px)] text-ink">
          <div className="grid min-h-[calc(100vh-140px)] grid-cols-[280px_1fr] gap-3">
            <aside className="flex flex-col rounded-[24px] border border-white/55 bg-white/28 p-4 backdrop-blur-[14px]">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5e6567]">Система управления</div>
              <div className="mt-2 text-lg font-semibold text-[#2b3335]">Личный кабинет</div>
              <nav className="mt-4 flex flex-col gap-1.5">
                {mainLinks.map((l) => {
                  const active = l.to === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(l.to);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-white/65 text-[#2b3335] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]'
                          : 'text-[#4f5759] hover:bg-white/50'
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
              {isModeratorOrAbove && (
                <div className="mt-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5e6567]">Администрирование</div>
                  <nav className="flex flex-col gap-1.5">
                    {adminLinks.map((l) => {
                      const active = location.pathname.startsWith(l.to);
                      return (
                        <Link
                          key={l.to}
                          to={l.to}
                          className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-white/65 text-[#2b3335] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]'
                              : 'text-[#4f5759] hover:bg-white/50'
                          }`}
                        >
                          {l.label}
                        </Link>
                      );
                    })}
                    {isSuperAdmin ? (
                      <Link
                        to="/admin/users"
                        className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                          location.pathname.startsWith('/admin/users')
                            ? 'bg-white/65 text-[#2b3335] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]'
                            : 'text-[#4f5759] hover:bg-white/50'
                        }`}
                      >
                        Пользователи
                      </Link>
                    ) : null}
                  </nav>
                </div>
              )}
              <div className="mt-auto space-y-2 rounded-xl border border-white/55 bg-white/40 p-3">
                <div className="truncate text-[11px] text-[#5e6567]">{user?.email ?? '—'}</div>
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="w-full rounded-xl bg-gradient-to-r from-[#d4ff5c] to-[#5fd93a] px-3 py-2 text-sm font-semibold text-[#1f2d16]"
                >
                  Выйти
                </button>
              </div>
            </aside>
            <main className="rounded-[24px] border border-white/55 bg-white/28 p-5 backdrop-blur-[14px] overflow-auto brand-scroll">
              <Outlet />
            </main>
          </div>
        </div>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
