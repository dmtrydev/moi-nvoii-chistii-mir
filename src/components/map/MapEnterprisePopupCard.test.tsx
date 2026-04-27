import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapEnterprisePopupCard } from '@/components/map/MapEnterprisePopupCard';
import type { MapEnterprisePopupViewModel } from '@/components/map/mapEnterprisePopupModel';

describe('MapEnterprisePopupCard', () => {
  it('renders title, address and all rows', () => {
    const model: MapEnterprisePopupViewModel = {
      title: 'ООО Экология-Пром',
      subtitleAddress: 'Курганская область, г. Курган, ул. Омская, 48 а',
      infoRows: [
        { key: 'inn', label: 'ИНН:', value: '4501217153' },
        { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
        { key: 'address', label: 'Адрес:', value: 'Курганская область, г. Курган, ул. Омская, 48 а' },
        { key: 'siteLabel', label: 'Площадка:', value: 'Основная площадка' },
      ],
    };

    render(<MapEnterprisePopupCard model={model} />);

    expect(screen.getByText('ООО Экология-Пром')).toBeInTheDocument();
    expect(screen.getByText('ИНН:')).toBeInTheDocument();
    expect(screen.getByText('4501217153')).toBeInTheDocument();
    expect(screen.getByText('Скоро по подписке')).toBeInTheDocument();
    expect(screen.getByText('Основная площадка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Построить маршрут' })).toBeInTheDocument();
  });

  it('keeps long values visible', () => {
    const longAddress =
      '640027, Курганская область, г. Курган, ул. Омская, 48а, строение 2, помещение 9, очень длинное описание адреса для проверки переноса строки';
    const model: MapEnterprisePopupViewModel = {
      title: 'Общество с ограниченной ответственностью "экология-пром урал с очень длинным названием"',
      subtitleAddress: longAddress,
      infoRows: [
        { key: 'inn', label: 'ИНН:', value: '4501217153' },
        { key: 'contacts', label: 'Телефон/E-mail:', value: 'Скоро по подписке' },
        { key: 'address', label: 'Адрес:', value: longAddress },
        { key: 'siteLabel', label: 'Площадка:', value: 'Основная площадка' },
      ],
    };

    render(<MapEnterprisePopupCard model={model} />);

    expect(screen.getByText(/очень длинным названием/i)).toBeInTheDocument();
    expect(screen.getAllByText(longAddress).length).toBeGreaterThan(0);
  });
});
