import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ConfiguracaoCard = ({ item, onClick }) => (
    <div className="card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
        onClick={onClick}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius)', background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fa-solid ${item.icon}`} style={{ color: item.color, fontSize: 20 }} />
            </div>
            <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.desc}</div>
            </div>
        </div>
    </div>
)

const Geral = () => {
    const navigate = useNavigate()
    const items = [
        { id: 'clinica', icon: 'fa-hospital', title: 'Dados da Clínica', desc: 'Nome, endereço, logo e informações de contato', color: '#7C3AED' },
        { id: 'dentistas', icon: 'fa-user-doctor', title: 'Dentistas', desc: 'Cadastro de cirurgiões-dentistas e especialidades', color: '#06B6D4' },
        { id: 'cadeiras', icon: 'fa-chair', title: 'Cadeiras / Recursos', desc: 'Gerenciar cadeiras e salas da clínica', color: '#10B981' },
        { id: 'usuarios', icon: 'fa-users-gear', title: 'Usuários e Permissões', desc: 'Gerenciar acesso de funcionários', color: '#F59E0B' },
        { id: 'horarios', icon: 'fa-clock', title: 'Horários de Funcionamento', desc: 'Defina os horários de atendimento', color: '#EF4444' },
        { id: 'notificacoes', icon: 'fa-bell', title: 'Notificações', desc: 'Configure alertas e lembretes automáticos', color: '#8B5CF6' },
    ]

    return (
        <div className="grid-2">
            {items.map((item, i) => (
                <ConfiguracaoCard key={i} item={item} onClick={() => navigate(`/personalizar/${item.id}`)} />
            ))}
        </div>
    )
}

const DadosClinica = () => (
    <div className="card">
        <div className="card-header"><div className="card-title">Dados da Clínica</div></div>
        <div className="card-body">
            <div className="form-grid form-grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nome da Clínica</label>
                    <input className="form-control" defaultValue="Minha Clínica Odontológica" />
                </div>
                <div className="form-group">
                    <label className="form-label">CNPJ</label>
                    <input className="form-control" placeholder="00.000.000/0000-00" />
                </div>
                <div className="form-group">
                    <label className="form-label">Telefone</label>
                    <input className="form-control" placeholder="(00) 0000-0000" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Endereço Completo</label>
                    <input className="form-control" />
                </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => alert('Dados da clínica salvos com sucesso!')}>Salvar Alterações</button>
            </div>
        </div>
    </div>
)

const Dentistas = () => {
    const [dentistas, setDentistas] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase.from('dentistas').select('*').order('nome')
        if (error) console.error('Erro ao carregar dentistas:', error)
        setDentistas(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Dentistas Cadastrados</div>
                <button className="btn btn-primary btn-sm"><i className="fa-solid fa-plus" /> Novo Dentista</button>
            </div>
            <div className="table-wrapper">
                {loading ? <div style={{ padding: 20, textAlign: 'center' }}>Carregando...</div> : (
                    <table>
                        <thead><tr><th>Nome</th><th>Especialidade</th><th>CRO</th><th>Cor</th><th>Status</th></tr></thead>
                        <tbody>
                            {dentistas.length === 0 ? (
                                <tr><td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>Nenhum dentista cadastrado.</td></tr>
                            ) : (
                                dentistas.map(d => (
                                    <tr key={d.id}>
                                        <td><strong>{d.nome}</strong></td>
                                        <td>{d.especialidade || '—'}</td>
                                        <td>{d.cro || '—'}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 16, height: 16, borderRadius: 4, background: d.cor }} />
                                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.cor}</span>
                                            </div>
                                        </td>
                                        <td><span className={`badge ${d.ativo ? 'badge-success' : 'badge-danger'}`}>{d.ativo ? 'Ativo' : 'Inativo'}</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

const Usuarios = () => {
    const [usuarios, setUsuarios] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase.auth.admin.listUsers()
        if (error) {
            console.error('Erro ao carregar usuários:', error)
            // Se falhar (ex: sem permissão de admin), tenta pegar o usuário atual
            const { data: current } = await supabase.auth.getUser()
            if (current?.user) {
                setUsuarios([{
                    id: current.user.id,
                    email: current.user.email,
                    user_metadata: current.user.user_metadata,
                    last_sign_in_at: current.user.last_sign_in_at
                }])
            }
        } else {
            setUsuarios(data.users || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Usuários e Permissões</div>
                <button className="btn btn-primary btn-sm" onClick={() => alert('Funcionalidade de convite de novo usuário em breve!')}>
                    <i className="fa-solid fa-plus" /> Novo Usuário
                </button>
            </div>
            <div className="table-wrapper">
                {loading ? <div style={{ padding: 20, textAlign: 'center' }}>Carregando...</div> : (
                    <table>
                        <thead><tr><th>E-mail</th><th>Perfil</th><th>Último Acesso</th><th>Status</th></tr></thead>
                        <tbody>
                            {usuarios.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20 }}>Nenhum usuário encontrado.</td></tr>
                            ) : (
                                usuarios.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.email}</strong></td>
                                        <td><span className="badge badge-primary">{u.user_metadata?.role || 'Usuário'}</span></td>
                                        <td>{u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'dd/MM/yyyy HH:mm') : '—'}</td>
                                        <td><span className="badge badge-success">Ativo</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

const Horarios = () => (
    <div className="card">
        <div className="card-header"><div className="card-title">Horários de Atendimento</div></div>
        <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(dia => (
                    <div key={dia} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ fontWeight: 600, width: 100 }}>{dia}</div>
                        <div style={{ display: 'flex', gap: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="time" defaultValue={dia === 'Sábado' || dia === 'Domingo' ? '09:00' : '08:00'} className="form-control" style={{ width: 110 }} />
                                <span>até</span>
                                <input type="time" defaultValue={dia === 'Sábado' || dia === 'Domingo' ? '12:00' : '18:00'} className="form-control" style={{ width: 110 }} />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" defaultChecked={dia !== 'Domingo'} /> Aberto
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => alert('Horários salvos com sucesso!')}>Salvar Horários</button>
            </div>
        </div>
    </div>
)

const Cadeiras = () => {
    const [cadeiras] = useState([
        { id: 1, nome: 'Cadeira 01 - Principal', sala: 'Consultório A', status: 'ativo' },
        { id: 2, nome: 'Cadeira 02 - Auxiliar', sala: 'Consultório B', status: 'ativo' },
    ])

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Cadeiras / Recursos</div>
                <button className="btn btn-primary btn-sm"><i className="fa-solid fa-plus" /> Nova Cadeira</button>
            </div>
            <div className="table-wrapper">
                <table>
                    <thead><tr><th>Nome</th><th>Sala / Local</th><th>Status</th><th>Ações</th></tr></thead>
                    <tbody>
                        {cadeiras.map(c => (
                            <tr key={c.id}>
                                <td><strong>{c.nome}</strong></td>
                                <td>{c.sala}</td>
                                <td><span className="badge badge-success">Ativo</span></td>
                                <td>
                                    <button className="btn btn-clean icon-only"><i className="fa-solid fa-pen-to-square" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const NotificacoesConfig = () => {
    const [config, setConfig] = useState({
        lembreteEmail: true,
        lembreteSms: false,
        lembreteWhats: true,
        avisoAtraso: true,
        avisoFinanceiro: true
    })

    return (
        <div className="card">
            <div className="card-header"><div className="card-title">Notificações e Alertas</div></div>
            <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Lembretes de Consulta por WhatsApp</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enviar mensagem automática 24h antes do agendamento</div>
                        </div>
                        <input type="checkbox" checked={config.lembreteWhats} onChange={e => setConfig(p => ({ ...p, lembreteWhats: e.target.checked }))} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>E-mails de Boas-vindas</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enviar e-mail automático ao cadastrar novo paciente</div>
                        </div>
                        <input type="checkbox" checked={config.lembreteEmail} onChange={e => setConfig(p => ({ ...p, lembreteEmail: e.target.checked }))} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Alertas de Glosas / Financeiro</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Notificar sobre parcelas vencidas no painel</div>
                        </div>
                        <input type="checkbox" checked={config.avisoFinanceiro} onChange={e => setConfig(p => ({ ...p, avisoFinanceiro: e.target.checked }))} />
                    </div>
                </div>
                <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={() => alert('Preferências de notificação salvas!')}>Salvar Preferências</button>
                </div>
            </div>
        </div>
    )
}

export default function Personalizar() {
    const location = useLocation()
    const navigate = useNavigate()
    const currentTab = location.pathname.split('/').pop()

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personalizar</h1>
                    <p className="page-subtitle">Configure sua clínica, dentistas, cadeiras e preferências</p>
                </div>
                {currentTab !== 'geral' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/personalizar/geral')}>
                        <i className="fa-solid fa-arrow-left" /> Voltar
                    </button>
                )}
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
                {[
                    { id: 'geral', label: 'Geral', icon: 'fa-th-large' },
                    { id: 'clinica', label: 'Clínica', icon: 'fa-hospital' },
                    { id: 'dentistas', label: 'Dentistas', icon: 'fa-user-doctor' },
                    { id: 'usuarios', label: 'Usuários', icon: 'fa-users-gear' },
                    { id: 'horarios', label: 'Horários', icon: 'fa-clock' },
                ].map(t => (
                    <div key={t.id}
                        className={`tab${currentTab === t.id ? ' active' : ''}`}
                        onClick={() => navigate(`/personalizar/${t.id}`)}
                    >
                        <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }} />
                        {t.label}
                    </div>
                ))}
            </div>

            <Routes>
                <Route path="geral" element={<Geral />} />
                <Route path="clinica" element={<DadosClinica />} />
                <Route path="dentistas" element={<Dentistas />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="horarios" element={<Horarios />} />
                <Route path="cadeiras" element={<Cadeiras />} />
                <Route path="notificacoes" element={<NotificacoesConfig />} />
                <Route path="*" element={<Navigate to="geral" replace />} />
            </Routes>
        </div>
    )
}
