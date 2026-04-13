import { Link } from 'react-router-dom';

export default function ForbiddenPage(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center glass-bg text-ink px-4 page-enter">
      <h1 className="typo-h1 mb-2">403</h1>
      <p className="text-sm text-ink-muted mb-4 text-center max-w-md">
        Недостаточно прав для просмотра этой страницы.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center h-11 rounded-2xl px-5 text-sm font-semibold text-[#1a2e12] bg-gradient-to-br from-accent-from to-accent-to hover:shadow-eco-card transition-shadow shadow-sm"
      >
        На главную
      </Link>
    </div>
  );
}
