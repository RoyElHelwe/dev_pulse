import { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children?: ReactNode
  required?: boolean
}

export function FormField({ label, htmlFor, error, hint, children, required }: FormFieldProps) {
  return (
    <div>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface FormInputFieldProps {
  label: string
  id: string
  name: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  maxLength?: number
  className?: string
}

export function FormInputField({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  hint,
  required,
  maxLength,
  className
}: FormInputFieldProps) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className={cn('mt-1', className)}
      />
    </FormField>
  )
}
