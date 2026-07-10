/** Layout des pages d'authentification : carte centree, hors coque ERP. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">
            r
          </span>
          <div className="leading-tight">
            <div className="text-lg font-semibold text-slate-800">raktak</div>
            <div className="text-xs text-slate-500">Gestion d&apos;entreprise · Senegal</div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
