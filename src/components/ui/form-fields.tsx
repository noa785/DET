// src/components/ui/form-fields.tsx
// Reusable controlled form components used in OrderForm + Grid cells
'use client';

import { useRef, useEffect, useState, forwardRef } from 'react';

// ── Base input wrapper ─────────────────────────────────────────
interface FieldWrapperProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}
export function FieldWrapper({ label, required, error, hint, children, className = '' }: FieldWrapperProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error  && <p className="text-[11px] text-red-400">{error}</p>}
      {hint && !error && <p className="text-[11px] text-[var(--text-3)]">{hint}</p>}
    </div>
  );
}

// ── Text input ─────────────────────────────────────────────────
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; required?: boolean; error?: string; hint?: string;
  wrapperClassName?: string;
}
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, required, error, hint, wrapperClassName, className = '', ...props }, ref) => (
    <FieldWrapper label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <input
        ref={ref}
        className={`pes-input w-full ${error ? 'border-red-500/50 focus:border-red-500' : ''} ${className}`}
        {...props}
      />
    </FieldWrapper>
  )
);
TextInput.displayName = 'TextInput';

// ── Textarea ───────────────────────────────────────────────────
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; required?: boolean; error?: string; hint?: string;
  wrapperClassName?: string; autoGrow?: boolean;
}
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, required, error, hint, wrapperClassName, autoGrow, className = '', onChange, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref as any) ?? innerRef;

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      if (autoGrow && combinedRef.current) {
        combinedRef.current.style.height = 'auto';
        combinedRef.current.style.height = `${combinedRef.current.scrollHeight}px`;
      }
      onChange?.(e);
    }

    return (
      <FieldWrapper label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
        <textarea
          ref={combinedRef}
          onChange={handleChange}
          className={`pes-input w-full resize-none min-h-[80px] ${error ? 'border-red-500/50' : ''} ${className}`}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
TextArea.displayName = 'TextArea';

// ── Select ─────────────────────────────────────────────────────
interface SelectOption { value: string; label: string; color?: string; }
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string; required?: boolean; error?: string; hint?: string;
  options: SelectOption[]; placeholder?: string;
  wrapperClassName?: string;
  onChange?: (value: string) => void;
}
export function Select({
  label, required, error, hint, options, placeholder = 'Select…',
  wrapperClassName, className = '', onChange, value, ...props
}: SelectProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <select
        value={value ?? ''}
        onChange={e => onChange?.(e.target.value)}
        className={`pes-input w-full ${error ? 'border-red-500/50' : ''} ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// ── Date input ─────────────────────────────────────────────────
interface DateInputProps {
  label?: string; required?: boolean; error?: string; hint?: string;
  value: string | null; onChange: (val: string | null) => void;
  min?: string; max?: string; disabled?: boolean;
  wrapperClassName?: string;
}
export function DateInput({ label, required, error, hint, value, onChange, wrapperClassName, ...props }: DateInputProps) {
  return (
    <FieldWrapper label={label} required={required} error={error} hint={hint} className={wrapperClassName}>
      <input
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className={`pes-input w-full ${error ? 'border-red-500/50' : ''}`}
        {...props}
      />
    </FieldWrapper>
  );
}

// ── Percent slider ─────────────────────────────────────────────
interface PercentSliderProps {
  label?: string; value: number; onChange: (n: number) => void;
  error?: string; disabled?: boolean; wrapperClassName?: string;
}
export function PercentSlider({ label, value, onChange, error, disabled, wrapperClassName }: PercentSliderProps) {
  const color =
    value === 100 ? '#10b981' :
    value >= 70   ? '#3b82f6' :
    value >= 40   ? '#f59e0b' : '#6b7280';

  return (
    <FieldWrapper label={label} error={error} className={wrapperClassName}>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${value}%`, background: color }}
            />
          </div>
          <input
            type="range"
            min="0" max="100" step="5"
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            min="0" max="100"
            value={value}
            onChange={e => {
              const n = Math.max(0, Math.min(100, Number(e.target.value)));
              onChange(isNaN(n) ? 0 : n);
            }}
            disabled={disabled}
            className="pes-input w-[56px] text-center text-sm py-1"
          />
          <span className="text-[var(--text-2)] text-sm">%</span>
        </div>
      </div>
    </FieldWrapper>
  );
}

// ── Segmented control (for type/priority/status) ───────────────
interface SegmentedControlProps<T extends string> {
  label?: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string; color?: string }[];
  error?: string; wrapperClassName?: string;
}
export function SegmentedControl<T extends string>({
  label, value, onChange, options, error, wrapperClassName,
}: SegmentedControlProps<T>) {
  return (
    <FieldWrapper label={label} error={error} className={wrapperClassName}>
      <div className="flex gap-1 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border)]">
        {options.map(o => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`
                flex-1 py-1.5 px-2 rounded text-[11.5px] font-semibold transition-all
                ${active
                  ? 'bg-[#1c2d4a] text-[var(--text)] shadow-sm'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }
              `}
              style={active && o.color ? { color: o.color } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </FieldWrapper>
  );
}

// ── Tags / comma-separated input ───────────────────────────────
interface TagsInputProps {
  label?: string; value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string; error?: string; hint?: string;
  wrapperClassName?: string;
}
export function TagsInput({ label, value, onChange, placeholder, error, hint, wrapperClassName }: TagsInputProps) {
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState('');

  function addTag() {
    const t = inputVal.trim();
    if (!t) return;
    const newTags = [...new Set([...tags, t])];
    onChange(newTags.join(', '));
    setInputVal('');
  }

  function removeTag(idx: number) {
    const newTags = tags.filter((_, i) => i !== idx);
    onChange(newTags.length ? newTags.join(', ') : null);
  }

  return (
    <FieldWrapper label={label} error={error} hint={hint} className={wrapperClassName}>
      <div className={`pes-input min-h-[40px] flex flex-wrap gap-1.5 items-center p-2 ${error ? 'border-red-500/50' : ''}`}>
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-[#1c2d4a] text-blue-300 text-[11.5px] px-2 py-0.5 rounded">
            {t}
            <button type="button" onClick={() => removeTag(i)} className="text-[var(--text-3)] hover:text-red-400 leading-none">×</button>
          </span>
        ))}
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
            if (e.key === 'Backspace' && !inputVal && tags.length) removeTag(tags.length - 1);
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[13px] text-[var(--text)] placeholder-slate-600"
        />
      </div>
    </FieldWrapper>
  );
}
