import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { ExportMenu } from '../components/ExportMenu';

type TabType = 'all' | 'protocols' | 'sops' | 'reports' | 'templates' | 'archives';

interface Document {
  id: string;
  name: string;
  type: 'protocol' | 'sop' | 'report' | 'template' | 'form' | 'certificate' | 'other';
  category: string;
  version: string;
  status: 'draft' | 'pending_review' | 'approved' | 'archived' | 'expired';
  size: string;
  uploadedBy: string;
  uploadedAt: string;
  lastModified: string;
  expiresAt?: string;
  tags: string[];
  description: string;
  downloads: number;
  reviewedBy?: string;
  approvedBy?: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  createdAt: string;
}

const INITIAL_DOCUMENTS: Document[] = [
  {
    id: 'DOC-001',
    name: 'PCR Protocol v2.3',
    type: 'protocol',
    category: 'Molecular Biology',
    version: '2.3',
    status: 'approved',
    size: '2.4 MB',
    uploadedBy: 'Dr. Sarah Chen',
    uploadedAt: '2024-01-10',
    lastModified: '2024-01-15',
    tags: ['PCR', 'DNA', 'Amplification'],
    description: 'Standard operating procedure for PCR amplification of DNA samples.',
    downloads: 45,
    reviewedBy: 'Dr. Michael Brown',
    approvedBy: 'Lab Director',
  },
  {
    id: 'DOC-002',
    name: 'Lab Safety Guidelines',
    type: 'sop',
    category: 'Safety',
    version: '4.1',
    status: 'approved',
    size: '5.8 MB',
    uploadedBy: 'Safety Officer',
    uploadedAt: '2024-01-05',
    lastModified: '2024-01-05',
    expiresAt: '2025-01-05',
    tags: ['Safety', 'Guidelines', 'Mandatory'],
    description: 'Comprehensive lab safety guidelines for all personnel.',
    downloads: 128,
    reviewedBy: 'Safety Committee',
    approvedBy: 'Lab Director',
  },
  {
    id: 'DOC-003',
    name: 'Monthly Equipment Report Template',
    type: 'template',
    category: 'Equipment',
    version: '1.0',
    status: 'approved',
    size: '156 KB',
    uploadedBy: 'Admin',
    uploadedAt: '2024-01-08',
    lastModified: '2024-01-08',
    tags: ['Template', 'Equipment', 'Report'],
    description: 'Standard template for monthly equipment utilization reports.',
    downloads: 23,
  },
  {
    id: 'DOC-004',
    name: 'Sample Collection Form',
    type: 'form',
    category: 'Samples',
    version: '3.0',
    status: 'pending_review',
    size: '89 KB',
    uploadedBy: 'John Smith',
    uploadedAt: '2024-01-20',
    lastModified: '2024-01-22',
    tags: ['Form', 'Samples', 'Collection'],
    description: 'Updated form for sample collection with new fields.',
    downloads: 5,
  },
  {
    id: 'DOC-005',
    name: 'Western Blot Analysis Protocol',
    type: 'protocol',
    category: 'Protein Analysis',
    version: '1.5',
    status: 'draft',
    size: '1.8 MB',
    uploadedBy: 'Emily Davis',
    uploadedAt: '2024-01-18',
    lastModified: '2024-01-24',
    tags: ['Western Blot', 'Protein', 'Protocol'],
    description: 'Draft protocol for western blot analysis.',
    downloads: 2,
  },
  {
    id: 'DOC-006',
    name: 'Q3 2023 Research Report',
    type: 'report',
    category: 'Reports',
    version: '1.0',
    status: 'archived',
    size: '12.5 MB',
    uploadedBy: 'Lab Director',
    uploadedAt: '2023-10-15',
    lastModified: '2023-10-15',
    tags: ['Report', 'Quarterly', 'Research'],
    description: 'Quarterly research progress report for Q3 2023.',
    downloads: 34,
    approvedBy: 'Lab Director',
  },
  {
    id: 'DOC-007',
    name: 'Calibration Certificate - Centrifuge',
    type: 'certificate',
    category: 'Equipment',
    version: '1.0',
    status: 'approved',
    size: '450 KB',
    uploadedBy: 'Equipment Manager',
    uploadedAt: '2024-01-12',
    lastModified: '2024-01-12',
    expiresAt: '2025-01-12',
    tags: ['Certificate', 'Calibration', 'Equipment'],
    description: 'Annual calibration certificate for Centrifuge XR-500.',
    downloads: 8,
    approvedBy: 'Quality Manager',
  },
];

const INITIAL_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Protocols', parentId: null, documentCount: 15, createdAt: '2024-01-01' },
  { id: 'f2', name: 'SOPs', parentId: null, documentCount: 22, createdAt: '2024-01-01' },
  { id: 'f3', name: 'Reports', parentId: null, documentCount: 45, createdAt: '2024-01-01' },
  { id: 'f4', name: 'Templates', parentId: null, documentCount: 12, createdAt: '2024-01-01' },
  { id: 'f5', name: 'Certificates', parentId: null, documentCount: 8, createdAt: '2024-01-01' },
  { id: 'f6', name: 'Archives', parentId: null, documentCount: 89, createdAt: '2024-01-01' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#374151', text: '#9ca3af' },
  pending_review: { bg: '#92400e', text: '#fcd34d' },
  approved: { bg: '#166534', text: '#86efac' },
  archived: { bg: '#4b5563', text: '#d1d5db' },
  expired: { bg: '#991b1b', text: '#fca5a5' },
};

const TYPE_ICONS: Record<string, string> = {
  protocol: 'PRO',
  sop: 'SOP',
  report: 'RPT',
  template: 'TPL',
  form: 'FRM',
  certificate: 'CRT',
  other: 'DOC',
};

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [documents, setDocuments] = useState<Document[]>(INITIAL_DOCUMENTS);
  const [folders] = useState<Folder[]>(INITIAL_FOLDERS);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'downloads'>('date');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docForm, setDocForm] = useState({
    name: '',
    type: 'protocol' as Document['type'],
    category: '',
    version: '1.0',
    description: '',
    tags: '',
  });

  const handleUpload = () => {
    if (!docForm.name || !docForm.category) {
      toast.error('Please fill in required fields');
      return;
    }

    const newDoc: Document = {
      id: `DOC-${String(documents.length + 1).padStart(3, '0')}`,
      name: docForm.name,
      type: docForm.type,
      category: docForm.category,
      version: docForm.version,
      status: 'draft',
      size: '1.2 MB',
      uploadedBy: 'Current User',
      uploadedAt: new Date().toISOString().split('T')[0],
      lastModified: new Date().toISOString().split('T')[0],
      tags: docForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      description: docForm.description,
      downloads: 0,
    };

    setDocuments(prev => [newDoc, ...prev]);
    toast.success('Document uploaded successfully');
    resetForm();
  };

  const resetForm = () => {
    setDocForm({ name: '', type: 'protocol', category: '', version: '1.0', description: '', tags: '' });
    setShowUploadModal(false);
    setEditingDoc(null);
  };

  const handleEdit = (doc: Document) => {
    setDocForm({
      name: doc.name,
      type: doc.type,
      category: doc.category,
      version: doc.version,
      description: doc.description,
      tags: doc.tags.join(', '),
    });
    setEditingDoc(doc);
    setShowUploadModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingDoc) return;

    setDocuments(prev => prev.map(d => d.id === editingDoc.id ? {
      ...d,
      name: docForm.name,
      type: docForm.type,
      category: docForm.category,
      version: docForm.version,
      description: docForm.description,
      tags: docForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      lastModified: new Date().toISOString().split('T')[0],
    } : d));
    toast.success('Document updated');
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this document?')) {
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
      setSelectedDoc(null);
    }
  };

  const handleStatusChange = (id: string, newStatus: Document['status']) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: newStatus, lastModified: new Date().toISOString().split('T')[0] } : d));
    toast.success(`Document status updated to ${newStatus.replace('_', ' ')}`);
  };

  const handleDownload = (doc: Document) => {
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, downloads: d.downloads + 1 } : d));
    toast.success(`Downloading ${doc.name}...`);
  };

  // Filtering
  const filteredDocs = documents.filter(doc => {
    // Tab filter
    if (activeTab === 'protocols' && doc.type !== 'protocol') return false;
    if (activeTab === 'sops' && doc.type !== 'sop') return false;
    if (activeTab === 'reports' && doc.type !== 'report') return false;
    if (activeTab === 'templates' && doc.type !== 'template') return false;
    if (activeTab === 'archives' && doc.status !== 'archived') return false;

    // Status filter
    if (statusFilter && doc.status !== statusFilter) return false;

    // Type filter
    if (typeFilter && doc.type !== typeFilter) return false;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return doc.name.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.tags.some(t => t.toLowerCase().includes(q)) ||
        doc.category.toLowerCase().includes(q);
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'downloads') return b.downloads - a.downloads;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All Documents', count: documents.length },
    { key: 'protocols', label: 'Protocols', count: documents.filter(d => d.type === 'protocol').length },
    { key: 'sops', label: 'SOPs', count: documents.filter(d => d.type === 'sop').length },
    { key: 'reports', label: 'Reports', count: documents.filter(d => d.type === 'report').length },
    { key: 'templates', label: 'Templates', count: documents.filter(d => d.type === 'template').length },
    { key: 'archives', label: 'Archives', count: documents.filter(d => d.status === 'archived').length },
  ];

  return (
    <div className="page documents-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Document Management</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>Manage protocols, SOPs, reports, and lab documents</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <ExportMenu
            data={filteredDocs.map(d => ({
              ID: d.id,
              Name: d.name,
              Type: d.type,
              Category: d.category,
              Version: d.version,
              Status: d.status,
              'Uploaded By': d.uploadedBy,
              'Uploaded At': d.uploadedAt,
              'Last Modified': d.lastModified,
              Downloads: d.downloads,
            }))}
            filename="documents"
            title="Document Registry"
          />
          <button onClick={() => setShowUploadModal(true)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
            + Upload Document
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Documents', value: documents.length, icon: '#', color: 'var(--accent)' },
          { label: 'Pending Review', value: documents.filter(d => d.status === 'pending_review').length, icon: '?', color: '#f59e0b' },
          { label: 'Approved', value: documents.filter(d => d.status === 'approved').length, icon: '*', color: '#10b981' },
          { label: 'Expiring Soon', value: documents.filter(d => d.expiresAt && new Date(d.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length, icon: '!', color: '#ef4444' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: `${stat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontSize: 18, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {tab.label}
            <span style={{
              background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--surface2)',
              padding: '2px 8px',
              borderRadius: 10,
              fontSize: 12,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', flex: 1, minWidth: 200 }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="archived">Archived</option>
          <option value="expired">Expired</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="">All Types</option>
          <option value="protocol">Protocol</option>
          <option value="sop">SOP</option>
          <option value="report">Report</option>
          <option value="template">Template</option>
          <option value="form">Form</option>
          <option value="certificate">Certificate</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'date' | 'downloads')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
          <option value="downloads">Sort by Downloads</option>
        </select>
        {(searchQuery || statusFilter || typeFilter) && (
          <button onClick={() => { setSearchQuery(''); setStatusFilter(''); setTypeFilter(''); }} className="btn btn-secondary" style={{ padding: '10px 14px' }}>
            Clear Filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'var(--accent)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px 0 0 6px', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
            =
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'var(--accent)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 6px 6px 0', color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
            ::
          </button>
        </div>
      </div>

      {/* Document List/Grid */}
      {viewMode === 'list' ? (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Document</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Modified</th>
                <th style={{ textAlign: 'center', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Downloads</th>
                <th style={{ textAlign: 'right', padding: '14px 16px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No documents found
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          background: 'var(--surface2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}>
                          {TYPE_ICONS[doc.type]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }} onClick={() => { setSelectedDoc(doc); setShowDocModal(true); }}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {doc.category} • v{doc.version} • {doc.size}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', textTransform: 'capitalize' }}>{doc.type}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        background: STATUS_COLORS[doc.status].bg,
                        color: STATUS_COLORS[doc.status].text,
                      }}>
                        {doc.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {doc.lastModified}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text)' }}>
                      {doc.downloads}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleDownload(doc)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Download</button>
                        <button onClick={() => handleEdit(doc)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Edit</button>
                        <button onClick={() => handleDelete(doc.id)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', gridColumn: '1/-1' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>#</div>
              <p>No documents found</p>
            </div>
          ) : (
            filteredDocs.map(doc => (
              <div key={doc.id} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, cursor: 'pointer', transition: 'transform 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: 'var(--surface2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}>
                    {TYPE_ICONS[doc.type]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      background: STATUS_COLORS[doc.status].bg,
                      color: STATUS_COLORS[doc.status].text,
                    }}>
                      {doc.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 4 }} onClick={() => { setSelectedDoc(doc); setShowDocModal(true); }}>
                  {doc.name}
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginBottom: 12 }}>
                  {doc.category} • v{doc.version}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{doc.size}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{doc.downloads} downloads</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleDownload(doc); }} className="btn btn-primary" style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}>Download</button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(doc); }} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}>Edit</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Folders Section */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>Folders</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {folders.map(folder => (
            <div key={folder.id} style={{
              background: 'var(--surface)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <div style={{ fontSize: 24, color: 'var(--accent)' }}>[=]</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{folder.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{folder.documentCount} docs</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload/Edit Modal */}
      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 20 }}>
              {editingDoc ? 'Edit Document' : 'Upload Document'}
            </h2>

            {!editingDoc && (
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  padding: 40,
                  textAlign: 'center',
                  marginBottom: 20,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; toast.success('File received'); }}
              >
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={() => toast.success('File selected')} />
                <div style={{ fontSize: 32, color: 'var(--accent)', marginBottom: 12 }}>++</div>
                <p style={{ color: 'var(--text)', margin: 0, marginBottom: 4 }}>Drag and drop file here</p>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>or click to browse</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Document Name *</label>
                <input type="text" value={docForm.name} onChange={e => setDocForm({ ...docForm, name: e.target.value })} placeholder="Enter document name" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Type</label>
                  <select value={docForm.type} onChange={e => setDocForm({ ...docForm, type: e.target.value as Document['type'] })} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="protocol">Protocol</option>
                    <option value="sop">SOP</option>
                    <option value="report">Report</option>
                    <option value="template">Template</option>
                    <option value="form">Form</option>
                    <option value="certificate">Certificate</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Version</label>
                  <input type="text" value={docForm.version} onChange={e => setDocForm({ ...docForm, version: e.target.value })} placeholder="1.0" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Category *</label>
                <input type="text" value={docForm.category} onChange={e => setDocForm({ ...docForm, category: e.target.value })} placeholder="e.g., Molecular Biology, Safety" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Description</label>
                <textarea value={docForm.description} onChange={e => setDocForm({ ...docForm, description: e.target.value })} placeholder="Brief description..." rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Tags (comma-separated)</label>
                <input type="text" value={docForm.tags} onChange={e => setDocForm({ ...docForm, tags: e.target.value })} placeholder="e.g., PCR, Protocol, DNA" style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
              <button onClick={editingDoc ? handleSaveEdit : handleUpload} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                {editingDoc ? 'Save Changes' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Document Modal */}
      {showDocModal && selectedDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'monospace',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--accent)',
                }}>
                  {TYPE_ICONS[selectedDoc.type]}
                </div>
                <div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    background: STATUS_COLORS[selectedDoc.status].bg,
                    color: STATUS_COLORS[selectedDoc.status].text,
                  }}>
                    {selectedDoc.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '8px 0 0' }}>{selectedDoc.name}</h2>
                  <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: 14 }}>{selectedDoc.id}</p>
                </div>
              </div>
              <button onClick={() => { setShowDocModal(false); setSelectedDoc(null); }} style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer' }}>x</button>
            </div>

            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{selectedDoc.description}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Type', value: selectedDoc.type },
                { label: 'Category', value: selectedDoc.category },
                { label: 'Version', value: `v${selectedDoc.version}` },
                { label: 'Size', value: selectedDoc.size },
                { label: 'Uploaded By', value: selectedDoc.uploadedBy },
                { label: 'Uploaded At', value: selectedDoc.uploadedAt },
                { label: 'Last Modified', value: selectedDoc.lastModified },
                { label: 'Downloads', value: selectedDoc.downloads.toString() },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--surface2)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {selectedDoc.expiresAt && (
              <div style={{ background: '#92400e20', border: '1px solid #92400e', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                <span style={{ color: '#fcd34d', fontWeight: 600 }}>Expires: {selectedDoc.expiresAt}</span>
              </div>
            )}

            {selectedDoc.tags.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Tags</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selectedDoc.tags.map((tag, i) => (
                    <span key={i} style={{ padding: '4px 12px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text)', fontSize: 13 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDoc.status === 'pending_review' && (
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Review Actions</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleStatusChange(selectedDoc.id, 'approved')} className="btn btn-primary" style={{ padding: '8px 16px' }}>Approve</button>
                  <button onClick={() => handleStatusChange(selectedDoc.id, 'draft')} className="btn btn-secondary" style={{ padding: '8px 16px' }}>Request Changes</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => handleDownload(selectedDoc)} className="btn btn-primary" style={{ padding: '10px 20px' }}>Download</button>
              <button onClick={() => { handleEdit(selectedDoc); setShowDocModal(false); }} className="btn btn-secondary" style={{ padding: '10px 20px' }}>Edit</button>
              <button onClick={() => { handleDelete(selectedDoc.id); setShowDocModal(false); }} className="btn btn-secondary" style={{ padding: '10px 20px', color: '#ef4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
