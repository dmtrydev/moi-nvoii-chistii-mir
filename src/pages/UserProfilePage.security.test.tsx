import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import UserProfilePage from '@/pages/UserProfilePage';

vi.mock('@/lib/metrika', () => ({
  openCookieSettings: vi.fn(),
}));

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'user@example.com', fullName: 'User', role: 'USER' },
    logout: vi.fn(),
    getSecurityOverview: vi.fn().mockResolvedValue({
      twoFactorEnabled: false,
      trustedDeviceDays: 0,
      sessions: [],
    }),
    requestSecurePasswordChange: vi.fn(),
    confirmSecurePasswordChange: vi.fn(),
    setupTwoFactor: vi.fn(),
    enableTwoFactor: vi.fn(),
    disableTwoFactor: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllOtherSessions: vi.fn(),
  }),
}));

describe('UserProfilePage security center', () => {
  it('renders security sections', async () => {
    render(
      <MemoryRouter>
        <UserProfilePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Безопасность аккаунта')).toBeInTheDocument();
    expect(screen.getByText('Сессии')).toBeInTheDocument();
    expect(screen.getByText('Смена пароля')).toBeInTheDocument();
  });
});
