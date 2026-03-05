import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const INITIAL_FKKO = '';
const INITIAL_VID = '';
const INITIAL_REGION = '';

export default function MapPage(): JSX.Element {
  const [filterFkko, setFilterFkko] = useState(INITIAL_FKKO);
  const [filterVid, setFilterVid] = useState(INITIAL_VID);
  const [filterRegion, setFilterRegion] = useState(INITIAL_REGION);

  const handleResetFilters = (): void => {
    setFilterFkko(INITIAL_FKKO);
    setFilterVid(INITIAL_VID);
    setFilterRegion(INITIAL_REGION);
  };

  return (
    <div className="flex min-h-screen bg-[#050608]">
      <aside className="relative w-full max-w-[360px] lg:max-w-[420px] bg-[#050608] border-r border-white/10 px-5 py-6 overflow-y-auto brand-scroll no-scrollbar flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
        </div>
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Управление</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Рабочая площадка — карта</h2>
        </div>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-3">
            Фильтры
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 mb-1.5">ФККО</p>
              <input
                type="text"
                value={filterFkko}
                onChange={(e) => setFilterFkko(e.target.value)}
                placeholder="7 31 100 01 40 4"
                className="w-full h-10 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 mb-1.5">
                Вид обращения
              </p>
              <select
                value={filterVid}
                onChange={(e) => setFilterVid(e.target.value)}
                className="w-full h-10 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
              >
                <option className="bg-[#050608] text-white" value="">Все виды</option>
                <option className="bg-[#050608] text-white" value="Сбор">Сбор</option>
                <option className="bg-[#050608] text-white" value="Транспортирование">
                  Транспортирование
                </option>
                <option className="bg-[#050608] text-white" value="Обезвреживание">
                  Обезвреживание
                </option>
              </select>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 mb-1.5">Регион</p>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="w-full h-10 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
              >
                <option className="bg-[#050608] text-white" value="">Все регионы</option>
                <option className="bg-[#050608] text-white" value="Московская область">
                  Московская область
                </option>
                <option className="bg-[#050608] text-white" value="Челябинская область">
                  Челябинская область
                </option>
                <option className="bg-[#050608] text-white" value="Башкортостан">Башкортостан</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-white/70 hover:text-white transition-colors"
            >
              Сбросить фильтры
            </button>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-3">
            Легенда
          </h3>
          <div className="space-y-2 text-xs text-white/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16a34a]" />
              <span>Хранение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
              <span>Захоронение</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span>Утилизация / обработка</span>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-3">
            Слои карты
          </h3>
          <div className="space-y-2 text-xs text-white/80">
            <label className="flex items-center justify-between gap-3">
              <span>Границы участков</span>
              <input type="checkbox" className="w-4 h-4 accent-[#4caf50]" defaultChecked />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Кадастровые кварталы</span>
              <input type="checkbox" className="w-4 h-4 accent-[#4caf50]" />
            </label>
          </div>
        </section>

        <section className="mt-auto pt-2 border-t border-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-3">
            Маршрут
          </h3>
          <div className="space-y-3 text-xs text-white/80">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 mb-1.5">Точка А</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className="w-full h-9 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/50 mb-1.5">Точка B</p>
              <input
                type="text"
                placeholder="Выберите объект"
                className="w-full h-9 rounded-[999px] bg-[#1e1e1e] border border-white/15 px-3 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#4caf50]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 h-9 rounded-[999px] bg-[#4caf50] text-[11px] font-medium text-white hover:bg-[#43a047] transition-colors"
              >
                Построить
              </button>
              <button
                type="button"
                className="flex-1 h-9 rounded-[999px] border border-white/20 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
              >
                Сбросить
              </button>
            </div>
          </div>
        </section>
      </aside>

      <div className="flex-1 relative min-w-0">
        <iframe
          title="Рабочая площадка — Яндекс.Карты"
          src="https://yandex.ru/map-widget/v1/?ll=60.0,56.0&z=4&l=map"
          className="w-full h-full min-h-screen"
          loading="lazy"
        />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-[999px] bg-[#1e1e1e]/80 border border-white/15 px-2 py-1">
            <button
              type="button"
              className="px-3 py-1 rounded-[999px] text-[11px] font-medium text-white bg-[#4caf50]"
            >
              2D карта
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded-[999px] text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/5"
            >
              3D глобус
            </button>
          </div>
          <Link
            to="/upload"
            className="pointer-events-auto px-4 py-2 rounded-[999px] bg-[#4caf50] text-[11px] font-medium text-white hover:bg-[#43a047] transition-colors"
          >
            Разместить объект
          </Link>
        </div>
      </div>
    </div>
  );
}
