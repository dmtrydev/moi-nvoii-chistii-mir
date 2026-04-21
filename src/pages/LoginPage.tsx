import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/useAuth';
import { SiteFrameWithTopNav } from '@/components/home-landing/SiteFrameWithTopNav';
import { SitePublicPageShell } from '@/components/home-landing/SitePublicPageShell';

export default function LoginPage(): JSX.Element {
  const { login, requestRegistrationCode, confirmRegistration } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState<'request' | 'confirm'>('request');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function redirectAfterAuth(authUser: { role: string }): Promise<void> {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    navigate(authUser.role === 'SUPERADMIN' ? '/admin/dashboard' : '/dashboard', { replace: true });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'register' && !consentAccepted) {
      setError('Для регистрации нужно подтвердить согласие на обработку персональных данных.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        if (registerStep === 'request') {
          await requestRegistrationCode(email, password, fullName);
          setRegisterStep('confirm');
          setNotice('Код отправлен на ваш email. Введите его для завершения регистрации.');
          return;
        }
        const created = await confirmRegistration(email, verificationCode);
        await redirectAfterAuth(created);
        return;
      }

      const loggedInUser = await login(email, password);
      await redirectAfterAuth(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'register' ? 'Ошибка регистрации' : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SitePublicPageShell>
      <SiteFrameWithTopNav>
        <div className="flex min-h-[min(640px,85dvh)] items-center justify-center px-4 py-10">
          <div className="w-full max-w-md glass-shell space-y-5 p-8">
        <div>
          <div className="glass-kicker">Welcome</div>
          <h1 className="typo-h1 tracking-tight text-ink mt-2">Вход / Регистрация</h1>
        </div>

        <div className="glass-panel p-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setNotice(null);
              setRegisterStep('request');
            }}
            className={`flex-1 h-11 rounded-2xl text-sm font-semibold transition-all ${
              mode === 'login'
                ? 'bg-accent-soft text-[#1f5c14] shadow-sm'
                : 'text-ink-muted hover:bg-app-bg'
            }`}
          >
            Войти
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 h-11 rounded-2xl text-sm font-semibold transition-all ${
              mode === 'register'
                ? 'bg-accent-soft text-[#1f5c14] shadow-sm'
                : 'text-ink-muted hover:bg-app-bg'
            }`}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs glass-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
              required
            />
          </div>

          {mode === 'register' && registerStep === 'request' && (
            <div>
              <label className="block text-xs glass-muted mb-1">Имя и фамилия</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input"
                required
                minLength={2}
              />
            </div>
          )}

          {(mode === 'login' || registerStep === 'request') && (
            <div>
              <label className="block text-xs glass-muted mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                required
                minLength={8}
              />
            </div>
          )}
          {mode === 'register' && registerStep === 'confirm' && (
            <div>
              <label className="block text-xs glass-muted mb-1">Код подтверждения</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="glass-input"
                required
                minLength={6}
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          )}
          {mode === 'register' && registerStep === 'request' && (
            <label className="flex items-start gap-2.5 rounded-xl border border-black/[0.06] bg-[#ffffff70] p-3">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-black/20 text-[#2f7d32] focus:ring-[#2f7d32]/40"
                required
              />
              <span className="text-[12px] leading-relaxed text-[#4b5457]">
                Я даю согласие на обработку персональных данных в соответствии с{' '}
                <Link
                  to="/consent/personal-data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2f7d32] underline underline-offset-2"
                >
                  текстом согласия
                </Link>
                .
              </span>
            </label>
          )}
          {notice && <div className="text-xs text-[#1f5c14]">{notice}</div>}
          {error && <div className="text-xs glass-danger">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full glass-btn-dark disabled:opacity-60"
          >
            {loading
              ? mode === 'register'
                ? registerStep === 'request'
                  ? 'Отправка кода...'
                  : 'Подтверждение...'
                : 'Вход...'
              : mode === 'register'
                ? registerStep === 'request'
                  ? 'Получить код'
                  : 'Подтвердить и создать аккаунт'
                : 'Войти'}
          </button>
          {mode === 'register' && registerStep === 'confirm' && (
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setError(null);
                setNotice(null);
                setLoading(true);
                try {
                  await requestRegistrationCode(email, password, fullName);
                  setNotice('Новый код отправлен на ваш email.');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось отправить код повторно');
                } finally {
                  setLoading(false);
                }
              }}
              className="w-full glass-btn-soft disabled:opacity-60"
            >
              Отправить код повторно
            </button>
          )}
        </form>

        {mode === 'register' && (
          <div className="text-[11px] text-ink-muted leading-relaxed">
            Регистрация создаёт пользователя с ролью <span className="text-[#1f5c14] font-semibold">USER</span>.
            Для роли <span className="text-[#1f5c14] font-semibold">SUPERADMIN</span> используйте создание через админ-скрипт/DB.
          </div>
        )}

        </div>
        </div>
      </SiteFrameWithTopNav>
    </SitePublicPageShell>
  );
}
