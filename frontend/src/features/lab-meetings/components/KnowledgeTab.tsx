import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { huddleApi } from '../../../lib/api'

interface Article {
  id: string; title: string; category: string; content: string; tags?: string; meeting_id?: string
  created_by_name?: string; created_at: number; updated_at: number; can_manage: boolean
}
/** A meeting the author can draw an article from (its published minutes become the starting text). */
export interface MeetingSource { id: string; title: string; minutes: string }

const CATEGORIES = ['Protocols', 'Troubleshooting', 'Analysis', 'Equipment', 'Other']
const errText = (e: unknown) => (e as { data?: string; message?: string })?.data ?? (e as Error)?.message ?? 'Something went wrong.'
const field: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box' }
const tagList = (t?: string) => (t ?? '').split(',').map((x) => x.trim()).filter(Boolean)
const EMPTY = { id: undefined as string | undefined, title: '', category: 'Protocols', content: '', tags: '', meeting_id: undefined as string | undefined }

/** The lab's shared write-ups: protocol tips, fixes, analysis notes. Searchable; start one from a meeting's minutes. */
export default function KnowledgeTab({ meetings }: { meetings: MeetingSource[] }) {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setArticles((await huddleApi.listArticles()).data as unknown as Article[]) } catch (e) { toast.error(errText(e)); setArticles([]) }
  }, [])
  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (articles ?? []).filter((a) => (!category || a.category === category)
      && (!q || `${a.title} ${a.content} ${a.tags ?? ''}`.toLowerCase().includes(q)))
  }, [articles, search, category])

  const save = async () => {
    if (!form) return
    setBusy(true)
    try {
      await huddleApi.saveArticle({ id: form.id, title: form.title, category: form.category, content: form.content, tags: form.tags, meeting_id: form.meeting_id })
      toast.success(form.id ? 'Article saved' : 'Article added')
      setForm(null); await load()
    } catch (e) { toast.error(errText(e)) } finally { setBusy(false) }
  }
  const remove = async (a: Article) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return
    try { await huddleApi.deleteArticle(a.id); toast.success('Article deleted'); await load() } catch (e) { toast.error(errText(e)) }
  }
  const fromMeeting = (id: string) => {
    const m = meetings.find((x) => x.id === id)
    if (m) setForm((f) => f && { ...f, meeting_id: m.id, title: f.title || `Notes from ${m.title}`, content: f.content || m.minutes })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Lab knowledge base</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Tips, fixes and findings worth keeping, written by the lab.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...field, width: 220 }} aria-label="Search articles" placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...field, width: 'auto' }} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setForm(form ? null : { ...EMPTY })}>{form ? 'Cancel' : '+ New article'}</button>
        </div>
      </div>

      {form && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 8 }} role="region" aria-label="Article">
          {!form.id && meetings.length > 0 && (
            <>
              <label htmlFor="kb-from" style={{ fontSize: 12, fontWeight: 600 }}>Start from a meeting's minutes (optional)</label>
              <select id="kb-from" style={field} value={form.meeting_id ?? ''} onChange={(e) => fromMeeting(e.target.value)}>
                <option value="">Write from scratch</option>
                {meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </>
          )}
          <label htmlFor="kb-title" style={{ fontSize: 12, fontWeight: 600 }}>Title</label>
          <input id="kb-title" style={field} value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fixing high background in western blots" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div>
              <label htmlFor="kb-cat" style={{ fontSize: 12, fontWeight: 600 }}>Category</label>
              <select id="kb-cat" style={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div>
              <label htmlFor="kb-tags" style={{ fontSize: 12, fontWeight: 600 }}>Tags (comma separated)</label>
              <input id="kb-tags" style={field} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="western blot, antibodies" />
            </div>
          </div>
          <label htmlFor="kb-body" style={{ fontSize: 12, fontWeight: 600 }}>Article</label>
          <textarea id="kb-body" style={{ ...field, minHeight: 140, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div><button className="btn btn-primary" disabled={busy || !form.title.trim() || !form.content.trim()} onClick={() => void save()}>{form.id ? 'Save changes' : 'Add article'}</button></div>
        </div>
      )}

      {articles === null && <p style={{ color: 'var(--text-muted)' }}>Loading articles…</p>}
      {articles && shown.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          {articles.length === 0 ? 'Nothing here yet. Add the first article.' : 'No articles match your search.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {shown.map((a) => {
          const expanded = open === a.id
          return (
            <div key={a.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{a.category}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(a.updated_at).toLocaleDateString()}</span>
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{a.title}</h3>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{expanded ? a.content : `${a.content.slice(0, 140)}${a.content.length > 140 ? '…' : ''}`}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {tagList(a.tags).map((t) => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>#{t}</span>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{a.created_by_name ? `By ${a.created_by_name}` : ''}</span>
                <span style={{ display: 'flex', gap: 10 }}>
                  {a.content.length > 140 && <button style={linkBtn} onClick={() => setOpen(expanded ? null : a.id)}>{expanded ? 'Show less' : 'Read more'}</button>}
                  {a.can_manage && <button style={linkBtn} onClick={() => setForm({ id: a.id, title: a.title, category: a.category, content: a.content, tags: a.tags ?? '', meeting_id: a.meeting_id })}>Edit</button>}
                  {a.can_manage && <button style={linkBtn} onClick={() => void remove(a)}>Delete</button>}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12 }
