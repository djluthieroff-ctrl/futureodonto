import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { isAdminUser } from '../../lib/authz'

export default function AdminRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="auth-loading">
                <div className="auth-loading-spinner" />
                <p>Carregando...</p>
            </div>
        )
    }

    if (!user) return <Navigate to="/login" replace />
    if (!isAdminUser(user)) return <Navigate to="/painel" replace />

    return children
}
