import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'
import Login from './pages/Auth/Login'
import ResetPassword from './pages/Auth/ResetPassword'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Painel from './pages/Painel'
import Leads from './pages/CRM/Leads'
import Agenda from './pages/Agenda'
import Pacientes from './pages/Pacientes'
import Financeiro from './pages/Financeiro'
import Marketing from './pages/Marketing'
import Ferramentas from './pages/Ferramentas'
import Personalizar from './pages/Personalizar'
import Prontuario from './pages/Pacientes/Prontuario'
import AlertaRetorno from './pages/Agenda/AlertaRetorno'
import ListaEspera from './pages/Agenda/ListaEspera'
import AgendamentoOnline from './pages/Agenda/AgendamentoOnline'
import PacientesKPITela from './pages/Dashboard/PacientesKPITela'
import Relatorios from './pages/Relatorios'
import IndicacaoPremiada from './pages/IndicacaoPremiada'
import { ToastProvider } from './components/ui/Toast'
import './styles/auth.css'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
