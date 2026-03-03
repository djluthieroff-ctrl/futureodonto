import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ResetPassword() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            return
        }
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        setLoading(true)
        const { error: updateError } = await supabase.auth.updateUser({ password })
        setLoading(false)

        if (updateError) {
            setError(updateError.message || 'Erro ao redefinir senha.')
            return
        }

        setSuccess('Senha redefinida com sucesso. Faça login novamente.')
        setTimeout(() => navigate('/login', { replace: true }), 1200)
    }

    return (
        <div className="auth-page">
            <div className="auth-container" style={{ gridTemplateColumns: '1fr' }}>
                <div className="auth-form-side">
                    <div className="auth-form-container">
                        <h2>Redefinir senha</h2>
                        <p className="auth-subtitle">Digite a nova senha para sua conta.</p>

                        {error && <div className="auth-alert auth-alert-error">{error}</div>}
                        {success && <div className="auth-alert auth-alert-success">{success}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="auth-field">
                                <label>Nova senha</label>
                                <div className="auth-input-wrapper">
                                    <i className="fa-solid fa-lock" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="auth-field">
                                <label>Confirmar nova senha</label>
                                <div className="auth-input-wrapper">
                                    <i className="fa-solid fa-lock" />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading ? 'Atualizando...' : 'Salvar nova senha'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
