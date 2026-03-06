import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'
import { ToastProvider } from './components/ui/Toast'
import './styles/auth.css'

// Lazy loading components
const Login = lazy(() => import('./pages/Auth/Login'))
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'))
const Layout = lazy(() => import('./components/layout/Layout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Painel = lazy(() => import('./pages/Painel'))
const Leads = lazy(() => import('./pages/CRM/Leads'))
const Agenda = lazy(() => import('./pages/Agenda'))
const Pacientes = lazy(() => import('./pages/Pacientes'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const Marketing = lazy(() => import('./pages/Marketing'))
const Ferramentas = lazy(() => import('./pages/Ferramentas'))
const Personalizar = lazy(() => import('./pages/Personalizar'))
const Prontuario = lazy(() => import('./pages/Pacientes/Prontuario'))
const AlertaRetorno = lazy(() => import('./pages/Agenda/AlertaRetorno'))
const ListaEspera = lazy(() => import('./pages/Agenda/ListaEspera'))
const AgendamentoOnline = lazy(() => import('./pages/Agenda/AgendamentoOnline'))
const PacientesKPITela = lazy(() => import('./pages/Dashboard/PacientesKPITela'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const IndicacaoPremiada = lazy(() => import('./pages/IndicacaoPremiada'))

const LoadingFallback = () => (
  <div className="auth-loading">
    <div className="auth-loading-spinner" />
    <p>Carregando página...</p>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/painel" replace />} />

                <Route path="crm" element={<Navigate to="/crm/dashboard" replace />} />
                <Route path="crm/dashboard" element={<Dashboard />} />
                <Route path="crm/leads" element={<Leads />} />
                <Route path="crm/kpis/:tipo" element={<PacientesKPITela />} />

                <Route path="painel" element={<Painel />} />

                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda/vertical" element={<Agenda defaultView="vertical" />} />
                <Route path="agenda/alerta-retorno" element={<AlertaRetorno />} />
                <Route path="agenda/lista-espera" element={<ListaEspera />} />
                <Route path="agenda/agendamento-online" element={<AgendamentoOnline />} />

                <Route path="pacientes" element={<Pacientes />} />
                <Route path="pacientes/:id" element={<Prontuario />} />

                <Route path="financeiro" element={<Navigate to="/financeiro/receitas" replace />} />
                <Route path="financeiro/*" element={<Financeiro />} />

                <Route path="marketing" element={<Navigate to="/marketing/funil" replace />} />
                <Route path="marketing/*" element={<Marketing />} />

                <Route path="ferramentas" element={<Navigate to="/ferramentas/estoque" replace />} />
                <Route path="ferramentas/*" element={<Ferramentas />} />

                <Route path="relatorios" element={<Navigate to="/relatorios/financeiro" replace />} />
                <Route path="relatorios/*" element={<Relatorios />} />

                <Route path="personalizar" element={<AdminRoute><Navigate to="/personalizar/geral" replace /></AdminRoute>} />
                <Route path="personalizar/*" element={<AdminRoute><Personalizar /></AdminRoute>} />
                <Route path="indicacao" element={<IndicacaoPremiada />} />
                <Route path="*" element={<Navigate to="/painel" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
