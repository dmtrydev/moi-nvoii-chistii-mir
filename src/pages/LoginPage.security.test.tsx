import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';

const loginMock = vi.fn();
const loginWithTwoFactorMock = vi.fn();
const requestRegistrationCodeMock = vi.fn();
const confirmRegistrationMock = vi.fn();

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({
    login: loginMock,
    loginWithTwoFactor: loginWithTwoFactorMock,
    requestRegistrationCode: requestRegistrationCodeMock,
    confirmRegistration: confirmRegistrationMock,
  }),
}));

describe('LoginPage security flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 2FA challenge panel when login requires two factor', async () => {
    loginMock.mockResolvedValueOnce({
      requiresTwoFactor: true,
      challengeToken: 'challenge-token',
    });
    loginWithTwoFactorMock.mockResolvedValueOnce({
      id: 1,
      email: 'user@example.com',
      role: 'USER',
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    await userEvent.type(emailInput as HTMLInputElement, 'user@example.com');
    await userEvent.type(passwordInput as HTMLInputElement, 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText(/вход защищен 2fa/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('6-значный код'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить вход' }));

    await waitFor(() => {
      expect(loginWithTwoFactorMock).toHaveBeenCalledWith('challenge-token', {
        totpCode: '123456',
        recoveryCode: undefined,
      });
    });
  });
});
