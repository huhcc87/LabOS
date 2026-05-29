import { useState, useEffect, useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

const BRAND_ICONS: Record<string, string> = {
  visa: '💳', mastercard: '💳', amex: '💳', discover: '💳',
  diners: '💳', jcb: '💳', unionpay: '💳', unknown: '💳',
};

export default function PaymentMethodsPage() {
  const { token } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [cardError, setCardError] = useState('');
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [stripeInstance, setStripeInstance] = useState<any>(null);

  const createSetupIntent = useAction(api.stripe.createSetupIntent);
  const listPaymentMethods = useAction(api.stripe.listPaymentMethods);
  const detachPaymentMethod = useAction(api.stripe.detachPaymentMethod);

  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  const isConfigured = !!publishableKey;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listPaymentMethods({ token });
      setMethods(result || []);
    } catch {
      // Stripe not configured — show empty state
      setMethods([]);
    }
    setLoading(false);
  }, [token, listPaymentMethods]);

  useEffect(() => { load(); }, [load]);

  // Lazy-load Stripe.js
  useEffect(() => {
    if (!publishableKey) return;
    import('@stripe/stripe-js').then(({ loadStripe }) => {
      loadStripe(publishableKey).then((s) => {
        if (s) {
          setStripeInstance(s);
          setStripeReady(true);
        }
      });
    });
  }, [publishableKey]);

  const startAddCard = async () => {
    if (!token || !stripeInstance) return;
    setAdding(true);
    setCardError('');
    try {
      const { client_secret } = await createSetupIntent({ token });
      if (!client_secret) throw new Error('Failed to create setup session');

      const elements = stripeInstance.elements({
        clientSecret: client_secret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#6366f1',
            borderRadius: '8px',
          },
        },
      });

      const cardElement = elements.create('payment');
      // Mount after a tick so the container is in the DOM
      setTimeout(() => {
        const container = document.getElementById('stripe-card-element');
        if (container) {
          cardElement.mount('#stripe-card-element');
          setStripeElements({ elements, clientSecret: client_secret });
        }
      }, 50);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start card setup');
      setAdding(false);
    }
  };

  const confirmCard = async () => {
    if (!stripeInstance || !stripeElements) return;
    setCardError('');
    try {
      const { error } = await stripeInstance.confirmSetup({
        elements: stripeElements.elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (error) {
        setCardError(error.message || 'Card verification failed');
      } else {
        toast.success('Card saved successfully!');
        setAdding(false);
        setStripeElements(null);
        load();
      }
    } catch (err: any) {
      setCardError(err.message || 'Failed to save card');
    }
  };

  const removeMethod = async (id: string) => {
    if (!token || !confirm('Remove this card? It will be detached from Stripe immediately.')) return;
    try {
      await detachPaymentMethod({ token, payment_method_id: id });
      toast.success('Card removed');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove card');
    }
  };

  return (
    <div className="page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>💳 Payment Methods</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            One safe place for every card your lab uses. PCI-compliant via Stripe — LabOS never sees raw card numbers.
          </p>
        </div>
        <button onClick={load}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </div>

      {/* Stripe status */}
      {!loading && (isConfigured ? (
        <div className="card" style={{ marginBottom: 20, padding: 14, background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <strong style={{ color: '#22c55e' }}>Stripe connected</strong>
            <span style={{ color: 'var(--text-muted)' }}>· mode: <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{publishableKey?.startsWith('pk_test') ? 'test' : 'live'}</code></span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20, padding: 18, background: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.35)' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 24 }}>⚠️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Stripe is not yet configured</div>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Without Stripe, the Reagent Cart still works — you'll just mark items as "ordered" manually
                instead of charging a saved card automatically. To enable in-app charging:
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                <li>Create a free Stripe account at <a href="https://stripe.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>stripe.com</a></li>
                <li>Add <code>STRIPE_SECRET_KEY</code> to your Convex environment variables</li>
                <li>Add <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to your Vercel environment variables</li>
                <li>Redeploy and refresh this page</li>
              </ol>
            </div>
          </div>
        </div>
      ))}

      {/* Saved cards */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Saved cards</h3>
          {!adding && (
            <button onClick={startAddCard} disabled={!isConfigured || !stripeReady}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: isConfigured ? 'pointer' : 'not-allowed',
                fontSize: 13, fontWeight: 600, color: '#fff',
                background: isConfigured ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--surface2)',
              }}>
              + Add new card
            </button>
          )}
        </div>

        {/* Stripe Elements card form */}
        {adding && (
          <div style={{
            padding: 20, borderRadius: 12, marginBottom: 16,
            border: '1px solid var(--border)', background: 'var(--surface2)',
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Add a payment method</h4>
            <div
              id="stripe-card-element"
              style={{
                padding: 12, borderRadius: 8, minHeight: 44,
                border: '1px solid var(--border)', background: '#fff',
                marginBottom: 12,
              }}
            />
            {cardError && (
              <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{cardError}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmCard}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}>
                Save card
              </button>
              <button onClick={() => { setAdding(false); setStripeElements(null); setCardError(''); }}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : methods.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            {isConfigured ? 'No cards saved yet. Click "+ Add new card" to save one.' : 'Connect Stripe to manage cards in-app.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {methods.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border)',
                background: i === 0 ? 'rgba(99,102,241,0.06)' : 'transparent',
              }}>
                <span style={{ fontSize: 28 }}>{BRAND_ICONS[m.brand] || '💳'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.brand.charAt(0).toUpperCase() + m.brand.slice(1)} ····{m.last4}
                    {i === 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.18)', color: '#818cf8' }}>DEFAULT</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Expires {String(m.exp_month).padStart(2, '0')}/{String(m.exp_year).slice(-2)}
                  </div>
                </div>
                <button onClick={() => removeMethod(m.id)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
        🔒 Cards are stored at Stripe, never in LabOS. Removing a card here detaches it from Stripe immediately.
        For PCI Level 1 compliance, in-app card entry uses Stripe Elements (tokenized at Stripe's servers).
      </p>
    </div>
  );
}
