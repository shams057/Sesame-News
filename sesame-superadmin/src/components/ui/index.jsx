import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';

// ─── Button ─────────────────────────────────────────────────────────────────
export function Button({ variant = 'primary', size, icon, loading, children, className = '', type = 'button', ...props }) {
  const classes = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', !children ? 'btn-icon' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

// ─── Form fields (always with a visible label) ──────────────────────────────
export function Field({ label, hint, error, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function useFieldId(id) {
  const generated = useId();
  return id || generated;
}

export function TextField({ label, hint, error, className, id, as = 'input', ...props }) {
  const fieldId = useFieldId(id);
  const Component = as;
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={fieldId}>
      <Component id={fieldId} className={as === 'textarea' ? 'textarea' : 'input'} aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  );
}

export function SelectField({ label, hint, error, className, id, children, ...props }) {
  const fieldId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={fieldId}>
      <select id={fieldId} className="select" {...props}>{children}</select>
    </Field>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…', label = 'Rechercher' }) {
  const [draft, setDraft] = useState(value || '');
  const [synced, setSynced] = useState(value || '');
  // Follow external changes (Back button, filter reset) without an effect.
  if ((value || '') !== synced) {
    setSynced(value || '');
    setDraft(value || '');
  }
  useEffect(() => {
    const timer = setTimeout(() => { if (draft !== (value || '')) onChange(draft); }, 300);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input className="input" type="search" aria-label={label} placeholder={placeholder} value={draft} onChange={(event) => setDraft(event.target.value)} />
    </div>
  );
}

// ─── Badge ──────────────────────────────────────────────────────────────────
export function Badge({ tone = 'neutral', dot, children, title }) {
  return (
    <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''}`} title={title}>
      {dot ? <span className="dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

// ─── Modal: role=dialog, Escape, focus trap, focus restored on close ───────
export function Modal({ title, onClose, children, footer, size = 'md', labelledBy }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const dialog = dialogRef.current;
    const focusables = () => [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.disabled && element.tabIndex !== -1 && element.type !== 'hidden' && !element.closest('[hidden]'));
    (focusables().find((element) => element.matches('input, select, textarea')) || focusables()[0] || dialog).focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
    // onClose identity may change every render; the trap is set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId} tabIndex={-1}>
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" icon="x" aria-label="Fermer" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);
  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);
  const api = useMemo(() => ({
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button type="button" aria-label="Fermer la notification" onClick={() => dismiss(toast.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ─── Confirmation dialog (replaces window.confirm) ─────────────────────────
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);
  const close = (answer) => { request?.resolve(answer); setRequest(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request ? (
        <Modal
          size="sm"
          title={request.title}
          onClose={() => close(false)}
          footer={(
            <>
              <Button variant="secondary" onClick={() => close(false)}>Annuler</Button>
              <Button variant={request.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{request.confirmLabel || 'Confirmer'}</Button>
            </>
          )}
        >
          <p>{request.message}</p>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ─── Misc ───────────────────────────────────────────────────────────────────
export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon = 'file', title, description, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4, height = 44 }) {
  return (
    <div className="stack" style={{ padding: 16 }} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton" style={{ height }} />)}
    </div>
  );
}

export function Pagination({ page, totalPages, totalElements, onChange, label = 'éléments' }) {
  if (!totalElements) return null;
  return (
    <div className="pagination">
      <span>{totalElements} {label}</span>
      {totalPages > 1 ? (
        <div className="row">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>Précédent</Button>
          <span>Page {page + 1} / {totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Suivant</Button>
        </div>
      ) : null}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  return (
    <div className="alert alert-error row" role="alert">
      <span>{error}</span>
      {onRetry ? <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button> : null}
    </div>
  );
}

/** Shows a one-time secret (temporary password) with a copy button. */
export function SecretValue({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="row">
      <code className="mono" style={{ fontSize: 18, padding: '6px 10px', background: 'var(--surface-muted)', borderRadius: 6 }}>{value}</code>
      <Button variant="secondary" size="sm" icon={copied ? 'check' : 'copy'} onClick={async () => {
        await navigator.clipboard?.writeText(value);
        setCopied(true);
      }}>{copied ? 'Copié' : 'Copier'}</Button>
    </div>
  );
}
