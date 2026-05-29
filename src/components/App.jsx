import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import InvoiceForm from './components/InvoiceForm'
import InvoiceView from './components/InvoiceView'
import InvoicePublic from './components/InvoicePublic'
import SurveyDashboard from './components/SurveyDashboard'
import SurveyUpload from './components/SurveyUpload'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/"                element={session ? <Dashboard />      : <Navigate to="/login" replace />} />
        <Route path="/invoice/new"     element={session ? <InvoiceForm />    : <Navigate to="/login" replace />} />
        <Route path="/invoice/:id"     element={session ? <InvoiceView />    : <Navigate to="/login" replace />} />
        <Route path="/invoice/:id/edit" element={session ? <InvoiceForm />   : <Navigate to="/login" replace />} />
        <Route path="/invoice/public/:token" element={<InvoicePublic />} />
        <Route path="/surveys"         element={session ? <SurveyDashboard /> : <Navigate to="/login" replace />} />
        <Route path="/surveys/upload"  element={session ? <SurveyUpload />   : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
