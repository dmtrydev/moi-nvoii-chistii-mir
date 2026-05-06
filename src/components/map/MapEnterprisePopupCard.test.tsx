import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

function renderPopup(model: MapEnterprisePopupViewModel): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <MapEnterprisePopupCard model={model} />
    </MemoryRouter>,
  );
}

describe('MapEnterprisePopupCard', () => {
  it('renders title, address and all rows', () => {
    const model: MapEnterprisePopupViewModel = {
      title: 'ООО Экология-Пром',
      subtitleAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      enterpriseDetailsHref: null,
      rpnStrip: null,
      infoRows: [
        { key: 'inn', label: 'ИНН:', value: '4501217153' },
        { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
      ],
      siteSwitches: [
        {
          key: 'id:101',
          label: 'Основная площадка',
          pointId: 101,
          lat: 55.1,
          lng: 65.3,
          isActive: true,
        },
      ],
    };

    renderPopup(model);

    expect(screen.getByText('ООО Экология-Пром')).toBeInTheDocument();
    expect(screen.getByText('ИНН:')).toBeInTheDocument();
    expect(screen.getByText('4501217153')).toBeInTheDocument();
    expect(screen.getByText('Скоро по подписке')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Построить маршрут' })).toBeInTheDocument();
  });

  it('keeps long values visible', () => {
    const longAddress =
      '640027, Курганская область, г. Курган, ул. Омская, 48а, строение 2, помещение 9, очень длинное описание адреса для проверки переноса строки';
    const model: MapEnterprisePopupViewModel = {
      title: 'Общество с ограниченной ответственностью "экология-пром урал с очень длинным названием"',
      subtitleAddress: longAddress,
      enterpriseDetailsHref: null,
      rpnStrip: null,
      infoRows: [
        { key: 'inn', label: 'ИНН:', value: '4501217153' },
        { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
      ],
      siteSwitches: [],
    };

    renderPopup(model);

    expect(screen.getByText(/очень длинным названием/i)).toBeInTheDocument();
    expect(screen.getAllByText(longAddress).length).toBeGreaterThan(0);
  });

  it('renders RPN registry + PPS rows when strip present', () => {
    const model: MapEnterprisePopupViewModel = {
      title: 'ООО Тест',
      subtitleAddress: 'г. Курган',
      enterpriseDetailsHref: null,
      rpnStrip: {
        state: 'yellow',
        registryStatusText: 'Действующая',
        ppsCheckText: 'До 01.07.2026 (осталось 60 дней)',
      },
      infoRows: [
        { key: 'inn', label: 'ИНН:', value: '123' },
        { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
      ],
      siteSwitches: [],
    };

    renderPopup(model);

    expect(screen.getByText('Реестр РПН')).toBeInTheDocument();
    expect(screen.getByText('Действующая')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Действующая' })).not.toBeInTheDocument();
    expect(screen.getByText('Периодическое подтверждение соответствия (ППС)')).toBeInTheDocument();
    expect(screen.getByText('До 01.07.2026 (осталось 60 дней)')).toBeInTheDocument();
  });

  it('makes registry status a link to enterprise details when href set', () => {
    const model: MapEnterprisePopupViewModel = {
      title: 'ООО Тест',
      subtitleAddress: 'г. Курган',
      enterpriseDetailsHref: '/enterprise/42',
      rpnStrip: {
        state: 'green',
        registryStatusText: 'Действующая',
        ppsCheckText: 'До 01.07.2026',
      },
      infoRows: [{ key: 'inn', label: 'ИНН:', value: '123' }],
      siteSwitches: [],
    };

    renderPopup(model);

    const link = screen.getByRole('link', { name: 'Действующая' });
    expect(link).toHaveAttribute('href', '/enterprise/42');
  });
});
