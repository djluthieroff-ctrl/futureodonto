import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'

export default function Login() {
    const navigate = useNavigate()
    const { signIn, signUp, resetPassword } = useAuth()
    const [mode, setMode] = useState('login') // 'login', 'register', 'forgot'
    const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '', clinicName: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            if (mode === 'login') {
                await signIn(form.email, form.password)
                navigate('/painel')
            } else if (mode === 'register') {
                if (form.password !== form.confirmPassword) {
                    setError('As senhas não coincidem.')
                    setLoading(false)
                    return
                }
                if (form.password.length < 6) {
                    setError('A senha deve ter pelo menos 6 caracteres.')
                    setLoading(false)
                    return
                }
                await signUp(form.email, form.password, {
                    name: form.name,
                    clinic_name: form.clinicName
                })
                setSuccess('Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.')
                setMode('login')
            } else if (mode === 'forgot') {
                await resetPassword(form.email)
                setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
            }
        } catch (err) {
            console.error('Auth error:', err)
            if (err.message?.includes('Invalid login credentials')) {
                setError('E-mail ou senha incorretos.')
            } else if (err.message?.includes('User already registered')) {
                setError('Este e-mail já está cadastrado.')
            } else if (err.message?.includes('Email not confirmed')) {
                setError('E-mail não confirmado. Verifique sua caixa de entrada.')
            } else {
                setError(err.message || 'Ocorreu um erro. Tente novamente.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* Lado esquerdo - Branding */}
                <div className="auth-brand">
                    <div className="auth-brand-content">
                        <div className="auth-logo">
                            <i className="fa-solid fa-tooth" />
                        </div>
                        <h1>OdontoCRM</h1>
                        <p>Sistema completo de gestão para clínicas odontológicas</p>
                        <div className="auth-features">
                            <div className="auth-feature">
                                <i className="fa-solid fa-calendar-check" />
                                <span>Agenda inteligente</span>
                            </div>
                            <div className="auth-feature">
                                <i className="fa-solid fa-users" />
                                <span>Gestão de pacientes</span>
                            </div>
                            <div className="auth-feature">
                                <i className="fa-solid fa-chart-line" />
                                <span>Relatórios financeiros</span>
                            </div>
                            <div className="auth-feature">
                                <i className="fa-solid fa-bullhorn" />
                                <span>Marketing e CRM</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lado direito - Formulário */}
                <div className="auth-form-side">
                    <div className="auth-form-container">
                        <h2>
                            {mode === 'login' && 'Entrar no sistema'}
                            {mode === 'register' && 'Criar nova conta'}
                            {mode === 'forgot' && 'Recuperar senha'}
                        </h2>
                        <p className="auth-subtitle">
                            {mode === 'login' && 'Acesse sua clínica odontológica'}
                            {mode === 'register' && 'Preencha os dados para começar'}
                            {mode === 'forgot' && 'Informe seu e-mail para recuperar o acesso'}
                        </p>

                        {error && (
                            <div className="auth-alert auth-alert-error">
                                <i className="fa-solid fa-circle-exclamation" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="auth-alert auth-alert-success">
                                <i className="fa-solid fa-circle-check" />
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {mode === 'register' && (
                                <>
                                    <div className="auth-field">
                                        <label>Seu nome</label>
                                        <div className="auth-input-wrapper">
                                            <i className="fa-solid fa-user" />
                                            <input
                                                type="text"
                                                placeholder="Nome completo"
                                                value={form.name}
                                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="auth-field">
                                        <label>Nome da clínica</label>
                                        <div className="auth-input-wrapper">
                                            <i className="fa-solid fa-hospital" />
                                            <input
                                                type="text"
                                                placeholder="Nome da sua clínica"
                                                value={form.clinicName}
                                                onChange={e => setForm(p => ({ ...p, clinicName: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="auth-field">
                                <label>E-mail</label>
                                <div className="auth-input-wrapper">
                                    <i className="fa-solid fa-envelope" />
                                    <input
                                        type="email"
                                        placeholder="seu@email.com"
                                        value={form.email}
                                        onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {mode !== 'forgot' && (
                                <div className="auth-field">
                                    <label>Senha</label>
                                    <div className="auth-input-wrapper">
                                        <i className="fa-solid fa-lock" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={form.password}
                                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'register' && (
                                <div className="auth-field">
                                    <label>Confirmar senha</label>
                                    <div className="auth-input-wrapper">
                                        <i className="fa-solid fa-lock" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={form.confirmPassword}
                                            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'login' && (
                                <div className="auth-forgot-link">
                                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}>
                                        Esqueceu a senha?
                                    </button>
                                </div>
                            )}

                            <button type="submit" className="auth-submit-btn" disabled={loading}>
                                {loading ? (
                                    <><i className="fa-solid fa-spinner fa-spin" /> Aguarde...</>
                                ) : (
                                    <>
                                        {mode === 'login' && <><i className="fa-solid fa-right-to-bracket" /> Entrar</>}
                                        {mode === 'register' && <><i className="fa-solid fa-user-plus" /> Criar conta</>}
                                        {mode === 'forgot' && <><i className="fa-solid fa-paper-plane" /> Enviar e-mail</>}
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="auth-switch">
                            {mode === 'login' ? (
                                <p>Não tem uma conta? <button onClick={() => { setMode('register'); setError(''); setSuccess('') }}>Criar conta</button></p>
                            ) : (
                                <p>Já tem uma conta? <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Fazer login</button></p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
