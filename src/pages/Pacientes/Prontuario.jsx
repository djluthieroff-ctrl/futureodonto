import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const SIDEBAR_MENU = [
    { key: 'dados', label: 'Dados Pessoais', icon: 'fa-user' },
    { key: 'anamnese', label: 'Anamneses', icon: 'fa-clipboard' },
    { key: 'diagnostico_ia', label: 'Diagnóstico por IA', icon: 'fa-robot' },
    { key: 'prontuario', label: 'Prontuário', icon: 'fa-book-medical' },
    { key: 'conta_corrente', label: 'Conta Corrente', icon: 'fa-receipt' },
    { key: 'documentos', label: 'Documentos', icon: 'fa-file-lines' },
    { key: 'anotacoes', label: 'Anotações', icon: 'fa-comment-dots' },
]

export default function ProntuarioPaciente() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [paciente, setPaciente] = useState(null)
    const [agendamentos, setAgendamentos] = useState([])
    const [anotacoes, setAnotacoes] = useState([])
    const [novaAnotacao, setNovaAnotacao] = useState('')
    const [loading, setLoading] = useState(true)
    const [activeSection, setActiveSection] = useState('prontuario')
    const [editando, setEditando] = useState(false)
    const [form, setForm] = useState({})
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [{ data: p }, { data: ag }, { data: an }] = await Promise.all([
            supabase.from('patients').select('*').eq('id', id).single(),
            supabase.from('agendamentos').select('*,dentistas(nome)').eq('paciente_id', id).order('data_inicio', { ascending: false }).limit(20),
            supabase.from('paciente_anotacoes').select('*').eq('paciente_id', id).order('criado_em', { ascending: false }),
        ])
        setPaciente(p)
        setForm(p || {})
        setAgendamentos(ag || [])
        setAnotacoes(an || [])
        setLoading(false)
    }, [id])

    useEffect(() => {
        if (id && id !== 'novo') {
            const timer = setTimeout(() => { load() }, 0)
            return () => clearTimeout(timer)
        }
    }, [id, load])

    async function handleAddAnotacao() {
        if (!novaAnotacao.trim()) return
        const { error } = await supabase.from('paciente_anotacoes').insert({
            paciente_id: id,
            usuario_nome: 'Administrador',
            conteudo: novaAnotacao,
            tipo: 'clinico'
        })
        if (!error) {
            setNovaAnotacao('')
            load()
        }
    }

    async function handleSave() {
        setSaving(true)
        const { error } = await supabase.from('patients').update(form).eq('id', id)
        if (!error) { await load(); setEditando(false) }
        setSaving(false)
    }

    const calculateAge = (birthDate) => {
        if (!birthDate) return '—'
        const date = new Date(birthDate + 'T00:00:00')
        const years = differenceInYears(new Date(), date)
        return `${years} anos`
    }

    const getInitials = (name) => name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

    if (loading) return <div className="loading"><div className="spinner" /></div>
    if (!paciente) return (
        <div className="card" style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
            <div className="empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-user-slash" /></div>
                <h3>Paciente não encontrado</h3>
                <button className="btn btn-primary" onClick={() => navigate('/pacientes')}>Voltar para lista</button>
            </div>
        </div>
    )

    return (
        <div className="prontuario-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 3.5fr', height: 'calc(100vh - 80px)', margin: '-20px' }}>
            {/* SIDEBAR ESQUERDA */}
            <aside style={{ background: '#fff', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {/* Cabeçalho Profile */}
                <div style={{ padding: '30px 24px', textAlign: 'center', borderBottom: '1px solid var(--border-light)' }}>
                    <div className="avatar avatar-lg" style={{ width: 80, height: 80, fontSize: 28, margin: '0 auto 16px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {getInitials(paciente.name)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{paciente.name}</h3>
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 12, color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Nº {paciente.id.split('-')[0].toUpperCase()} <span className="badge badge-success" style={{ marginLeft: 6, verticalAlign: 'middle', fontSize: 10 }}>Ativo</span></div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                        <button className="btn btn-clean icon-only" title="Alertas"><i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444' }} /></button>
                        <button className="btn btn-clean icon-only" title="Financeiro"><i className="fa-solid fa-dollar-sign" /></button>
                        <a href={`https://wa.me/55${paciente.phone?.replace(/\D/g, '')}`} target="_blank" className="btn btn-clean icon-only" title="WhatsApp"><i className="fa-brands fa-whatsapp" style={{ color: '#22C55E' }} /></a>
                        <button className="btn btn-clean icon-only" title="Editar" onClick={() => setActiveSection('dados')}><i className="fa-solid fa-pen" /></button>
                    </div>
                </div>

                {/* Dados Rápidos */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Dados Pessoais</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Nascimento: <span style={{ fontWeight: 400 }}>{paciente.birth_date ? format(new Date(paciente.birth_date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({calculateAge(paciente.birth_date)})</span></div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>CPF: <span style={{ fontWeight: 400 }}>{paciente.cpf || '—'}</span></div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Contato</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Celular: <span style={{ fontWeight: 400 }}>{paciente.phone || '—'}</span></div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>E-mail: <span style={{ fontWeight: 400, wordBreak: 'break-all' }}>{paciente.email || '—'}</span></div>
                    </div>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Outros</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Clínica: <span style={{ fontWeight: 400 }}>{paciente.city || 'Principal'}</span></div>
                    </div>
                </div>

                {/* Menu Navegação */}
                <nav style={{ padding: '12px 0' }}>
                    {SIDEBAR_MENU.map(m => (
                        <div
                            key={m.key}
                            onClick={() => setActiveSection(m.key)}
                            style={{
                                padding: '12px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                cursor: 'pointer',
                                borderLeft: activeSection === m.key ? '4px solid var(--primary)' : '4px solid transparent',
                                background: activeSection === m.key ? 'var(--primary-light)' : 'transparent',
                                color: activeSection === m.key ? 'var(--primary)' : 'var(--text-primary)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <i className={`fa-solid ${m.icon}`} style={{ width: 18, fontSize: 14, opacity: 0.8 }} />
                            <span style={{ fontSize: 13, fontWeight: activeSection === m.key ? 600 : 500 }}>{m.label}</span>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* CONTEÚDO PRINCIPAL (TELA DA DIREITA) */}
            <main style={{ padding: '30px 40px', overflowY: 'auto', background: 'var(--bg-light)' }}>
                {activeSection === 'prontuario' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
                        {/* Card Agendamentos */}
                        <div className="card" style={{ marginBottom: 0, height: 'fit-content' }}>
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div className="card-title">Agendamentos</div>
                                <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => navigate('/agenda')} />
                            </div>
                            <div style={{ padding: '20px 24px', textAlign: 'center' }}>
                                {agendamentos.length > 0 ? (
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ marginBottom: 12, background: 'var(--bg-light)', padding: 12, borderRadius: 8 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14 }}>Próxima Consulta</div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13, marginTop: 4 }}>{format(new Date(agendamentos[0].data_inicio), "EEEE, dd 'de' MMMM", { locale: ptBR })} às {format(new Date(agendamentos[0].data_inicio), "HH:mm")}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{agendamentos[0].motivo || 'Consulta Geral'} — Dr. {agendamentos[0].dentistas?.nome || 'Ricado'}</div>
                                        </div>
                                        <button className="btn btn-clean w-100" style={{ fontSize: 12 }} onClick={() => setActiveSection('dados')}>Ver todos os agendamentos</button>
                                    </div>
                                ) : (
                                    <div style={{ padding: '40px 0' }}>
                                        <div style={{ fontSize: 40, color: 'var(--border-dark)', marginBottom: 16 }}><i className="fa-solid fa-calendar" /></div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum próximo agendamento para este paciente.</div>
                                        <div style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 4, cursor: 'pointer' }}>Clique aqui para ir para a Agenda</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Card Alertas */}
                        <div className="card" style={{ marginBottom: 0, height: 'fit-content' }}>
                            <div className="card-header">
                                <div className="card-title">Alertas</div>
                            </div>
                            <div className="tabs tabs-sm">
                                <div className="tab active">Alertas de anamnese</div>
                                <div className="tab">Alertas gerais</div>
                                <div className="tab">Alertas de retorno</div>
                            </div>
                            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                                <div style={{ fontSize: 40, color: 'var(--border-dark)', opacity: 0.5, marginBottom: 16 }}><i className="fa-solid fa-triangle-exclamation" /></div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum alerta de anamnese para este paciente.</div>
                                <div style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 4, cursor: 'pointer' }}>Clique aqui para visualizar as anamneses</div>
                            </div>
                        </div>

                        {/* Seção Evolução (Timeline) */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <div className="card">
                                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="card-title">Evolução</div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ padding: '6px 16px', border: '1px solid var(--primary)', borderRadius: 'var(--radius)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <i className="fa-solid fa-robot" /> Assistente de IA
                                        </div>
                                        <button className="btn btn-primary" style={{ background: '#7C3AED' }} onClick={handleAddAnotacao}>Registrar evolução</button>
                                    </div>
                                </div>

                                <div className="card-body">
                                    <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                                        <div className="search-bar" style={{ flex: 1 }}>
                                            <i className="fa-solid fa-magnifying-glass" />
                                            <input placeholder="Filtrar por tratamento ou procedimento..." />
                                        </div>
                                        <select className="form-control" style={{ width: 200 }}>
                                            <option>Ações</option>
                                        </select>
                                    </div>

                                    <div className="timeline-dental-style">
                                        {anotacoes.length > 0 ? (
                                            anotacoes.map((note, i) => (
                                                <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 24, borderBottom: '1px solid var(--border-light)', paddingBottom: 20 }}>
                                                    <div style={{ minWidth: 100, fontSize: 12, color: 'var(--text-muted)' }}>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{format(new Date(note.criado_em), 'dd/MM/yyyy')}</div>
                                                        <div>{format(new Date(note.criado_em), 'HH:mm')}</div>
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                            <div className="badge badge-primary" style={{ fontSize: 10 }}>{note.usuario_nome || 'Administrador'}</div>
                                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Evolução Clínica</span>
                                                        </div>
                                                        <div style={{ fontSize: 14 }}>{note.conteudo}</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                Nenhuma evolução encontrada.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeSection === 'dados' ? (
                    <div className="card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div className="card-title">Dados Pessoais</div>
                            <button className="btn btn-primary btn-sm" onClick={() => setEditando(!editando)}>
                                {editando ? 'Cancelar' : 'Editar Dados'}
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="form-grid form-grid-3">
                                {[
                                    { label: 'Nome completo', field: 'name' },
                                    { label: 'Telefone / WhatsApp', field: 'phone' },
                                    { label: 'E-mail', field: 'email' },
                                    { label: 'CPF', field: 'cpf' },
                                    { label: 'Data de nascimento', field: 'birth_date', type: 'date' },
                                    { label: 'Sexo', field: 'gender', type: 'select', options: [{ v: '', l: 'Selecionar...' }, { v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }, { v: 'O', l: 'Outro' }] },
                                    { label: 'CEP', field: 'cep' },
                                    { label: 'Endereço', field: 'address' },
                                    { label: 'Bairro', field: 'neighborhood' },
                                    { label: 'Cidade', field: 'city' },
                                    { label: 'Status', field: 'status', type: 'select', options: [{ v: 'ativo', l: 'Ativo' }, { v: 'inativo', l: 'Inativo' }] },
                                ].map(f => (
                                    <div className="form-group" key={f.field}>
                                        <label className="form-label">{f.label}</label>
                                        {!editando ? (
                                            <div style={{ fontSize: 14, color: form[f.field] ? 'var(--text-primary)' : 'var(--text-muted)', padding: '8px 0' }}>
                                                {f.field === 'birth_date' && form[f.field]
                                                    ? format(new Date(form[f.field] + 'T00:00:00'), 'dd/MM/yyyy')
                                                    : form[f.field] || '—'}
                                            </div>
                                        ) : f.type === 'select' ? (
                                            <select className="form-control" value={form[f.field] || ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}>
                                                {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                                            </select>
                                        ) : (
                                            <input type={f.type || 'text'} className="form-control" value={form[f.field] || ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} />
                                        )}
                                    </div>
                                ))}
                            </div>
                            {editando && (
                                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="card">
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className={`fa-solid ${SIDEBAR_MENU.find(m => m.key === activeSection)?.icon}`} /></div>
                            <h3>{SIDEBAR_MENU.find(m => m.key === activeSection)?.label}</h3>
                            <p>Esta seção está sendo reformulada para o novo padrão Dental Office.</p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
