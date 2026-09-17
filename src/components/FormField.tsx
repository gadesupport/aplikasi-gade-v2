export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  required?: boolean
  full?: boolean
  textarea?: boolean
  step?: string
  min?: string
  list?: string
}

export default function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  full,
  textarea,
  step,
  min,
  list,
}: FormFieldProps) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={placeholder}
          className={inputClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          step={step}
          min={min}
          list={list}
          className={inputClass}
        />
      )}
    </div>
  )
}
