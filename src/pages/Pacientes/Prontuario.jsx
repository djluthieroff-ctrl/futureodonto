import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../../components/ui/Toast'
import { registrarAuditoria } from '../../lib/auditoria'

const SIDEBAR_MENU = [
    { key: 'dados', label: 'Dados Pessoais', icon: 'fa-user' },
    { key: 'anamnese', label: 'Anamneses', icon: 'fa-clipboard' },
    { key: 'diagnostico_ia', label: 'Diagnostico por IA', icon: 'fa-robot' },
    { key: 'prontuario', label: 'Prontuario', icon: 'fa-book-medical' },
    { key: 'conta_corrente', label: 'Conta Corrente', icon: 'fa-receipt' },
    { key: 'documentos', label: 'Documentos', icon: 'fa-file-lines' },
    { key: 'anotacoes', label: 'Anotacoes', icon: 'fa-comment-dots' },
]

const ALERT_TABS = [
    { key: 'anamnese', label: 'Alertas de anamnese' },
    { key: 'gerais', label: 'Alertas gerais' },
    { key: 'retorno', label: 'Alertas de retorno' },
]

export default function ProntuarioPaciente() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const toastRef = useRef(toast)

    const [paciente, setPaciente] = useState(null)
    const [agendamentos, setAgendamentos] = useState([])
    const [anotacoes, setAnotacoes] = useState([])
    const [novaAnotacao, setNovaAnotacao] = useState('')
    const [loading, setLoading] = useState(true)
    const [activeSection, setActiveSection] = useState('prontuario')
    const [editando, setEditando] = useState(false)
    const [form, setForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [savingAnotacao, setSavingAnotacao] = useState(false)
    const [modalEvolucao, setModalEvolucao] = useState(false)
    const [alertTab, setAlertTab] = useState('anamnese')
    const [filtroEvolucao, setFiltroEvolucao] = useState('')
    const [quickAction, setQuickAction] = useState('')

    useEffect(() => {
        toastRef.current = toast
    }, [toast])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [{ data: p, error: pError }, { data: ag, error: agError }] = await Promise.all([
                supabase.from('patients').select('*').eq('id', id).single(),
                supabase.from('agendamentos').select('*,dentistas(nome)').eq('paciente_id', id).order('data_inicio', { ascending: false }).limit(20),
            ])

            if (pError) throw pError
            if (agError) throw agError

            setPaciente(p)
            setForm(p || {})
            setAgendamentos(ag || [])

            // Notas sao opcionais: se a tabela nao existir no ambiente, o prontuario continua abrindo.
            const { data: an, error: anError } = await supabase
                .from('paciente_anotacoes')
                .select('*')
                .eq('paciente_id', id)
                .order('criado_em', { ascending: false })

            if (anError) {
                console.warn('Aviso ao carregar anotacoes do prontuario:', anError)
                setAnotacoes([])
            } else {
                setAnotacoes(an || [])
            }
        } catch (error) {
            console.error('Erro ao carregar prontuario:', error)
            toastRef.current.error('Erro ao carregar dados do prontuario')
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        if (id && id !== 'novo') {
            const timer = setTimeout(() => { load() }, 0)
            return () => clearTimeout(timer)
        }
    }, [id, load])

    async function handleAddAnotacao() {
        if (!novaAnotacao.trim()) {
            toast.warning('Digite a evolucao antes de registrar')
            return
        }

        setSavingAnotacao(true)
        try {
            const { error } = await supabase.from('paciente_anotacoes').insert({
                paciente_id: id,
                usuario_nome: 'Administrador',
                conteudo: novaAnotacao.trim(),
                tipo: 'clinico'
            })

            if (error) throw error

            setNovaAnotacao('')
            setModalEvolucao(false)
            toast.success('Evolucao registrada com sucesso')
            await registrarAuditoria({
                modulo: 'Prontuario',
                acao: 'Evolucao registrada',
                detalhes: `Paciente: ${paciente?.name || id}`,
            })
            await load()
        } catch (error) {
            console.error('Erro ao registrar evolucao:', error)
            toast.error('Erro ao registrar evolucao')
        } finally {
            setSavingAnotacao(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        try {
            const payload = { ...form }
            delete payload.id
            delete payload.created_at
            const { error } = await supabase.from('patients').update(payload).eq('id', id)
            if (error) throw error
            await load()
            setEditando(false)
            toast.success('Dados do paciente atualizados')
            await registrarAuditoria({
                modulo: 'Pacientes',
                acao: 'Paciente atualizado',
                detalhes: `Paciente: ${form?.name || id}`,
            })
        } catch (error) {
            console.error('Erro ao salvar paciente:', error)
            toast.error('Erro ao salvar dados do paciente')
        } finally {
            setSaving(false)
        }
    }

    const calculateAge = (birthDate) => {
        if (!birthDate) return '-'
        const date = new Date(`${birthDate}T00:00:00`)
        const years = differenceInYears(new Date(), date)
        return `${years} anos`
    }

    const getInitials = (name) => name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?'
    const hasPhone = Boolean((paciente?.phone || '').replace(/\D/g, ''))
    const whatsappHref = hasPhone ? `https://wa.me/55${paciente.phone.replace(/\D/g, '')}` : null

    const proximosAgendamentos = useMemo(
        () => agendamentos.filter((ag) => new Date(ag.data_inicio).getTime() >= Date.now()),
        [agendamentos]
    )

    const anotacoesFiltradas = useMemo(() => {
        const termo = filtroEvolucao.trim().toLowerCase()
        if (!termo) return anotacoes
        return anotacoes.filter((note) => {
            const texto = [note.conteudo, note.usuario_nome, note.tipo].filter(Boolean).join(' ').toLowerCase()
            return texto.includes(termo)
        })
    }, [anotacoes, filtroEvolucao])

    const handleQuickAction = (value) => {
        if (!value) return

        if (value === 'nova_evolucao') {
            setModalEvolucao(true)
        } else if (value === 'editar_dados') {
            setActiveSection('dados')
            setEditando(true)
        } else if (value === 'ver_agenda') {
            navigate('/agenda')
        } else if (value === 'ir_anamnese') {
            setActiveSection('anamnese')
        }

        setQuickAction('')
    }

    const renderAlertContent = () => {
        if (alertTab === 'anamnese') {
            return {
                message: 'Nenhum alerta de anamnese para este paciente.',
                actionText: 'Clique aqui para visualizar as anamneses',
                onClick: () => setActiveSection('anamnese')
            }
        }

        if (alertTab === 'retorno') {
            return {
                message: 'Nenhum alerta de retorno ativo.',
                actionText: 'Clique aqui para abrir alertas de retorno',
                onClick: () => navigate('/agenda/alerta-retorno')
            }
        }

        return {
            message: 'Nenhum alerta geral para este paciente.',
            actionText: 'Clique aqui para ir para os dados do paciente',
            onClick: () => setActiveSection('dados')
        }
    }

    if (loading) return <div className="loading"><div className="spinner" /></div>

    if (!paciente) return (
        <div className="card" style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
            <div className="empty-state">
                <div className="empty-state-icon"><i className="fa-solid fa-user-slash" /></div>
                <h3>Paciente nao encontrado</h3>
                <button className="btn btn-primary" onClick={() => navigate('/pacientes')}>Voltar para lista</button>
            </div>
        </div>
    )

    const alerta = renderAlertContent()

    return (
        <>
            <div className="prontuario-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 3.5fr', height: 'calc(100vh - 80px)', margin: '-20px' }}>
                <aside style={{ background: '#fff', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    <div style={{ padding: '30px 24px', textAlign: 'center', borderBottom: '1px solid var(--border-light)' }}>
                        <div className="avatar avatar-lg" style={{ width: 80, height: 80, fontSize: 28, margin: '0 auto 16px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                            {getInitials(paciente.name)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{paciente.name}</h3>
                            <button className="btn btn-clean icon-only" title="Voltar para lista" onClick={() => navigate('/pacientes')}>
                                <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 12, color: 'var(--text-muted)' }} />
                            </button>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                            N {paciente.id.split('-')[0].toUpperCase()}
                            <span className="badge badge-success" style={{ marginLeft: 6, verticalAlign: 'middle', fontSize: 10 }}>Ativo</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                            <button className="btn btn-clean icon-only" title="Alertas" onClick={() => { setActiveSection('prontuario'); setAlertTab('anamnese') }}>
                                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444' }} />
                            </button>
                            <button className="btn btn-clean icon-only" title="Financeiro" onClick={() => navigate('/financeiro')}>
                                <i className="fa-solid fa-dollar-sign" />
                            </button>
                            {whatsappHref ? (
                                <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn btn-clean icon-only" title="WhatsApp">
                                    <i className="fa-brands fa-whatsapp" style={{ color: '#22C55E' }} />
                                </a>
                            ) : (
                                <button className="btn btn-clean icon-only" title="Sem telefone" disabled>
                                    <i className="fa-brands fa-whatsapp" style={{ color: '#94A3B8' }} />
                                </button>
                            )}
                            <button className="btn btn-clean icon-only" title="Editar" onClick={() => { setActiveSection('dados'); setEditando(true) }}>
                                <i className="fa-solid fa-pen" />
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Dados Pessoais</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                Nascimento: <span style={{ fontWeight: 400 }}>{paciente.birth_date ? format(new Date(`${paciente.birth_date}T00:00:00`), 'dd/MM/yyyy') : '-'}</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({calculateAge(paciente.birth_date)})</span>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>CPF: <span style={{ fontWeight: 400 }}>{paciente.cpf || '-'}</span></div>
                        </div>
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Contato</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Celular: <span style={{ fontWeight: 400 }}>{paciente.phone || '-'}</span></div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>E-mail: <span style={{ fontWeight: 400, wordBreak: 'break-all' }}>{paciente.email || '-'}</span></div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Outros</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Clinica: <span style={{ fontWeight: 400 }}>{paciente.city || 'Principal'}</span></div>
                        </div>
                    </div>

                    <nav style={{ padding: '12px 0' }}>
                        {SIDEBAR_MENU.map((m) => (
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

                <main style={{ padding: '30px 40px', overflowY: 'auto', background: 'var(--bg-light)' }}>
                    {activeSection === 'prontuario' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
                            <div className="card" style={{ marginBottom: 0, height: 'fit-content' }}>
                                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div className="card-title">Agendamentos</div>
                                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => navigate('/agenda')} />
                                </div>
                                <div style={{ padding: '20px 24px', textAlign: 'center' }}>
                                    {proximosAgendamentos.length > 0 ? (
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ marginBottom: 12, background: 'var(--bg-light)', padding: 12, borderRadius: 8 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>Proxima Consulta</div>
                                                <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                                                    {format(new Date(proximosAgendamentos[0].data_inicio), "EEEE, dd 'de' MMMM", { locale: ptBR })} as {format(new Date(proximosAgendamentos[0].data_inicio), 'HH:mm')}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    {proximosAgendamentos[0].motivo || 'Consulta Geral'} - Dr. {proximosAgendamentos[0].dentistas?.nome || 'Nao informado'}
                                                </div>
                                            </div>
                                            <button className="btn btn-clean w-100" style={{ fontSize: 12 }} onClick={() => navigate('/agenda')}>Ver todos os agendamentos</button>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '40px 0' }}>
                                            <div style={{ fontSize: 40, color: 'var(--border-dark)', marginBottom: 16 }}><i className="fa-solid fa-calendar" /></div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum proximo agendamento para este paciente.</div>
                                            <button className="btn btn-link" style={{ marginTop: 8 }} onClick={() => navigate('/agenda')}>
                                                Clique aqui para ir para a Agenda
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card" style={{ marginBottom: 0, height: 'fit-content' }}>
                                <div className="card-header">
                                    <div className="card-title">Alertas</div>
                                </div>
                                <div className="tabs tabs-sm">
                                    {ALERT_TABS.map((tab) => (
                                        <div key={tab.key} className={`tab${alertTab === tab.key ? ' active' : ''}`} onClick={() => setAlertTab(tab.key)}>
                                            {tab.label}
                                        </div>
                                    ))}
                                </div>
                                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 40, color: 'var(--border-dark)', opacity: 0.5, marginBottom: 16 }}><i className="fa-solid fa-triangle-exclamation" /></div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{alerta.message}</div>
                                    <button className="btn btn-link" style={{ marginTop: 8 }} onClick={alerta.onClick}>{alerta.actionText}</button>
                                </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <div className="card">
                                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="card-title">Evolucao</div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button
                                                className="btn btn-outline"
                                                onClick={() => {
                                                    setActiveSection('diagnostico_ia')
                                                    toast.info('Abra o Diagnostico por IA no menu lateral')
                                                }}
                                            >
                                                <i className="fa-solid fa-robot" /> Assistente de IA
                                            </button>
                                            <button className="btn btn-primary" style={{ background: '#7C3AED' }} onClick={() => setModalEvolucao(true)}>
                                                Registrar evolucao
                                            </button>
                                        </div>
                                    </div>

                                    <div className="card-body">
                                        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                                            <div className="search-bar" style={{ flex: 1 }}>
                                                <i className="fa-solid fa-magnifying-glass" />
                                                <input
                                                    placeholder="Filtrar por tratamento, usuario ou texto..."
                                                    value={filtroEvolucao}
                                                    onChange={(e) => setFiltroEvolucao(e.target.value)}
                                                />
                                            </div>
                                            <select
                                                className="form-control"
                                                style={{ width: 220 }}
                                                value={quickAction}
                                                onChange={(e) => { setQuickAction(e.target.value); handleQuickAction(e.target.value) }}
                                            >
                                                <option value="">Acoes</option>
                                                <option value="nova_evolucao">Registrar evolucao</option>
                                                <option value="editar_dados">Editar dados do paciente</option>
                                                <option value="ver_agenda">Abrir agenda</option>
                                                <option value="ir_anamnese">Ver anamneses</option>
                                            </select>
                                        </div>

                                        <div className="timeline-dental-style">
                                            {anotacoesFiltradas.length > 0 ? (
                                                anotacoesFiltradas.map((note, i) => (
                                                    <div key={note.id || i} style={{ display: 'flex', gap: 20, marginBottom: 24, borderBottom: '1px solid var(--border-light)', paddingBottom: 20 }}>
                                                        <div style={{ minWidth: 100, fontSize: 12, color: 'var(--text-muted)' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{format(new Date(note.criado_em), 'dd/MM/yyyy')}</div>
                                                            <div>{format(new Date(note.criado_em), 'HH:mm')}</div>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                                <div className="badge badge-primary" style={{ fontSize: 10 }}>{note.usuario_nome || 'Administrador'}</div>
                                                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Evolucao Clinica</span>
                                                            </div>
                                                            <div style={{ fontSize: 14 }}>{note.conteudo}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                    {filtroEvolucao ? 'Nenhuma evolucao encontrada para este filtro.' : 'Nenhuma evolucao encontrada.'}
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
                                        { label: 'Endereco', field: 'address' },
                                        { label: 'Bairro', field: 'neighborhood' },
                                        { label: 'Cidade', field: 'city' },
                                        { label: 'Status', field: 'status', type: 'select', options: [{ v: 'ativo', l: 'Ativo' }, { v: 'inativo', l: 'Inativo' }] },
                                    ].map((f) => (
                                        <div className="form-group" key={f.field}>
                                            <label className="form-label">{f.label}</label>
                                            {!editando ? (
                                                <div style={{ fontSize: 14, color: form[f.field] ? 'var(--text-primary)' : 'var(--text-muted)', padding: '8px 0' }}>
                                                    {f.field === 'birth_date' && form[f.field]
                                                        ? format(new Date(`${form[f.field]}T00:00:00`), 'dd/MM/yyyy')
                                                        : form[f.field] || '-'}
                                                </div>
                                            ) : f.type === 'select' ? (
                                                <select className="form-control" value={form[f.field] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.field]: e.target.value }))}>
                                                    {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                                                </select>
                                            ) : (
                                                <input type={f.type || 'text'} className="form-control" value={form[f.field] || ''} onChange={(e) => setForm((p) => ({ ...p, [f.field]: e.target.value }))} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {editando && (
                                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                            {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="empty-state">
                                <div className="empty-state-icon"><i className={`fa-solid ${SIDEBAR_MENU.find((m) => m.key === activeSection)?.icon}`} /></div>
                                <h3>{SIDEBAR_MENU.find((m) => m.key === activeSection)?.label}</h3>
                                <p>Esta secao esta sendo reformulada para o novo padrao Dental Office.</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {modalEvolucao && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalEvolucao(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title">Registrar evolucao</div>
                            <button className="modal-close" onClick={() => setModalEvolucao(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Descricao da evolucao</label>
                                <textarea
                                    className="form-control"
                                    rows={6}
                                    placeholder="Descreva a evolucao clinica do paciente..."
                                    value={novaAnotacao}
                                    onChange={(e) => setNovaAnotacao(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalEvolucao(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleAddAnotacao} disabled={savingAnotacao}>
                                {savingAnotacao ? 'Salvando...' : 'Salvar evolucao'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
