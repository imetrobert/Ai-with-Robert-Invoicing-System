import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { SERVICES } from '../lib/services'
import { generateInvoiceNumber, calculateTotals, formatCAD, getProvinceTaxLabel, getProvinceTaxRate, CANADIAN_PROVINCES } from '../lib/invoiceUtils'

const EMPTY_LINE = () => ({
  _id: Math.random().toString(36).slice(2),
  service_id: '', service_name: '', description: '',
  quantity: 1, people: 1, rate: 0,
})

function NumInput({ value, onChange, min = '0', step = '1', style = {}, label }) {
  return (
    <div style={{ marginBottom: 0 }}>
      {label && <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>{label}</label>}
      <input
        type="number" inputMode="decimal" min={min} step={step}
        className="form-control"
        style={{ ...style, fontSize: 16 }}
        value={value}
        onChange={onChange}
        onFocus={e => e.target.select()}
      />
    </div>
  )
}

function AutocompleteField({
  label, value, onChange, suggestions, onSelect,
  placeholder, type = 'text', required = false, inputRef,
}) {
  const [show, setShow] = useState(false)
  const [filtered, setFiltered] = useState([])

  function handleChange(val) {
    onChange(val)
    if (val.length > 0) {
      const matches = suggestions.filter(s =>
        s.toLowerCase().includes(val.toLowerCase())
      )
      setFiltered(matches)
      setShow(matches.length > 0)
    } else {
      setShow(false)
    }
  }

  function handleSelect(val) {
    onSelect ? onSelect(val) : onChange(val)
    setShow(false)
  }

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}{required && <span className="required"> *</span>}
        </label>
      )}
      <div className="autocomplete-wrapper">
        <input
          ref={inputRef}
          type={type}
          className="form-control"
          value={value}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          onChange={e => handleChange(e.target.value)}
          onFocus={() => {
            if (value && suggestions.length) {
              const matches = suggestions.filter(s =>
                s.toLowerCase().includes(value.toLowerCase())
              )
              setFiltered(matches)
              setShow(matches.length > 0)
            }
          }}
          onBlur={() => setTimeout(() => setShow(false), 150)}
        />
        {show && (
          <div className="autocomplete-list">
            {filtered.map((item, i) => (
              <div
                key={i}
                className="autocomplete-item"
                onMouseDown={() => handleSelect(item)}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressPostal, setAddressPostal] = useState('')
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0])
  const [lineItems, setLineItems] = useState([EMPTY_LINE()])
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [gstEnabled, setGstEnabled] = useState(false)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('draft')

  const [allClients, setAllClients] = useState([])
  const [nameSuggestions, setNameSuggestions]     = useState([])
  const [emailSuggestions, setEmailSuggestions]   = useState([])
  const [addr1Suggestions, setAddr1Suggestions]   = useState([])
  const [addr2Suggestions, setAddr2Suggestions]   = useState([])
  const [citySuggestions, setCitySuggestions]     = useState([])
  const [postalSuggestions, setPostalSuggestions] = useState([])
  const [notesSuggestions, setNotesSuggestions]   = useState([])

  const clientInputRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    fetchClients()
    if (isEditing) loadInvoice()
    else generateNumber()
  }, [id])

  async function fetchClients() {
    const { data } = await supabase
      .from('invoices')
      .select('client_name, client_email, address_line1, address_line2, address_city, address_postal, province, notes')
      .order('created_at', { ascending: false })

    if (!data) return
    setAllClients(data)

    const unique = (arr) => [...new Set(arr.filter(Boolean))]
    setNameSuggestions(unique(data.map(r => r.client_name)))
    setEmailSuggestions(unique(data.map(r => r.client_email)))
    setAddr1Suggestions(unique(data.map(r => r.address_line1)))
    setAddr2Suggestions(unique(data.map(r => r.address_line2)))
    setCitySuggestions(unique(data.map(r => r.address_city)))
    setPostalSuggestions(unique(data.map(r => r.address_postal)))
    setNotesSuggestions(unique(data.map(r => r.notes)))
  }

  async function generateNumber() {
    const { data } = await supabase.from('invoices').select('invoice_number')
    setInvoiceNumber(generateInvoiceNumber((data || []).map(r => r.invoice_number)))
  }

  async function loadInvoice() {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }
    setInvoiceNumber(data.invoice_number)
    setClientName(data.client_name)
    setClientEmail(data.client_email || '')
    setProvince(data.province || '')
    setAddressLine1(data.address_line1 || '')
    setAddressLine2(data.address_line2 || '')
    setAddressCity(data.address_city || '')
    setAddressPostal(data.address_postal || '')
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

  function handleClientSelect(name) {
    setClientName(name)
    const matches = allClients.filter(r => r.client_name === name)
    if (!matches.length) return

    // allClients is fetched ordered by created_at descending, so matches[0]
    // is this client's most recent invoice — use it as the source of truth
    // for auto-fill instead of requiring every past invoice to match exactly.
    const c = matches[0]
    if (c.client_email)   setClientEmail(c.client_email)
    if (c.address_line1)  setAddressLine1(c.address_line1)
    setAddressLine2(c.address_line2 || '')
    if (c.address_city)   setAddressCity(c.address_city)
    if (c.address_postal) setAddressPostal(c.address_postal)
    if (c.province)       setProvince(c.province)
  }

  function handleServiceSelect(idx, serviceId) {
    const svc = SERVICES.find(s => s.id === serviceId)
    setLineItems(prev => prev.map((item, i) => i !== idx ? item : {
      ...item, service_id: serviceId,
      service_name: svc?.name || '', description: svc?.description || '',
      rate: svc?.rate || 0, quantity: 1, people: 1,
    }))
  }

  function updateLine(idx, field, value) {
    const v = (field === 'quantity' || field === 'people' || field === 'rate') && value === '' ? 0 : value
    setLineItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: v }))
  }

  function addLine() { setLineItems(prev => [...prev, EMPTY_LINE()]) }
  function removeLine(idx) {
    if (lineItems.length === 1) return
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  const totals = calculateTotals(lineItems, discountType, parseFloat(discountValue) || 0, gstEnabled, province)
  const taxLabel = getProvinceTaxLabel(province)
  const taxRate = getProvinceTaxRate(province)

  function lineTotal(item) {
    const people = item.service_id === 'group-workshop' ? (parseFloat(item.people) || 1) : 1
    return people * (parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || 0)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!clientName.trim()) { setError('Client name is required.'); return }
    if (lineItems.every(l => !l.service_name)) { setError('Add at least one service.'); return }
    setSaving(true); setError('')

    const payload = {
      invoice_number: invoiceNumber, client_name: clientName.trim(),
      client_email: clientEmail.trim() || null, province: province || null,
      address_line1: addressLine1.trim() || null,
      address_line2: addressLine2.trim() || null,
      address_city: addressCity.trim() || null,
      address_postal: addressPostal.trim() || null,
      service_date: serviceDate, services: lineItems.filter(l => l.service_name),
      discount_type: discountType,
      discount_value: discountType !== 'none' ? parseFloat(discountValue) || 0 : 0,
      discount_amount: totals.discountAmount, gst_enabled: gstEnabled,
      gst_amount: totals.gstAmount, subtotal: totals.subtotal,
      total: totals.total, notes: notes.trim() || null, status,
    }

    let result
    if (isEditing) result = await supabase.from('invoices').update(payload).eq('id', id)
    else result = await supabase.from('invoices').insert([payload]).select().single()

    if (result.error) { setError(result.error.message); setSaving(false); return }
    navigate(isEditing ? `/invoice/${id}` : result.data?.id ? `/invoice/${result.data.id}` : '/')
  }

  if (loading) return (
    <div className="app-layout"><Navbar session={session} />
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
          {/* Invoice Details */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header"><h2>Invoice Details</h2></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Invoice #</label>
                  <input className="form-control" value={invoiceNumber} readOnly style={{ background: '#f8fafc', color: 'var(--muted)', fontSize: 14 }} />
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

              <AutocompleteField
                label="Client Name"
                required
                inputRef={clientInputRef}
                value={clientName}
                onChange={handleClientSelect}
                onSelect={handleClientSelect}
                suggestions={nameSuggestions}
                placeholder="e.g. Marie Tremblay"
              />

              <AutocompleteField
                label="Client Email"
                type="email"
                value={clientEmail}
                onChange={setClientEmail}
                suggestions={emailSuggestions}
                placeholder="client@email.com"
              />

              <div className="form-group" style={{ maxWidth: 240 }}>
                <label className="form-label">Date of Service <span className="required">*</span></label>
                <input type="date" className="form-control" value={serviceDate} onChange={e => setServiceDate(e.target.value)} required />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                  Client Address <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', fontSize: 12 }}>(optional — selecting a client name above auto-fills these)</span>
                </div>

                <AutocompleteField
                  label="Street Address"
                  value={addressLine1}
                  onChange={setAddressLine1}
                  suggestions={addr1Suggestions}
                  placeholder="123 Main Street"
                />

                <AutocompleteField
                  label="Apt / Suite / Unit"
                  value={addressLine2}
                  onChange={setAddressLine2}
                  suggestions={addr2Suggestions}
                  placeholder="Apt 4B"
                />

                <div className="form-row">
                  <AutocompleteField
                    label="City"
                    value={addressCity}
                    onChange={setAddressCity}
                    suggestions={citySuggestions}
                    placeholder="Montreal"
                  />
                  <AutocompleteField
                    label="Postal Code"
                    value={addressPostal}
                    onChange={v => setAddressPostal(v.toUpperCase())}
                    suggestions={postalSuggestions}
                    placeholder="H3Z 2Y7"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Province</label>
                  <select className="form-control" value={province} onChange={e => setProvince(e.target.value)}>
                    {CANADIAN_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header"><h2>Services</h2></div>
            <div className="card-body">
              <div className="line-items">
                {lineItems.map((item, idx) => (
                  <div key={item._id} className="line-item">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Service</label>
                      <select className="form-control" value={item.service_id} onChange={e => handleServiceSelect(idx, e.target.value)}>
                        <option value="">— Select a service —</option>
                        {SERVICES.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.rate > 0 ? formatCAD(s.rate) + s.unitLabel : 'Free'})</option>
                        ))}
                      </select>
                    </div>

                    {item.service_id === 'custom' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Custom Name</label>
                        <input className="form-control" value={item.service_name} onChange={e => updateLine(idx, 'service_name', e.target.value)} placeholder="e.g. ChatGPT Setup" />
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Description (optional)</label>
                      <input className="form-control" value={item.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Add detail…" />
                    </div>

                    {/* Fix: was className="line-item-fields" which doesn't exist in CSS — correct class is line-item-inputs */}
                    <div className="line-item-inputs">
                      {item.service_id === 'group-workshop' ? (
                        <>
                          <NumInput label="People" value={item.people} min="1" step="1" style={{ width: 80 }}
                            onChange={e => updateLine(idx, 'people', e.target.value === '' ? '' : parseInt(e.target.value))} />
                          <NumInput label="Sessions" value={item.quantity} min="1" step="1" style={{ width: 80 }}
                            onChange={e => updateLine(idx, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))} />
                          <NumInput label="Rate/Person" value={item.rate} min="0" step="0.01" style={{ width: 100 }}
                            onChange={e => updateLine(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                        </>
                      ) : (
                        <>
                          <NumInput label="Qty / Hrs" value={item.quantity} min="0.5" step="0.5" style={{ width: 80 }}
                            onChange={e => updateLine(idx, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                          <NumInput label="Rate (CAD)" value={item.rate} min="0" step="0.01" style={{ width: 100 }}
                            onChange={e => updateLine(idx, 'rate', e.target.value === '' ? '' : parseFloat(e.target.value))} />
                        </>
                      )}
                      <button type="button" className="btn btn-danger btn-icon btn-sm" style={{ alignSelf: 'flex-end' }}
                        onClick={() => removeLine(idx)} disabled={lineItems.length === 1}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>

                    {/* Fix: was className="line-item-amount" which has no CSS rule — use inline style */}
                    {lineTotal(item) > 0 && (
                      <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
                        {item.service_id === 'group-workshop'
                          ? `${item.people || 1} × ${item.quantity || 1} × ${formatCAD(item.rate || 0)} = `
                          : `${item.quantity || 1} × ${formatCAD(item.rate || 0)} = `}
                        <strong style={{ color: 'var(--navy)' }}>{formatCAD(lineTotal(item))}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={addLine}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Service Line
              </button>
            </div>
          </div>

          {/* Discount & Totals */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header"><h2>Discount & Totals</h2></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Discount</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <select className="form-control" style={{ flex: 1 }} value={discountType} onChange={e => setDiscountType(e.target.value)}>
                    <option value="none">No Discount</option>
                    <option value="amount">$ Fixed Amount</option>
                    <option value="percent">% Percentage</option>
                  </select>
                  {discountType !== 'none' && (
                    <NumInput value={discountValue} step="0.01" style={{ width: 100 }}
                      onChange={e => setDiscountValue(e.target.value)} />
                  )}
                </div>
              </div>

              <div className="toggle-row" style={{ marginBottom: 0 }}>
                <label className="toggle">
                  <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span><strong>Include {taxLabel}{province ? ` (${taxRate}%)` : ''}</strong>{!province && ' — Select province first'}</span>
              </div>

              <div className="form-totals">
                <div className="form-totals-row"><span>Subtotal</span><span>{formatCAD(totals.subtotal)}</span></div>
                {totals.discountAmount > 0 && (
                  <div className="form-totals-row discount"><span>Discount</span><span>-{formatCAD(totals.discountAmount)}</span></div>
                )}
                {gstEnabled && (
                  <div className="form-totals-row"><span>{taxLabel} ({taxRate}%)</span><span>{formatCAD(totals.gstAmount)}</span></div>
                )}
                <div className="form-totals-row total"><span>Total Due</span><span>{formatCAD(totals.total)}</span></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><h2>Notes</h2></div>
            <div className="card-body">
              <div className="autocomplete-wrapper">
                <textarea
                  className="form-control"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Referral discount applied. Thanks for your business!"
                />
                <NotesSuggest
                  value={notes}
                  suggestions={notesSuggestions}
                  onSelect={setNotes}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', fontSize: 16, padding: '14px' }} disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </form>
      </div>

      <div className="sticky-totals">
        <div>
          <div className="sticky-totals-label">Total Due (CAD)</div>
          {totals.discountAmount > 0 && (
            <div className="sticky-totals-breakdown">Subtotal {formatCAD(totals.subtotal)} · Discount -{formatCAD(totals.discountAmount)}</div>
          )}
        </div>
        <div className="sticky-totals-amount">{formatCAD(totals.total)}</div>
      </div>
    </div>
  )
}

function NotesSuggest({ value, suggestions, onSelect }) {
  const [show, setShow] = useState(false)
  const [filtered, setFiltered] = useState([])

  useEffect(() => {
    if (value && value.length > 2) {
      const matches = suggestions.filter(s =>
        s && s.toLowerCase().includes(value.toLowerCase()) && s !== value
      )
      setFiltered(matches.slice(0, 5))
      setShow(matches.length > 0)
    } else {
      setShow(false)
    }
  }, [value, suggestions])

  if (!show) return null

  return (
    <div className="autocomplete-list" style={{ top: '100%' }}>
      {filtered.map((item, i) => (
        <div
          key={i}
          className="autocomplete-item"
          onMouseDown={() => { onSelect(item); setShow(false) }}
          style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
