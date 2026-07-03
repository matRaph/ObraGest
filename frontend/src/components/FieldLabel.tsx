interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  optional?: boolean;
}

export default function FieldLabel({ htmlFor, label, optional }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
      {label}
      {optional && (
        <span className="ml-1 text-xs font-normal text-slate-400">(opcional)</span>
      )}
    </label>
  );
}
