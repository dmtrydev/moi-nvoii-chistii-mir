import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PricePage from '@/pages/PricePage';

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: null,
    logout: vi.fn(),
  }),
}));

describe('PricePage pricing comparison', () => {
  it('renders each feature row across all pricing columns', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/price']}>
        <PricePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('сравнение тарифных планов экосистемы')).toBeInTheDocument();

    const monthlyRows = container.querySelectorAll('[data-row-label="ежемесячная оплата:"]');
    const yearlyRows = container.querySelectorAll('[data-row-label="при оплате за год (15%):"]');
    const limitsRows = container.querySelectorAll('[data-row-label="лимиты на запросы/экспорт"]');

    expect(monthlyRows).toHaveLength(4);
    expect(yearlyRows).toHaveLength(4);
    expect(limitsRows).toHaveLength(4);
    expect(container.querySelectorAll('[data-plan-column]')).toHaveLength(3);
    expect(screen.getAllByRole('link', { name: 'Выбрать' })).toHaveLength(3);
  });

  it('marks price and text cells differently', () => {
    render(
      <MemoryRouter initialEntries={['/price']}>
        <PricePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('60 000 ₽')).toHaveAttribute('data-cell-kind', 'price');
    expect(screen.getByText('1 530 000 ₽')).toHaveAttribute('data-cell-kind', 'price');
    expect(screen.getByText('до 50/мес')).toHaveAttribute('data-cell-kind', 'text');
    expect(screen.getByText('Индивидуально')).toHaveAttribute('data-cell-kind', 'text');
    expect(screen.getByText('Выделенный менеджер')).toHaveAttribute('data-cell-kind', 'text');
  });
});
