import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';
import { useAuth } from '@/contexts/useAuth';
import pdfPlaceholderIcon from '@/assets/upload/pdf-placeholder.svg';
import uploadBackground from '@/assets/home-landing/hero-background.png';

export default function UploadPage(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const fileInputId = useId();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const menuLinks = [
    { to: '/dashboard', label: 'Панель' },
    { to: '/dashboard/profile', label: 'Профиль' },
    { to: '/dashboard/upload', label: 'Загрузка лицензии' },
    { to: '/dashboard/support', label: 'Поддержка' },
    { to: '/map', label: 'Карта' },
    { to: '/directory', label: 'Справочник ФККО' },
  ];

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const relatedTarget = event.relatedTarget as Node | null;
    if (!event.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFileName(file.name);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file ? file.name : '');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const input = document.getElementById(fileInputId) as HTMLInputElement | null;
      input?.click();
    }
  };

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
                {menuLinks.map((item) => {
                  const active = item.to === '/dashboard'
                    ? location.pathname === '/dashboard'
                    : location.pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-white/65 text-[#2b3335] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.9)]'
                          : 'text-[#4f5759] hover:bg-white/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
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
            <section className="rounded-[24px] border border-white/55 bg-white/28 p-5 backdrop-blur-[14px]">
              <div className="mx-auto mt-4 w-full max-w-[900px] rounded-[32px] border border-white/60 bg-white/22 p-8 backdrop-blur-[10px]">
                <label
                  htmlFor={fileInputId}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onKeyDown={handleKeyDown}
                  tabIndex={0}
                  className={`flex cursor-pointer flex-col items-center gap-9 rounded-[32px] border-2 border-dashed border-white/70 bg-white/10 px-8 py-12 transition-transform duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${
                    isDragOver ? 'scale-[1.01]' : ''
                  }`}
                  aria-describedby="upload-description upload-status"
                >
                  <input
                    id={fileInputId}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <div className="flex h-[136px] w-[136px] items-center justify-center rounded-full border border-white/70 bg-white/40 backdrop-blur-xl">
                    <img
                      className="h-14 w-[49px]"
                      alt=""
                      aria-hidden="true"
                      src={pdfPlaceholderIcon}
                    />
                  </div>
                  <div className="flex w-full max-w-[781px] flex-col items-center gap-6">
                    <p
                      id="upload-title"
                      className="bg-[linear-gradient(136deg,rgba(43,51,53,1)_0%,rgba(97,110,114,1)_47%,rgba(43,51,53,1)_100%)] bg-clip-text text-center font-['Soyuz_Grotesk-Bold',Helvetica] text-5xl font-bold leading-[52.8px] text-transparent"
                    >
                      {selectedFileName || 'перетащите сюда лицензию в pdf'}
                    </p>
                    <p id="upload-description" className="text-center font-['Nunito-SemiBold',Helvetica] text-lg font-semibold text-[#5e6567]">
                      или нажмите, чтобы выбрать файл
                    </p>
                    <p id="upload-status" className="sr-only" aria-live="polite">
                      {selectedFileName
                        ? `Выбран файл ${selectedFileName}`
                        : isDragOver
                          ? 'Отпустите файл, чтобы загрузить PDF'
                          : 'Зона загрузки PDF файла'}
                    </p>
                  </div>
                </label>
              </div>
            </section>
          </div>
        </div>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
