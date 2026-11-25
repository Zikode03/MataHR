import { useState, type FormEvent, type ReactNode } from 'react';
import { message } from './api';
export function Loading({ error, loading }: { error: string; loading: boolean }) {
  return error ? (
    <p role="alert" className="notice live-error">
      {error}
    </p>
  ) : loading ? (
    <p role="status">Loading records…</p>
  ) : null;
}
export function ActionForm({
  title,
  children,
  onSave,
  submit = 'Save',
}: {
  title?: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  submit?: string;
}) {
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [failed, setFailed] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setFeedback('');
    try {
      await onSave(new FormData(form));
      setFailed(false);
      setFeedback('Saved successfully.');
    } catch (error) {
      setFailed(true);
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="live-form" onSubmit={save}>
      {title && <h2>{title}</h2>}
      <fieldset disabled={busy}>
        <div className="form-grid">{children}</div>
        <button className="primary" type="submit">
          {busy ? 'Saving…' : submit}
        </button>
      </fieldset>
      {feedback && (
        <p role={failed ? 'alert' : 'status'} className={failed ? 'live-error' : ''}>
          {feedback}
        </p>
      )}
    </form>
  );
}
export const field = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export const optional = (data: FormData, key: string) => field(data, key) || null;
export const number = (data: FormData, key: string) => Number(field(data, key));
export function TextField({
  label,
  name,
  type = 'text',
  required = true,
  value,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value?: string | number;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} defaultValue={value} />
    </label>
  );
}
export function Empty({ children = 'No records yet.' }: { children?: ReactNode }) {
  return <p className="live-empty">{children}</p>;
}
