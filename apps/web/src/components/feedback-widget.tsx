'use client';

import { useState } from 'react';

import { sendFeedback } from '../lib/analytics';

type State = 'idle' | 'open' | 'sending' | 'sent' | 'error';

export function FeedbackWidget() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');

  const submit = async () => {
    if (message.trim().length === 0) return;
    setState('sending');
    try {
      const res = await sendFeedback(message.trim(), contact.trim());
      setState(res.ok ? 'sent' : 'error');
      if (res.ok) {
        setMessage('');
        setContact('');
      }
    } catch {
      setState('error');
    }
  };

  if (state === 'idle' || state === 'sent') {
    return (
      <button className="feedback-fab" type="button" onClick={() => setState('open')} aria-label="Enviar comentarios">
        {state === 'sent' ? '¡Gracias!' : 'Comentarios'}
      </button>
    );
  }

  return (
    <div className="feedback-panel" role="dialog" aria-label="Comentarios">
      <p className="eyebrow">TU OPINIÓN</p>
      <label>¿Qué mejorarías?
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} />
      </label>
      <label>Contacto (opcional)
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email o @usuario" maxLength={200} />
      </label>
      {state === 'error' ? <p className="portal-live-status portal-live-status--error">No se pudo enviar. Probá de nuevo.</p> : null}
      <div className="feedback-panel__actions">
        <button type="button" onClick={() => setState('idle')}>Cerrar</button>
        <button className="primary-action" type="button" disabled={state === 'sending'} onClick={() => void submit()}>
          {state === 'sending' ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
