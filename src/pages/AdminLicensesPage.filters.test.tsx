import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLicensesPage from '@/pages/AdminLicensesPage';

describe('AdminLicensesPage GRORO filters', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/admin/licenses/stats')) {
          return { ok: true, json: async () => ({ total: 0, pending: 0, recheck: 0, approved: 0, rejected: 0, rejectedByAi: 0 }) };
        }
        return { ok: true, json: async () => ({ items: [], total: 0 }) };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders GRORO import option and needs-review checkbox', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/licenses']}>
        <AdminLicensesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Объекты (лицензии)')).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Импорт ГРОРО' })).toBeInTheDocument();
    expect(screen.getByLabelText('Только требует проверки')).toBeInTheDocument();
  });
});

