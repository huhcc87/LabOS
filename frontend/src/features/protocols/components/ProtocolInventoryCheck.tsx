import React, { useState, useMemo } from 'react'
import type { Protocol } from '../types/protocol.types'

// Mock inventory item type - would come from inventory feature
interface InventoryItem {
  id: string
  name: string
  catalogNumber?: string
  currentQuantity: number
  unit: string
  minQuantity: number
  location: string
  expirationDate?: string
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired'
}

// Linked reagent type
interface LinkedReagent {
  protocolReagent: string
  inventoryItem?: InventoryItem
  requiredQuantity: number
  unit: string
  isLinked: boolean
  isAvailable: boolean
  willDeplete: boolean
}

interface Props {
  protocol: Protocol
  onStartProtocol: () => void
  onDeductInventory: (items: { itemId: string; quantity: number }[]) => void
}

// Mock inventory data - would come from API/context
const MOCK_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'PBS Buffer 10X', catalogNumber: 'P7059', currentQuantity: 2500, unit: 'mL', minQuantity: 500, location: 'Shelf A-1', status: 'in_stock' },
  { id: '2', name: 'DMEM Media', catalogNumber: 'D5796', currentQuantity: 100, unit: 'mL', minQuantity: 200, location: 'Fridge 2', status: 'low_stock' },
  { id: '3', name: 'FBS (Fetal Bovine Serum)', catalogNumber: 'F2442', currentQuantity: 0, unit: 'mL', minQuantity: 50, location: 'Freezer -20', status: 'out_of_stock' },
  { id: '4', name: 'Trypsin-EDTA 0.25%', catalogNumber: 'T4049', currentQuantity: 150, unit: 'mL', minQuantity: 50, location: 'Fridge 2', status: 'in_stock' },
  { id: '5', name: 'Penicillin-Streptomycin', catalogNumber: 'P4333', currentQuantity: 80, unit: 'mL', minQuantity: 20, location: 'Freezer -20', status: 'in_stock', expirationDate: '2025-02-15' },
  { id: '6', name: 'Ethanol 70%', catalogNumber: 'E7023', currentQuantity: 5000, unit: 'mL', minQuantity: 1000, location: 'Cabinet B-2', status: 'in_stock' },
  { id: '7', name: 'Sodium Chloride', catalogNumber: 'S9888', currentQuantity: 250, unit: 'g', minQuantity: 100, location: 'Shelf C-3', status: 'in_stock' },
  { id: '8', name: 'Tris Base', catalogNumber: 'T1503', currentQuantity: 45, unit: 'g', minQuantity: 50, location: 'Shelf C-3', status: 'low_stock' },
]

// Smart matching function to link reagents to inventory
function findBestMatch(reagentName: string, inventory: InventoryItem[]): InventoryItem | undefined {
  const normalizedReagent = reagentName.toLowerCase()

  // Try exact match first
  let match = inventory.find(item =>
    item.name.toLowerCase() === normalizedReagent ||
    item.catalogNumber?.toLowerCase() === normalizedReagent
  )

  if (!match) {
    // Try partial match
    match = inventory.find(item =>
      item.name.toLowerCase().includes(normalizedReagent) ||
      normalizedReagent.includes(item.name.toLowerCase())
    )
  }

  if (!match) {
    // Try word-based matching
    const reagentWords = normalizedReagent.split(/[\s,\-()]+/).filter(w => w.length > 2)
    match = inventory.find(item => {
      const itemWords = item.name.toLowerCase().split(/[\s,\-()]+/)
      return reagentWords.some(rw => itemWords.some(iw => iw.includes(rw) || rw.includes(iw)))
    })
  }

  return match
}

// Parse quantity from reagent string (e.g., "PBS 100mL" -> { qty: 100, unit: 'mL' })
function parseQuantity(reagentStr: string): { quantity: number; unit: string } {
  const match = reagentStr.match(/(\d+(?:\.\d+)?)\s*(mL|L|g|mg|µL|µg|kg)/i)
  if (match) {
    return { quantity: parseFloat(match[1]), unit: match[2] }
  }
  return { quantity: 1, unit: 'unit' }
}

export default function ProtocolInventoryCheck({ protocol, onStartProtocol, onDeductInventory }: Props) {
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null)
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({})
  const [deductAfterRun, setDeductAfterRun] = useState(true)

  // Analyze reagents and link to inventory
  const linkedReagents = useMemo<LinkedReagent[]>(() => {
    return protocol.reagents.map(reagent => {
      const manualLinkId = manualLinks[reagent]
      const inventoryItem = manualLinkId
        ? MOCK_INVENTORY.find(i => i.id === manualLinkId)
        : findBestMatch(reagent, MOCK_INVENTORY)

      const { quantity, unit } = parseQuantity(reagent)

      const isAvailable = inventoryItem
        ? inventoryItem.currentQuantity >= quantity && inventoryItem.status !== 'expired'
        : false

      const willDeplete = inventoryItem
        ? inventoryItem.currentQuantity - quantity < inventoryItem.minQuantity
        : false

      return {
        protocolReagent: reagent,
        inventoryItem,
        requiredQuantity: quantity,
        unit,
        isLinked: !!inventoryItem,
        isAvailable,
        willDeplete,
      }
    })
  }, [protocol.reagents, manualLinks])

  const allAvailable = linkedReagents.every(r => !r.isLinked || r.isAvailable)
  const linkedCount = linkedReagents.filter(r => r.isLinked).length
  const availableCount = linkedReagents.filter(r => r.isAvailable).length
  const warningCount = linkedReagents.filter(r => r.willDeplete).length

  const handleLink = (reagent: string, itemId: string) => {
    setManualLinks(prev => ({ ...prev, [reagent]: itemId }))
    setShowLinkModal(null)
  }

  const handleStartProtocol = () => {
    onStartProtocol()
    if (deductAfterRun) {
      const deductions = linkedReagents
        .filter(r => r.isLinked && r.inventoryItem)
        .map(r => ({ itemId: r.inventoryItem!.id, quantity: r.requiredQuantity }))
      // Would be called after protocol completion
      // onDeductInventory(deductions)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
            {protocol.reagents.length}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Total Reagents
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
            {linkedCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Linked to Inventory
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: availableCount === linkedCount ? '#10b981' : '#ef4444' }}>
            {availableCount}/{linkedCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Available
          </div>
        </div>
        <div style={{
          background: warningCount > 0 ? '#f59e0b22' : 'var(--surface)',
          border: `1px solid ${warningCount > 0 ? '#f59e0b' : 'var(--border)'}`,
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: warningCount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
            {warningCount}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Low Stock Warnings
          </div>
        </div>
      </div>

      {/* Availability Status */}
      {!allAvailable && (
        <div style={{
          background: '#7f1d1d22', border: '1px solid #ef4444',
          borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 14 }}>
              Some reagents are unavailable
            </div>
            <div style={{ color: '#fca5a5', fontSize: 13, marginTop: 2 }}>
              {linkedReagents.filter(r => r.isLinked && !r.isAvailable).length} linked reagent(s)
              are out of stock or have insufficient quantity
            </div>
          </div>
        </div>
      )}

      {/* Reagent List */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
            Reagent Inventory Status
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={deductAfterRun}
              onChange={e => setDeductAfterRun(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Auto-deduct quantities after run
            </span>
          </label>
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {linkedReagents.map((lr, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px', borderBottom: index < linkedReagents.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 12,
                background: !lr.isLinked ? '#3b82f611' : !lr.isAvailable ? '#ef444411' : lr.willDeplete ? '#f59e0b11' : 'transparent',
              }}
            >
              {/* Status Icon */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: !lr.isLinked ? '#3b82f6' : !lr.isAvailable ? '#ef4444' : lr.willDeplete ? '#f59e0b' : '#10b981',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {!lr.isLinked ? '?' : !lr.isAvailable ? '✕' : lr.willDeplete ? '!' : '✓'}
              </div>

              {/* Reagent Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                  {lr.protocolReagent}
                </div>
                {lr.isLinked && lr.inventoryItem && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>📍 {lr.inventoryItem.location}</span>
                    <span>📦 {lr.inventoryItem.currentQuantity} {lr.inventoryItem.unit} available</span>
                    {lr.inventoryItem.catalogNumber && <span>#{lr.inventoryItem.catalogNumber}</span>}
                  </div>
                )}
                {!lr.isLinked && (
                  <div style={{ color: '#60a5fa', fontSize: 12, marginTop: 2 }}>
                    Not linked to inventory
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {lr.isLinked && (
                  <span style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 500,
                    background: !lr.isAvailable ? '#7f1d1d' : lr.willDeplete ? '#78350f' : '#065f46',
                    color: !lr.isAvailable ? '#fca5a5' : lr.willDeplete ? '#fcd34d' : '#6ee7b7',
                  }}>
                    {!lr.isAvailable ? 'OUT OF STOCK' : lr.willDeplete ? 'LOW AFTER USE' : 'AVAILABLE'}
                  </span>
                )}
                <button
                  onClick={() => setShowLinkModal(lr.protocolReagent)}
                  style={{
                    background: 'var(--surface-hover)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text-muted)', padding: '4px 8px',
                    cursor: 'pointer', fontSize: 11,
                  }}
                >
                  {lr.isLinked ? 'Change' : 'Link'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={handleStartProtocol}
          disabled={!allAvailable && linkedCount > 0}
          style={{
            background: allAvailable || linkedCount === 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--surface)',
            border: 'none', borderRadius: 8, color: '#fff',
            padding: '12px 24px', cursor: allAvailable || linkedCount === 0 ? 'pointer' : 'not-allowed',
            fontSize: 14, fontWeight: 600, opacity: allAvailable || linkedCount === 0 ? 1 : 0.5,
          }}
        >
          ▶ Start Protocol
        </button>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <>
          <div
            onClick={() => setShowLinkModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            width: 500, maxHeight: '70vh', overflow: 'hidden', zIndex: 301,
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16 }}>Link to Inventory</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  {showLinkModal}
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(null)}
                style={{
                  background: 'var(--surface-hover)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-muted)', padding: '6px 10px',
                  cursor: 'pointer', fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: 16, maxHeight: 400, overflow: 'auto' }}>
              {MOCK_INVENTORY.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleLink(showLinkModal, item.id)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg)', border: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: item.status === 'in_stock' ? '#10b981' : item.status === 'low_stock' ? '#f59e0b' : '#ef4444',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                      {item.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                      {item.catalogNumber && `#${item.catalogNumber} • `}
                      {item.currentQuantity} {item.unit} • {item.location}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 4,
                    background: item.status === 'in_stock' ? '#065f46' : item.status === 'low_stock' ? '#78350f' : '#7f1d1d',
                    color: item.status === 'in_stock' ? '#6ee7b7' : item.status === 'low_stock' ? '#fcd34d' : '#fca5a5',
                  }}>
                    {item.status.replace('_', ' ').toUpperCase()}
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  setManualLinks(prev => {
                    const newLinks = { ...prev }
                    delete newLinks[showLinkModal]
                    return newLinks
                  })
                  setShowLinkModal(null)
                }}
                style={{
                  width: '100%', textAlign: 'center', padding: 12, borderRadius: 8,
                  background: 'transparent', border: '1px dashed var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
                }}
              >
                Remove Link (Don't track)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
