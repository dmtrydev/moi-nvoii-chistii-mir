import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { openCookieSettings } from '@/lib/metrika';

export default function UserProfilePage(): JSX.Element {
  const {
    user,
    logout,
    getSecurityOverview,
    requestSecurePasswordChange,
    confirmSecurePasswordChange,
    setupTwoFactor,
    enableTwoFactor,
    disableTwoFactor,
    regenerateRecoveryCodes,
    revokeSession,
    revokeAllOtherSessions,
  } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupUrl, setTotpSetupUrl] = useState('');
  const [totpInput, setTotpInput] = useState('');
  const [disableTotpInput, setDisableTotpInput] = useState('');
  const [disableRecoveryCode, setDisableRecoveryCode] = useState('');
  const [latestRecoveryCodes, setLatestRecoveryCodes] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; userAgent?: string; ipAddress?: string; createdAt: string; expiresAt: string; revokedAt?: string | null }>>([]);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [pendingPasswordChange, setPendingPasswordChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSecurity(): Promise<void> {
      try {
        const overview = await getSecurityOverview();
        if (cancelled) return;
        setSessions(overview.sessions);
        setTwoFactorEnabled(overview.twoFactorEnabled);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить раздел безопасности');
        }
      }
    }
    void loadSecurity();
    return () => {
      cancelled = true;
    };
  }, [getSecurityOverview]);

  async function handleChangePassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    setLoading(true);
    try {
      if (!pendingPasswordChange) {
        await requestSecurePasswordChange(oldPassword, newPassword);
        setPendingPasswordChange(true);
        setSuccess('Код подтверждения отправлен на email. Введите его ниже.');
      } else {
        await confirmSecurePasswordChange(confirmCode);
        setSuccess('Пароль успешно изменён.');
        setOldPassword('');
        setNewPassword('');
        setConfirmCode('');
        setPendingPasswordChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setLoading(false);
    }
  }

  const displayName = user?.fullName ?? user?.email ?? 'Пользователь';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 page-enter">
      <div className="space-y-5">
        <div className="glass-panel p-5 flex items-start justify-between gap-4 flex-col md:flex-row">
          <div className="flex items-center gap-4">
            <UserAvatar name={user?.fullName ?? null} email={user?.email ?? null} size={52} />
            <div>
              <div className="glass-kicker">Профиль</div>
              <h1 className="typo-h1 mt-1 mb-0">{displayName}</h1>
              <p className="text-sm glass-muted mt-1">{user?.email ?? '—'}</p>
              <p className="text-xs glass-muted mt-2">Роль: {user?.role ?? '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <Link to="/dashboard" className="glass-btn-soft">
              В кабинет
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout();
              }}
              className="glass-btn-dark"
            >
              Выйти
            </button>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Данные пользователя</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Email</div>
              <div className="font-medium">{user?.email ?? '—'}</div>
            </div>
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Никнейм</div>
              <div className="font-medium">{user?.fullName ?? '—'}</div>
            </div>
            <div className="flex gap-3">
              <div className="w-[140px] text-ink-muted">Пароль</div>
              <div className="font-medium text-ink-muted">********</div>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => openCookieSettings()}
              className="glass-btn-soft !h-9 !px-4 !text-xs"
            >
              Настройки cookies
            </button>
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Безопасность аккаунта</div>
          <div className="mt-3 text-xs glass-muted">
            Статус 2FA: <span className="font-semibold">{twoFactorEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}</span>
          </div>
          {!twoFactorEnabled ? (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="glass-btn-dark"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    const setup = await setupTwoFactor();
                    setTotpSetupSecret(setup.secret);
                    setTotpSetupUrl(setup.otpauthUrl);
                    setSuccess('Сканируйте ссылку в Google Authenticator и подтвердите кодом.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Не удалось начать настройку 2FA');
                  }
                }}
              >
                Настроить Google Authenticator
              </button>
              {totpSetupSecret && (
                <div className="rounded-xl border border-black/[0.08] bg-white/70 p-3 space-y-2">
                  <div className="text-xs glass-muted">Секрет для ручного ввода:</div>
                  <div className="font-mono text-sm break-all">{totpSetupSecret}</div>
                  <div className="text-xs glass-muted">Ссылка для QR:</div>
                  <div className="text-[11px] break-all">{totpSetupUrl}</div>
                  <input
                    type="text"
                    className="glass-input"
                    value={totpInput}
                    onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-значный код из приложения"
                  />
                  <button
                    type="button"
                    className="glass-btn-dark"
                    onClick={async () => {
                      setError(null);
                      setSuccess(null);
                      try {
                        const { recoveryCodes } = await enableTwoFactor(totpInput);
                        setLatestRecoveryCodes(recoveryCodes);
                        setTwoFactorEnabled(true);
                        setTotpSetupSecret('');
                        setTotpSetupUrl('');
                        setTotpInput('');
                        setSuccess('2FA включен. Сохраните recovery-коды в безопасном месте.');
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Не удалось включить 2FA');
                      }
                    }}
                  >
                    Подтвердить и включить 2FA
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  type="text"
                  className="glass-input"
                  value={disableTotpInput}
                  onChange={(e) => setDisableTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Код приложения для отключения"
                />
                <input
                  type="text"
                  className="glass-input"
                  value={disableRecoveryCode}
                  onChange={(e) => setDisableRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="или recovery-код"
                />
              </div>
              <button
                type="button"
                className="glass-btn-soft"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    const { recoveryCodes } = await regenerateRecoveryCodes();
                    setLatestRecoveryCodes(recoveryCodes);
                    setSuccess('Recovery-коды обновлены.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Не удалось обновить recovery-коды');
                  }
                }}
              >
                Сгенерировать новые recovery-коды
              </button>
              <button
                type="button"
                className="glass-btn-dark"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  try {
                    await disableTwoFactor({
                      totpCode: disableTotpInput || undefined,
                      recoveryCode: disableRecoveryCode || undefined,
                    });
                    setTwoFactorEnabled(false);
                    setDisableTotpInput('');
                    setDisableRecoveryCode('');
                    setSuccess('2FA отключен.');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Не удалось отключить 2FA');
                  }
                }}
              >
                Отключить 2FA
              </button>
            </div>
          )}

          {latestRecoveryCodes.length > 0 && (
            <div className="mt-3 rounded-xl border border-black/[0.08] bg-white/70 p-3">
              <div className="text-xs glass-muted mb-2">Recovery-коды (сохраните):</div>
              <div className="grid grid-cols-2 gap-2">
                {latestRecoveryCodes.map((code) => (
                  <div key={code} className="font-mono text-sm">{code}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Сессии</div>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="glass-btn-soft"
              onClick={async () => {
                setError(null);
                try {
                  await revokeAllOtherSessions();
                  const overview = await getSecurityOverview();
                  setSessions(overview.sessions);
                  setSuccess('Все другие сессии завершены.');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось завершить сессии');
                }
              }}
            >
              Выйти со всех других устройств
            </button>
            {sessions.map((session) => (
              <div key={session.id} className="rounded-xl border border-black/[0.08] bg-white/70 p-3 text-xs">
                <div><span className="glass-muted">IP:</span> {session.ipAddress || '—'}</div>
                <div><span className="glass-muted">UA:</span> {session.userAgent || '—'}</div>
                <div><span className="glass-muted">Создана:</span> {new Date(session.createdAt).toLocaleString()}</div>
                <div><span className="glass-muted">Статус:</span> {session.revokedAt ? 'Завершена' : 'Активна'}</div>
                {!session.revokedAt && (
                  <button
                    type="button"
                    className="mt-2 glass-btn-soft !h-8 !px-3 !text-xs"
                    onClick={async () => {
                      setError(null);
                      try {
                        await revokeSession(session.id);
                        const overview = await getSecurityOverview();
                        setSessions(overview.sessions);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Не удалось завершить сессию');
                      }
                    }}
                  >
                    Завершить эту сессию
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5">
          <div className="glass-kicker">Смена пароля</div>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs glass-muted mb-1">Старый пароль</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="glass-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs glass-muted mb-1">Новый пароль</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input"
                required
                minLength={8}
              />
            </div>
            {pendingPasswordChange && (
              <div>
                <label className="block text-xs glass-muted mb-1">Код из email</label>
                <input
                  type="text"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="glass-input"
                  required
                />
              </div>
            )}

            {error && <div className="text-xs glass-danger">{error}</div>}
            {success && <div className="text-xs text-[#1f5c14] font-medium">{success}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full glass-btn-dark disabled:opacity-60"
            >
              {loading ? 'Смена...' : pendingPasswordChange ? 'Подтвердить смену пароля' : 'Запросить код подтверждения'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


