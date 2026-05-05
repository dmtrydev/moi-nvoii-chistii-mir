import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import PricePage from '@/pages/PricePage';

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: null,
    logout: vi.fn(),
  }),
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
});

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
    expect(screen.getAllByRole('link', { name: 'Выбрать' }).length).toBeGreaterThanOrEqual(3);
  });

  it('marks price and text cells differently', () => {
    render(
      <MemoryRouter initialEntries={['/price']}>
        <PricePage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('60 000 ₽')[0]).toHaveAttribute('data-cell-kind', 'price');
    expect(screen.getAllByText('1 530 000 ₽')[0]).toHaveAttribute('data-cell-kind', 'price');
    expect(screen.getAllByText('до 50/мес')[0]).toHaveAttribute('data-cell-kind', 'text');
    expect(screen.getAllByText('Индивидуально')[0]).toHaveAttribute('data-cell-kind', 'text');
    expect(screen.getAllByText('Выделенный менеджер')[0]).toHaveAttribute('data-cell-kind', 'text');
  });

  it('renders stacked plan cards for smaller screens', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/price']}>
        <PricePage />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('[data-plan-card]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-plan-card-row="ежемесячная оплата:"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-plan-card-row="лимиты на запросы/экспорт"]')).toHaveLength(3);
  });
});
