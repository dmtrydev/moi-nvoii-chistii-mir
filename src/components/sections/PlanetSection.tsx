import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../ui/ErrorBoundary';

const EarthGlobe = lazy(() =>
  import('../ui/EarthGlobe').then((m) => ({ default: m.EarthGlobe }))
);

/**
 * Второй блок: планета. Отрицательный margin-top даёт перекрытие с первым экраном —
 * на первом экране виден только верх (~25%) планеты, при скролле во второй блок планета показывается полностью.
 */
export function PlanetSection(): JSX.Element {
  const navigate = useNavigate();

  return (
    <section
      className="relative flex items-center justify-center min-h-screen w-full flex-[0_0_auto] py-8 sm:py-10 md:py-12 lg:py-14 xl:py-16"
      style={{ marginTop: '-25vh' }}
      aria-label="Интерактивная карта — нажмите на планету"
    >
      <div className="hero-reveal group flex flex-col items-center justify-center gap-3 sm:gap-4 w-full px-4">
        <div className="relative w-[min(280px,88vw)] h-[min(280px,88vw)] sm:w-[min(340px,85vw)] sm:h-[min(340px,85vw)] md:w-[min(400px,80vw)] md:h-[min(400px,80vw)] lg:w-[min(480px,50vw)] lg:h-[min(480px,50vw)] xl:w-[min(560px,52vw)] xl:h-[min(560px,52vw)] flex items-center justify-center">
          {/* Звёзды вокруг планеты */}
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
            className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4caf50] focus-visible:ring-offset-4 focus-visible:ring-offset-white rounded-full w-full h-full"
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
        <span className="text-sm text-slate-500 tracking-widest uppercase group-hover:text-slate-800 transition-colors">
          Нажмите на планету — открыть карту
        </span>
      </div>
    </section>
  );
}
