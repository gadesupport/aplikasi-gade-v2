interface PlaceholderPageProps {
  title: string
  description: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 lg:p-12">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
      <p className="mt-6 inline-flex rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
        Modul ini belum dibuat.
      </p>
    </div>
  )
}
