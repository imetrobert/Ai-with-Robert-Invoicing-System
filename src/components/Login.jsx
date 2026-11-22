import { useState } from 'react'
import { supabase } from '../lib/supabase'

// "Request access" link: opens an email to Robert with the app and URL filled in.
const APP_NAME = 'AI with Robert Invoicing'
const APP_URL = 'https://invoices.aiwithrobert.com'
const REQUEST_ACCESS_HREF =
  'mailto:robert@imetrobert.com?subject=' + encodeURIComponent('Access request: ' + APP_NAME) +
  '&body=' + encodeURIComponent('Hi Robert,\n\nI would like an account or access to ' + APP_NAME + ' (' + APP_URL + ').\n\nMy name: \nMy email address: \n\nThank you')

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          src="https://aiwithrobert.com/logo.PNG"
          alt="AI with Robert"
          className="login-logo"
          onError={e => { e.target.style.display = 'none' }}
        />
        <h1 className="login-title">AI with Robert</h1>
        <p className="login-subtitle">Admin Portal — Secure Access</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-navy" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#64748b' }}>
          Need an account or access? Email{' '}
          <a href={REQUEST_ACCESS_HREF}>robert@imetrobert.com</a> and Robert will send you a link to register.
        </p>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#94a3b8' }}>
          🔒 Private access only — aiwithrobert.com
        </p>
      </div>
    </div>
  )
}
