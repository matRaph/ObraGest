interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}

export default function FieldLabel({ htmlFor, label, optional, required }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-brand-gray">
      {label}
      {required && (
        <span className="ml-0.5 text-red-500" aria-hidden>*</span>
      )}
      {optional && (
        <span className="ml-1 text-xs font-normal text-brand-gray-muted">(opcional)</span>
      )}
    </label>
  );
}
