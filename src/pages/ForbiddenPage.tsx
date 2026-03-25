import { Link } from 'react-router-dom';

export default function ForbiddenPage(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] text-slate-900 px-4">
      <h1 className="text-2xl font-semibold mb-2">403</h1>
      <p className="text-sm text-slate-600 mb-4 text-center max-w-md">
        Недостаточно прав для просмотра этой страницы.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center h-9 rounded-lg bg-[#4caf50] px-4 text-xs font-medium text-white hover:bg-[#43a047] transition-colors shadow-sm"
      >
        На главную
      </Link>
    </div>
  );
}
