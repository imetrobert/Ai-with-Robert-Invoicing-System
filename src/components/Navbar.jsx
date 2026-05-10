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
          src="https://aiwithrobert.com/logo.PNG"
          alt="AI with Robert"
          className="navbar-logo"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="navbar-title">
          AI with Robert
          <span>Invoicing</span>
        </div>
      </Link>

      <div className="navbar-actions">
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
