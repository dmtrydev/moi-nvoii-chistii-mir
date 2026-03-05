import { useState, lazy, Suspense } from 'react';
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
    <section className="flex items-center justify-center min-h-screen px-0 relative self-stretch w-full flex-[0_0_auto] bg-[#1e1e1e] py-12 md:py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4caf5040,_transparent_55%),_radial-gradient(circle_at_bottom,_#8bc34a33,_transparent_55%)] pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 lg:gap-12 max-w-[1510px] w-full px-[24px] md:px-[50px]">
        {/* Левая колонка: Умная экоплатформа, описание, контакты, фильтры */}
        <div className="flex flex-col w-full lg:max-w-[55%] xl:max-w-[600px] gap-8 lg:gap-10 flex-shrink-0">
          <div className="hero-reveal flex flex-col items-start gap-6">
            <div className="space-y-3">
              <h1 className="font-manrope font-bold text-white text-[48px] sm:text-[64px] lg:text-[72px] xl:text-[80px] leading-[1] tracking-[-0.04em]">
                Умная экоплатформа
              </h1>
              <p className="font-manrope font-semibold text-[#cccccc] text-xl sm:text-2xl lg:text-[28px] xl:text-[32px] leading-snug">
                Управление отходами по ФККО, контроль объектов и маршрутов на одной карте.
              </p>
            </div>

            <p className="max-w-[640px] text-base lg:text-lg text-[#cccccc]">
              Фильтруйте по ФККО, виду обращения и региону. Планируйте экологическую
              инфраструктуру в реальном времени.
            </p>
          </div>

          {/* Карточка фильтров */}
          <article className="hero-reveal flex flex-col items-stretch gap-10 p-6 bg-[#262626] rounded-[24px] border border-white/10">
          <div className="flex flex-col gap-6">
            <div className="space-y-1">
              <h2 className="text-white text-[28px] lg:text-[32px] font-semibold leading-tight">
                Фильтр объектов по экологии
              </h2>
              <p className="text-sm lg:text-base text-[#cccccc]">
                Настройте параметры и смотрите объекты, площадки и маршруты в вашем регионе.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center px-6 h-11 rounded-[999px] bg-[#4caf50] text-sm font-medium text-white hover:bg-[#43a047] transition-colors"
              >
                Далее
              </button>
              <Link
                to="/upload"
                className="inline-flex items-center justify-center px-6 h-11 rounded-[999px] border-2 border-[#4caf50] text-sm font-medium text-[#4caf50] hover:bg-[#4caf50]/10 transition-colors"
              >
                Разместить объект
              </Link>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
        </article>
        </div>

        {/* Правая колонка: планета напротив текста */}
        <div className="hero-reveal group flex flex-col items-center justify-center gap-4 flex-shrink-0 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => navigate('/map')}
            className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4caf50] focus-visible:ring-offset-4 focus-visible:ring-offset-[#1e1e1e] rounded-full transition-transform duration-500 group-hover:scale-110 group-active:scale-105 w-[min(320px,85vw)] h-[min(320px,85vw)] lg:w-[min(400px,40vw)] lg:h-[min(400px,40vw)]"
            aria-label="Нажмите на планету — открыть рабочую площадку на карте"
          >
            <span
              className="absolute inset-0 rounded-full bg-[#4caf50]/20 blur-3xl scale-150 group-hover:bg-[#4caf50]/30 group-hover:scale-[1.8] transition-all duration-500"
              aria-hidden
            />
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
          <span className="text-sm text-white/50 tracking-widest uppercase group-hover:text-white/80 transition-colors">
            Нажмите на планету — открыть карту
          </span>
        </div>
      </div>
    </section>
    </>
  );
}
