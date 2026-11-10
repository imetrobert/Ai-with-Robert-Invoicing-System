import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Navbar({ session }) {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img
          src={`${import.meta.env.BASE_URL}logos/master.png`}
          alt="AI with Robert"
          className="navbar-logo"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="navbar-title">
          <span className="navbar-name">AI with Robert</span>
          <span className="navbar-sub">Invoicing</span>
        </div>
      </Link>

      <div className="navbar-actions">
        <Link
          to="/surveys"
          className="nav-link"
        >
          Surveys
        </Link>
        <Link
          to="/tax-summary"
          className="nav-link"
        >
          Tax Summary
        </Link>
        <Link
          to="/"
          className="nav-link"
        >
          Invoices
        </Link>
        {session?.user?.email && (
          <span className="navbar-user" style={{ display: 'none' }}>{session.user.email}</span>
        )}
        <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,.8)', borderColor: 'rgba(255,255,255,.2)' }}>
          Sign Out
        </button>
      </div>
    </nav>
  )
}
