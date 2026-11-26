import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import { Modal } from './Modal';
import { SUPPLIER_CATEGORIES } from '../data/biomedicalSuppliers';

const TOKEN_KEY = 'labos_auth_token';
const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? undefined;
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' };
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, margin: '12px 0 4px', color: 'var(--text-muted)' };

/** "Add vendor": put a vendor that is not listed on Shop & Vendors, for every lab. */
export default function AddVendor() {
  const add = useMutation(api.communityVendors.add);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('Chemicals & Reagents');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await add({ token: getToken(), name, website, category, notes: notes || undefined });
      toast.success(`${name.trim()} added to Shop & Vendors.`);
      setOpen(false); setName(''); setWebsite(''); setNotes('');
    } catch (err) {
      toast.error(String((err as { data?: string; message?: string })?.data ?? (err as Error).message ?? 'Could not add the vendor').replace(/^.*Uncaught ConvexError:\s*/, '').slice(0, 160));
    } finally { setBusy(false); }
  };

  return (
    <>
      <button className="btn btn-secondary" type="button" onClick={() => setOpen(true)}>+ Add vendor</button>
      {open && createPortal(
        <Modal isOpen onClose={() => setOpen(false)} title="Add a vendor" size="sm">
          <form onSubmit={submit}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Can't find a vendor? Add it here and it shows up on Shop &amp; Vendors for every LabOS lab. Vendors are also added automatically when someone captures or requests a product from a new site.
            </p>
            <label style={label} htmlFor="av-name">Vendor name</label>
            <input id="av-name" style={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
            <label style={label} htmlFor="av-site">Website</label>
            <input id="av-site" style={input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.example.com" required />
            <label style={label} htmlFor="av-cat">Category</label>
            <select id="av-cat" style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {SUPPLIER_CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={label} htmlFor="av-notes">What they sell (optional)</label>
            <input id="av-notes" style={input} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || !website.trim()}>{busy ? 'Adding…' : 'Add vendor'}</button>
            </div>
          </form>
        </Modal>,
        document.body)}
    </>
  );
}
