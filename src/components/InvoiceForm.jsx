import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { SERVICES } from '../lib/services'
import { generateInvoiceNumber, calculateTotals, formatCAD, getProvinceTaxLabel, getProvinceTaxRate, CANADIAN_PROVINCES } from '../lib/invoiceUtils'

const EMPTY_LINE = () => ({
  _id: Math.random().toString(36).slice(2),
  service_id: '',
  service_name: '',
  description: '',
  quantity: 1,
  people: 1,
  rate: 0,
})

/**
 * FIXED: NumInput
 * Uses onFocus select() and specific inputMode to make 
 * replacing the default "1" much easier on mobile and desktop.
 */
function NumInput({ value, onChange, min = '0', step = '1', style = {}, label }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      {label && <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>{label}</label>}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        className="form-control"
        style={{ ...style, height: '38px' }}
        value={value}
        onChange={onChange}
        onFocus={(e) => e.target.select()} // Automatically highlights the "1" so typing replaces it
      />
    </div>
  )
}

export default function InvoiceForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [province, setProvince] = useState('')
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0])
  const [lineItems, setLineItems] = useState([EMPTY_LINE()])
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [gstEnabled, setGstEnabled] = useState(false)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')

  const [allClients, setAllClients] = useState([])
  const [clientSuggestions, setClientSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const clientInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    fetchClients()
    if (isEditing) loadInvoice()
    else generateNumber()
  }, [id])

  async function fetchClients() {
    const { data } = await supabase.from('invoices').select('client_name').order('client_name')
    if (data) {
      const unique = [...new Set(data.map(r => r.client_name).filter(Boolean))]
      setAllClients(unique)
    }
  }

  async function generateNumber() {
    const { data } = await supabase.from('invoices').select('invoice_number')
    const numbers = (data || []).map(r => r.invoice_number)
    setInvoiceNumber(generateInvoiceNumber(numbers))
  }

  async function loadInvoice() {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }
    setInvoiceNumber(data.invoice_number)
    setClientName(data.client_name)
    setClientEmail(data.client_email || '')
    setProvince(data.province || '')
    setServiceDate(data.service_date)
    setLineItems(data.services?.length
      ? data.services.map(s => ({ ...s, _id: Math.random().toString(36).slice(2), people: s.people || 1 }))
      : [EMPTY_LINE()])
    setDiscountType(data.discount_type || 'none')
    setDiscountValue(data.discount_value || '')
    setGstEnabled(data.gst_enabled || false)
    setNotes(data.notes || '')
    setStatus(data.status || 'draft')
    setLoading(false)
  }

  function handleClientInput(val) {
    setClientName(val)
    if (val.length > 0) {
      const matches = allClients.filter(c => c.toLowerCase().includes(val.toLowerCase()))
      setClientSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  function selectClient(name) {
    setClientName(name)
    setShowSuggestions(false)
  }

  function handleServiceSelect(idx, serviceId) {
    const svc = SERVICES.find(s => s.id === serviceId)
    setLineItems(prev => prev.map((item, i) =>
      i !== idx ? item : {
        ...item,
        service_id:   serviceId,
        service_name: svc ? svc.name : '',
        description:  svc ? svc.description : '',
        rate:         svc ? svc.rate : 0,
        quantity:     1,
        people:       1,
      }
    ))
  }

  function updateLine(idx, field, value) {
    // If value is empty string (user cleared input), default to 0 for numbers
    const finalValue = (field === 'quantity' || field === 'people' || field === 'rate') && value === '' ? 0 : value
    setLineItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: finalValue }))
  }

  function addLine() { setLineItems(prev => [...prev, EMPTY_LINE()]) }
  function removeLine(idx) {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  const totals = calculateTotals(lineItems, discountType, parseFloat(discountValue) || 0, gstEnabled, province)
  const taxLabel = getProvinceTaxLabel(province)
  const taxRate = getProvinceTaxRate(province)

  async function handleSave(e) {
    e.preventDefault()
    if (!clientName.trim()) { setError('Client name is required.'); return }
    if (lineItems.every(l => !l.service_name)) { setError('Add at least one service.'); return }
    setSaving(true)
    setError('')

    const payload = {
      invoice_number:  invoiceNumber,
      client_name:     clientName.trim(),
      client_email:    clientEmail.trim() || null,
      province:        province || null,
      service_date:    serviceDate,
      services:        lineItems.filter(l => l.service_name),
      discount_type:   discountType,
      discount_value:  discountType !== 'none' ? parseFloat(discountValue) || 0 : 0,
      discount_amount: totals.discountAmount,
      gst_enabled:     gstEnabled,
      gst_amount:      totals.gstAmount,
      subtotal:        totals.subtotal,
      total:           totals.total,
      notes:           notes.trim() || null,
      status,
    }

    let result
    if (isEditing) {
      result = await supabase.from('invoices').update(payload).eq('id', id)
    } else {
      result = await supabase.from('invoices').insert([payload]).select().single()
    }

    if (result.error) { setError(result.error.message); setSaving(false); return }
    const newId = isEditing ? id : result.data?.id
    navigate(newId ? `/invoice/${newId}` : '/')
  }

  if (loading) return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content" style={{ textAlign: 'center', paddingTop: 60, color: 'var(--muted)' }}>Loading…</div>
    </div>
  )

  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content">
        <div className="page-header">
          <h1>{isEditing ? 'Edit Invoice' : 'New Invoice'}</h1>
          <Link to={isEditing ? `/invoice/${id}` : '/'} className="btn btn-ghost btn-sm">Cancel</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSave}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h2>Invoice Details</h2></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Invoice #</label>
                  <input className="form-control" value={invoiceNumber} readOnly style={{ background: '#f8fafc', color: 'var(--muted)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Client Name <span className="required">*</span></label>
                  <div className="autocomplete-wrapper">
                    <input
                      ref={clientInputRef}
                      className="form-control"
                      value={clientName}
                      onChange={e => handleClientInput(e.target.value)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      placeholder="e.g. Marie Tremblay"
                      required
                      autoComplete="off"
                    />
                    {showSuggestions && (
                      <div className="autocomplete-list">
                        {clientSuggestions.map(name => (
                          <div key={name} className="autocomplete-item" onMouseDown={() => selectClient(name)}>
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Client Email</label>
                  <input type="email" className="form-control" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@email.com" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ maxWidth: 240 }}>
                  <label className="form-label">Date of Service <span className="required">*</span></label>
                  <input type="date" className="form-control" value={serviceDate} onChange={e => setServiceDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Province</label>
                  <select className="form-control" value={province} onChange={e => setProvince(e.target.value)}>
                    {CANADIAN_PROVINCES.map(p => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h2>Services</h2></div>
            <div className="card-body">
              <div className="line-items">
                {lineItems.map((item, idx) => (
                  <div key={item._id} className="line-item">
                    <div className="line-item-service">
                      <label className="form-label">Service</label>
                      <select className="form-control" value={item.service_id} onChange={e => handleServiceSelect(idx, e.target.value)}>
                        <option value="">— Select a service —</option>
                        {SERVICES.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.rate > 0 ? formatCAD(s.rate) + s.unitLabel : 'Free'})</option>
                        ))}
                      </select>
                    </div>

                    {item.service_id === 'custom' && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Custom Service Name</label>
                        <input className="form-control" value={item.service_name} onChange={e => updateLine(idx, 'service_name', e.target.value)} placeholder="e.g. ChatGPT Setup Session" />
                      </div>
                    )}

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Description (optional)</label>
                      <input className="form-control" value={item.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Add detail…" />
                    </div>

                    <div className="form-row" style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                      {item.service_id === 'group-workshop' ? (
                        <>
                          <NumInput
                            label="People"
                            value={item.people}
                            style={{ width: '80px' }}
                            onChange={e => updateLine(idx, 'people', e.target.value === '' ? '' : parseInt(e.target.value))}
                          />
                          <NumInput
                            label="Sessions"
                            value={item.quantity}
                            style={{ width: '80px' }}
                            onChange={e => updateLine(idx, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))}
                          />
                          <NumInput
                            label="Rate/Person"
                            value={item.rate}
                            step="0.01"
                            style={{ width: '100px' }}
                            onChange={e => updateLine(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        </>
                      ) : (
                        <>
                          <NumInput
                            label="Qty / Hrs"
                            value={item.quantity}
                            step="0.5"
                            style={{ width: '80px' }}
                            onChange={e => updateLine(idx, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                          <NumInput
                            label="Rate (CAD)"
                            value={item.rate}
                            step="0.01"
                            style={{ width: '100px' }}
                            onChange={e => updateLine(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        </>
                      )}
                      <button type="button" className="btn btn-danger btn-icon btn-sm" style={{ marginBottom: '2px' }} onClick={() => removeLine(idx)} disabled={lineItems.length === 1}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={addLine}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Service Line
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h2>Tax & Totals</h2></div>
            <div className="card-body">
              <div className="toggle-row" style={{ marginBottom: 20 }}>
                <label className="toggle">
                  <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span>
                  <strong>Include {taxLabel} {province ? `(${taxRate}%)` : ''}</strong>
                </span>
              </div>

              <div style={{ maxWidth: 300, marginLeft: 'auto' }}>
                <div className="totals-row"><span>Subtotal</span><span>{formatCAD(totals.subtotal)}</span></div>
                {gstEnabled && (
                  <div className="totals-row"><span>{taxLabel}</span><span>{formatCAD(totals.gstAmount)}</span></div>
                )}
                <div className="totals-row total"><span>Total (CAD)</span><span>{formatCAD(totals.total)}</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Link to={isEditing ? `/invoice/${id}` : '/'} className="btn btn-ghost">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEditing ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
