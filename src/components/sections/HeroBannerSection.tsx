import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const EarthGlobe = lazy(() =>
  import('../ui/EarthGlobe').then((m) => ({ default: m.EarthGlobe }))
);

const INITIAL_FKKO = '';
const INITIAL_VID = '';
const INITIAL_REGION = '';

export function HeroBannerSection(): JSX.Element {
  const navigate = useNavigate();
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);

  const handleResetFilters = (): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
  };

  return (
    <>
    <section className="flex items-center justify-center min-h-screen px-0 relative self-stretch w-full flex-[0_0_auto] py-8 sm:py-10 md:py-12 lg:py-14 xl:py-16">
      <div className="relative flex flex-col xl:flex-row items-center xl:items-center justify-center xl:justify-between gap-8 sm:gap-10 lg:gap-12 xl:gap-16 max-w-[1510px] w-full px-4 sm:px-6 md:px-8 lg:px-[50px]">
        {/* Левая колонка: планета */}
        <div className="hero-reveal group flex flex-col items-center justify-center w-full xl:max-w-[45%] xl:max-w-[480px] flex-shrink-0">
          <div className="relative w-[min(340px,92vw)] h-[min(340px,92vw)] sm:w-[min(400px,88vw)] sm:h-[min(400px,88vw)] md:w-[min(480px,85vw)] md:h-[min(480px,85vw)] lg:w-[min(520px,55vw)] lg:h-[min(520px,55vw)] xl:w-[min(560px,52vw)] xl:h-[min(560px,52vw)] flex items-center justify-center">
            <span className="star star--small" style={{ top: '8%', left: '12%', '--star-delay': '0s' } as React.CSSProperties} aria-hidden />
            <span className="star" style={{ top: '5%', right: '18%', '--star-delay': '0.4s' } as React.CSSProperties} aria-hidden />
            <span className="star star--large" style={{ top: '18%', right: '5%', '--star-delay': '1.2s' } as React.CSSProperties} aria-hidden />
            <span className="star star--small" style={{ top: '35%', right: '2%', '--star-delay': '0.8s' } as React.CSSProperties} aria-hidden />
            <span className="star" style={{ bottom: '28%', right: '10%', '--star-delay': '1.6s' } as React.CSSProperties} aria-hidden />
            <span className="star star--small" style={{ bottom: '12%', right: '22%', '--star-delay': '0.2s' } as React.CSSProperties} aria-hidden />
            <span className="star" style={{ bottom: '8%', left: '15%', '--star-delay': '1s' } as React.CSSProperties} aria-hidden />
            <span className="star star--large" style={{ bottom: '22%', left: '5%', '--star-delay': '0.6s' } as React.CSSProperties} aria-hidden />
            <span className="star star--small" style={{ top: '42%', left: '3%', '--star-delay': '1.4s' } as React.CSSProperties} aria-hidden />
            <span className="star" style={{ top: '25%', left: '8%', '--star-delay': '0.3s' } as React.CSSProperties} aria-hidden />
            <button
              type="button"
              onClick={() => navigate('/map')}
              className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4caf50] focus-visible:ring-offset-4 focus-visible:ring-offset-[#1e1e1e] rounded-full w-full h-full"
              aria-label="Нажмите на планету — открыть рабочую площадку на карте"
            >
              <span className="relative cursor-pointer select-none block w-full h-full rounded-full overflow-hidden">
                <ErrorBoundary
                  fallback={
                    <span
                      className="block w-full h-full rounded-full"
                      style={{
                        background: `
                        radial-gradient(circle at 35% 25%, rgba(180,255,200,0.5), transparent 50%),
                        radial-gradient(circle at 70% 65%, rgba(20,40,30,0.9), transparent 45%),
                        radial-gradient(ellipse 80% 50% at 50% 50%, #2d5a3d, #1a3d28 40%, #0d2818 70%, #061810)
                      `,
                        boxShadow: `
                        inset -15px -20px 40px rgba(0,0,0,0.5),
                        inset 12px 10px 30px rgba(120,200,140,0.15),
                        0 0 60px rgba(76,175,80,0.25),
                        0 0 120px rgba(76,175,80,0.1)
                      `,
                      }}
                    />
                  }
                >
                  <Suspense
                    fallback={
                      <span
                        className="block w-full h-full rounded-full"
                        style={{
                          background: `
                          radial-gradient(circle at 35% 25%, rgba(180,255,200,0.5), transparent 50%),
                          radial-gradient(circle at 70% 65%, rgba(20,40,30,0.9), transparent 45%),
                          radial-gradient(ellipse 80% 50% at 50% 50%, #2d5a3d, #1a3d28 40%, #0d2818 70%, #061810)
                        `,
                          boxShadow: `
                          inset -15px -20px 40px rgba(0,0,0,0.5),
                          inset 12px 10px 30px rgba(120,200,140,0.15),
                          0 0 60px rgba(76,175,80,0.25),
                          0 0 120px rgba(76,175,80,0.1)
                        `,
                        }}
                      />
                    }
                  >
                    <EarthGlobe />
                  </Suspense>
                </ErrorBoundary>
              </span>
              <span
                className="absolute inset-[-4px] rounded-full border-2 border-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                aria-hidden
              />
            </button>
          </div>
          <span className="text-sm text-white/50 tracking-widest uppercase group-hover:text-white/80 transition-colors mt-2">
            Нажмите на планету — открыть карту
          </span>
        </div>

        {/* Правая колонка: подзаголовок, описание, фильтр */}
        <div className="flex flex-col w-full xl:max-w-[55%] xl:max-w-[600px] gap-5 sm:gap-6 lg:gap-8 flex-shrink-0">
          <div className="hero-reveal flex flex-col items-start gap-3 sm:gap-4">
            <p className="font-manrope font-semibold text-[#cccccc] text-lg sm:text-xl md:text-2xl lg:text-[26px] xl:text-[32px] leading-snug">
              Управление отходами по ФККО, контроль объектов и маршрутов на одной карте.
            </p>
            <p className="text-sm sm:text-base lg:text-lg text-[#cccccc]">
              Фильтруйте по ФККО, виду обращения и региону. Планируйте экологическую
              инфраструктуру в реальном времени.
            </p>
          </div>

          {/* Карточка фильтров */}
          <article className="hero-reveal flex flex-col items-stretch gap-6 sm:gap-8 p-4 sm:p-5 md:p-6 bg-[#262626] rounded-2xl sm:rounded-[24px] border border-white/10">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="space-y-1">
              <h2 className="text-white text-xl sm:text-2xl md:text-[26px] lg:text-[30px] xl:text-[32px] font-semibold leading-tight">
                Фильтр объектов по экологии
              </h2>
              <p className="text-xs sm:text-sm lg:text-base text-[#cccccc]">
                Настройте параметры и смотрите объекты, площадки и маршруты в вашем регионе.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.12em] text-white/60">
                  ФККО
                </label>
                <input
                  type="text"
                  value={filterFkko}
                  onChange={(e) => setFilterFkko(e.target.value)}
                  placeholder="Например, 7 31 100 01 40 4"
                  className="h-11 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-4 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.12em] text-white/60">
                  Вид обращения
                </label>
                <select
                  value={filterVid}
                  onChange={(e) => setFilterVid(e.target.value)}
                  className="h-11 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-4 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
                >
                  <option className="bg-[#050608] text-white" value="">
                    Все виды
                  </option>
                  <option className="bg-[#050608] text-white" value="Сбор">
                    Сбор
                  </option>
                  <option className="bg-[#050608] text-white" value="Транспортирование">
                    Транспортирование
                  </option>
                  <option className="bg-[#050608] text-white" value="Обезвреживание">
                    Обезвреживание
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.12em] text-white/60">
                  Регион
                </label>
                <select
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                  className="h-11 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-4 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
                >
                  <option className="bg-[#050608] text-white" value="">
                    Все регионы
                  </option>
                  <option className="bg-[#050608] text-white" value="Московская область">
                    Московская область
                  </option>
                  <option className="bg-[#050608] text-white" value="Челябинская область">
                    Челябинская область
                  </option>
                  <option className="bg-[#050608] text-white" value="Башкортостан">
                    Башкортостан
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-1 sm:pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center px-5 sm:px-6 h-10 sm:h-11 rounded-[999px] bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors"
              >
                Далее
              </button>
              <Link
                to="/upload"
                className="inline-flex items-center justify-center px-5 sm:px-6 h-10 sm:h-11 rounded-[999px] border-2 border-[#4caf50] text-sm font-medium text-[#4caf50] hover:bg-[#4caf50]/10 transition-colors"
              >
                Разместить объект
              </Link>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-sm text-white/70 hover:text-white transition-colors order-last sm:order-none"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        </article>
        </div>
      </div>
    </section>
    </>
  );
}
