import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/useAuth'
import { isAdminUser } from '../../lib/authz'

export default function Header() {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const isAdmin = isAdminUser(user)
    const [search, setSearch] = useState('')
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const searchRef = useRef(null)
    const [showResults, setShowResults] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [showNotifications, setShowNotifications] = useState(false)

    async function loadNotifications() {
        try {
            const [{ data: retornos }, { data: parcelas }] = await Promise.all([
                supabase.from('retornos').select('*,patients(name)').eq('situacao', 'pendente').lt('data_retorno', new Date().toISOString()),
                supabase.from('financeiro_parcelas').select('*,financeiro_receitas(paciente_id,patients(name))').eq('status', 'atrasado')
            ])

            const list = [
                ...(retornos || []).map(r => ({ id: `ret-${r.id}`, title: 'Alerta de Retorno', text: `Paciente ${r.patients?.name} está com retorno vencido.`, type: 'retorno' })),
                ...(parcelas || []).map(p => ({ id: `par-${p.id}`, title: 'Parcela Atrasada', text: `Parcela de ${p.financeiro_receitas?.patients?.name} está em atraso.`, type: 'financeiro' }))
            ]
            setNotifications(list)
        } catch (err) {
            console.error('Erro ao carregar notificações:', err)
        }
    }

    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                searchRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handler)
        const timer = setTimeout(() => { loadNotifications() }, 0)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('keydown', handler)
        }
    }, [])

    const handleSearch = async (val) => {
        setSearch(val)
        if (val.trim().length < 2) { setResults([]); setShowResults(false); return }
        setSearching(true)
        setShowResults(true)
        try {
            const { data, error } = await supabase
                .from('patients')
                .select('id, name, phone, email')
                .ilike('name', `%${val}%`)
                .limit(8)

            if (error) throw error
            setResults(data || [])
        } catch (err) {
            console.error('Erro na busca do header:', err)
            setResults([])
        } finally {
            setSearching(false)
        }
    }

    const handleSelectPatient = (p) => {
        setSearch('')
        setShowResults(false)
        navigate(`/pacientes/${p.id}`)
    }

    return (
        <header className="header">
            {/* Search de paciente */}
            <div className="header-search" style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass header-search-icon" />
                <input
                    ref={searchRef}
                    type="text"
                    placeholder="Localizar paciente... (ctrl+K)"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                    onFocus={() => search.length >= 2 && setShowResults(true)}
                    id="header-patient-search"
                />
                {showResults && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-md)',
                        marginTop: 6,
                        zIndex: 999,
                        overflow: 'hidden'
                    }}>
                        {searching ? (
                            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                                Buscando...
                            </div>
                        ) : results.length === 0 ? (
                            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                                Nenhum paciente encontrado
                            </div>
                        ) : (
                            results.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelectPatient(p)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-light)',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                >
                                    <div className="avatar avatar-sm">
                                        {p.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.phone || p.email || ''}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="header-actions">
                <div className="header-dropdown-container">
                    <button className="header-novo-btn" id="header-new-shortcut">
                        <i className="fa-solid fa-plus" />
                        Novo
                        <i className="fa-solid fa-chevron-down" style={{ fontSize: 10, marginLeft: 4 }} />
                    </button>
                    <div className="header-dropdown-menu">
                        <div className="header-dropdown-item" onClick={() => window.dispatchEvent(new CustomEvent('open-modal-lead-simples'))}>
                            <i className="fa-solid fa-bullhorn" />
                            Lead (Avaliação)
                        </div>
                        <div className="header-dropdown-item" onClick={() => window.dispatchEvent(new CustomEvent('open-modal-paciente-simples'))}>
                            <i className="fa-solid fa-user-plus" />
                            Paciente
                        </div>
                        <div className="header-dropdown-item" onClick={() => navigate('/agenda?open=new')}>
                            <i className="fa-solid fa-calendar-plus" />
                            Agendamento
                        </div>
                        <div className="header-dropdown-item" onClick={() => navigate('/agenda/lista-espera')}>
                            <i className="fa-solid fa-clock" />
                            Lista de espera
                        </div>
                        <div className="header-dropdown-item" onClick={() => navigate('/financeiro?open=despesa')}>
                            <i className="fa-solid fa-file-invoice-dollar" />
                            Despesa
                        </div>
                    </div>
                </div>

                <div className="header-dropdown-container">
                    <button className="header-btn" title="Notificações" id="header-notifications" onClick={() => setShowNotifications(!showNotifications)}>
                        <i className="fa-regular fa-bell" />
                        {notifications.length > 0 && <span className="badge">{notifications.length}</span>}
                    </button>
                    {showNotifications && (
                        <div className="header-dropdown-menu" style={{ opacity: 1, visibility: 'visible', transform: 'none', width: 300 }}>
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                                Notificações
                                <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 400, fontSize: 11 }} onClick={(e) => { e.stopPropagation(); loadNotifications(); }}>Atualizar</span>
                            </div>
                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Nenhuma notificação nova</div>
                                ) : notifications.map(n => (
                                    <div key={n.id} className="header-dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, height: 'auto', padding: '12px 14px' }}>
                                        <div style={{ fontWeight: 600, fontSize: 12, color: n.type === 'financeiro' ? 'var(--danger)' : 'var(--primary)' }}>{n.title}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: '1.4' }}>{n.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button className="header-btn" title="Ajuda" id="header-help">
                    <i className="fa-regular fa-circle-question" />
                </button>

                {isAdmin && (
                    <button className="header-btn" title="Configurações" id="header-settings" onClick={() => navigate('/personalizar')}>
                        <i className="fa-solid fa-gear" />
                    </button>
                )}

                <div className="header-dropdown-container">
                    <div className="header-avatar" id="header-avatar" title={user?.email || 'Perfil do usuário'}>
                        {user?.user_metadata?.name
                            ? user.user_metadata.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            : user?.email?.substring(0, 2).toUpperCase() || 'US'}
                    </div>
                    <div className="header-dropdown-menu" style={{ minWidth: 200 }}>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.user_metadata?.name || 'Usuário'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{user?.email}</div>
                        </div>
                        {isAdmin && (
                            <div className="header-dropdown-item" onClick={() => navigate('/personalizar')}>
                                <i className="fa-solid fa-gear" />
                                Configurações
                            </div>
                        )}
                        <div className="header-dropdown-item" onClick={async () => { await signOut(); navigate('/login') }} style={{ color: 'var(--danger)' }}>
                            <i className="fa-solid fa-right-from-bracket" />
                            Sair
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}
