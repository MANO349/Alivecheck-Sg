"use client";

export default function AppCard({
  title,
  subtitle,
  rightAction,
  children,
}: {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-200 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-extrabold text-gray-900">{title}</h1>
          {rightAction}
        </div>

        {subtitle ? (
          <p className="text-sm text-gray-600 mb-6">{subtitle}</p>
        ) : (
          <div className="mb-6" />
        )}

        {children}
      </div>
    </main>
  );
}