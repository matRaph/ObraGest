interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  optional?: boolean;
}

export default function FieldLabel({ htmlFor, label, optional }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-brand-gray">
      {label}
      {optional && (
        <span className="ml-1 text-xs font-normal text-brand-gray-muted">(opcional)</span>
      )}
    </label>
  );
}
