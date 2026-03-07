import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, differenceInYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '../../components/ui/Toast'
import { registrarAuditoria } from '../../lib/auditoria'
import ModalAgendamento from '../Agenda/ModalAgendamento'

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
    const [anamneses, setAnamneses] = useState([])
    const [receitas, setReceitas] = useState([])
    const [tratamentos, setTratamentos] = useState([])
    const [modalAnamnese, setModalAnamnese] = useState(false)
    const [perguntasAnamnese, setPerguntasAnamnese] = useState([
        { id: 1, pergunta: 'Possui alguma alergia?', resposta: '', obs: '' },
        { id: 2, pergunta: 'Está sob tratamento médico?', resposta: '', obs: '' },
        { id: 3, pergunta: 'Toma algum medicamento?', resposta: '', obs: '' },
        { id: 4, pergunta: 'Problemas de cicatrização?', resposta: '', obs: '' },
        { id: 5, pergunta: 'Hipertensão ou Diabetes?', resposta: '', obs: '' },
    ])
    const [modalAgendamentoDirect, setModalAgendamentoDirect] = useState(false)
    const [dentistasLista, setDentistasLista] = useState([])
    const [cadeirasLista, setCadeirasLista] = useState([])

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
            const { data: anam, error: anamError } = await supabase
                .from('paciente_anamneses')
                .select('*')
                .eq('paciente_id', id)
                .order('criado_em', { ascending: false })

            if (anamError) {
                console.warn('Erro ao carregar anamneses:', anamError)
            } else {
                setAnamneses(anam || [])
            }

            const { data: rec, error: recError } = await supabase
                .from('financeiro_receitas')
                .select('*')
                .eq('paciente_id', id)
                .order('created_at', { ascending: false })

            if (recError) {
                console.warn('Erro ao carregar receitas:', recError)
            } else {
                setReceitas(rec || [])
            }

            const { data: trat, error: tratError } = await supabase
                .from('tratamentos')
                .select('*, dentistas(nome)')
                .eq('paciente_id', id)
                .order('created_at', { ascending: false })

            if (tratError) {
                console.warn('Erro ao carregar tratamentos:', tratError)
            } else {
                setTratamentos(trat || [])
            }

            const [{ data: d }, { data: c }] = await Promise.all([
                supabase.from('dentistas').select('id,nome').eq('ativo', true).order('nome'),
                supabase.from('cadeiras').select('id,nome').eq('ativa', true).order('nome')
            ])
            setDentistasLista(d || [])
            setCadeirasLista(c || [])

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

    async function handleSaveAnamnese() {
        const temResposta = perguntasAnamnese.some((q) => q.resposta)
        if (!temResposta) {
            toast.warning('Preencha ao menos uma resposta da anamnese')
            return
        }

        setSaving(true)
        try {
            const questionario = perguntasAnamnese.map((q) => ({
                pergunta: q.pergunta,
                resposta: q.resposta || '',
                obs: q.obs || ''
            }))

            const { error } = await supabase.from('paciente_anamneses').insert({
                paciente_id: id,
                questionario
            })

            if (error) throw error

            toast.success('Anamnese salva com sucesso')
            setModalAnamnese(false)
            setPerguntasAnamnese([
                { id: 1, pergunta: 'Possui alguma alergia?', resposta: '', obs: '' },
                { id: 2, pergunta: 'EstÃ¡ sob tratamento mÃ©dico?', resposta: '', obs: '' },
                { id: 3, pergunta: 'Toma algum medicamento?', resposta: '', obs: '' },
                { id: 4, pergunta: 'Problemas de cicatrizaÃ§Ã£o?', resposta: '', obs: '' },
                { id: 5, pergunta: 'HipertensÃ£o ou Diabetes?', resposta: '', obs: '' },
            ])
            await registrarAuditoria({
                modulo: 'Prontuario',
                acao: 'Anamnese registrada',
                detalhes: `Paciente: ${paciente?.name || id}`
            })
            await load()
        } catch (error) {
            console.error('Erro ao salvar anamnese:', error)
            toast.error('Erro ao salvar anamnese')
        } finally {
            setSaving(false)
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

    const handleAtivarPaciente = async () => {
        if (!confirm('Deseja marcar este tratamento como fechado e ativar o paciente?')) return
        setSaving(true)
        try {
            const { error } = await supabase.from('patients').update({ is_active_patient: true }).eq('id', id)
            if (error) throw error
            setPaciente(prev => ({ ...prev, is_active_patient: true }))
            toast.success('Paciente ativado e tratamento marcado como fechado!')
            await registrarAuditoria({
                modulo: 'Pacientes',
                acao: 'Paciente ativado',
                detalhes: `Paciente: ${paciente?.name || id}`,
            })
        } catch (error) {
            console.error('Erro ao ativar paciente:', error)
            toast.error('Erro ao ativar paciente')
        } finally {
            setSaving(false)
        }
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
                            <span className={`badge badge-${paciente.is_active_patient ? 'success' : 'warning'}`} style={{ marginLeft: 6, verticalAlign: 'middle', fontSize: 10 }}>
                                {paciente.is_active_patient ? 'Ativo' : 'Em Avaliação'}
                            </span>
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
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-primary btn-sm w-100" onClick={() => setModalAgendamentoDirect(true)}>Agendar Novo</button>
                                                <button className="btn btn-secondary btn-sm w-100" onClick={() => navigate('/agenda')}>Ver todos</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '40px 0' }}>
                                            <div style={{ fontSize: 40, color: 'var(--border-dark)', marginBottom: 16 }}><i className="fa-solid fa-calendar" /></div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum proximo agendamento para este paciente.</div>
                                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModalAgendamentoDirect(true)}>
                                                Agendar Consulta Agora
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
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Tipos de Tratamento</label>
                                        {!editando ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {form.is_clinico && <span className="badge badge-outline">Clínico</span>}
                                                {form.is_ortodontia && <span className="badge" style={{ background: '#7C3AED', color: '#fff' }}>Ortodontia</span>}
                                                {form.is_protese && <span className="badge" style={{ background: '#F59E0B', color: '#fff' }}>Prótese</span>}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: 20, paddingTop: 8 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={form.is_clinico} onChange={e => setForm(p => ({ ...p, is_clinico: e.target.checked }))} />
                                                    <span style={{ fontSize: 13 }}>Clínico</span>
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={form.is_ortodontia} onChange={e => setForm(p => ({ ...p, is_ortodontia: e.target.checked }))} />
                                                    <span style={{ fontSize: 13 }}>Ortodontia</span>
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={form.is_protese} onChange={e => setForm(p => ({ ...p, is_protese: e.target.checked }))} />
                                                    <span style={{ fontSize: 13 }}>Prótese</span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
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
                    ) : activeSection === 'anamnese' ? (
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="card-title">Histórico de Anamneses</div>
                                <button className="btn btn-primary btn-sm" onClick={() => setModalAnamnese(true)}>Nova Anamnese</button>
                            </div>
                            <div className="card-body">
                                {anamneses.length === 0 ? (
                                    <div className="empty-state">
                                        <i className="fa-solid fa-clipboard-list empty-state-icon" />
                                        <h3>Nenhuma anamnese registrada</h3>
                                        <p>Clique em Nova Anamnese para preencher o formulário inicial.</p>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Data</th>
                                                    <th>Resumo</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {anamneses.map(a => (
                                                    <tr key={a.id}>
                                                        <td>{format(new Date(a.criado_em), 'dd/MM/yyyy HH:mm')}</td>
                                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {a.questionario?.slice(0, 2).map(q => `${q.pergunta}: ${q.resposta}`).join(', ')}...
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-clean icon-only" title="Visualizar Detalhes"><i className="fa-solid fa-eye" /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeSection === 'conta_corrente' ? (
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="card-title">Extrato Financeiro</div>
                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                    Saldo Devedor: R$ {receitas.reduce((acc, curr) => acc + (Number(curr.valor_total) - Number(curr.valor_pago || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="card-body">
                                {receitas.length === 0 ? (
                                    <div className="empty-state">
                                        <i className="fa-solid fa-file-invoice-dollar empty-state-icon" />
                                        <h3>Nenhum registro financeiro</h3>
                                        <p>Orcamentos e pagamentos aparecerão aqui.</p>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Data</th>
                                                    <th>Descricao</th>
                                                    <th>Valor Total</th>
                                                    <th>Valor Pago</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {receitas.map(r => (
                                                    <tr key={r.id}>
                                                        <td>{format(new Date(r.created_at), 'dd/MM/yyyy')}</td>
                                                        <td>{r.descricao}</td>
                                                        <td>R$ {Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        <td style={{ color: 'var(--success)' }}>R$ {Number(r.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        <td>
                                                            <span className={`badge badge-${r.status === 'pago' ? 'success' : 'warning'}`}>
                                                                {r.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeSection === 'tratamentos' ? (
                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="card-title">Planos de Tratamento e Orcamentos</div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    {!paciente.is_active_patient && (
                                        <button className="btn btn-success btn-sm" onClick={handleAtivarPaciente} disabled={saving}>
                                            <i className="fa-solid fa-check-double" /> Fechar Tratamento (Ativar)
                                        </button>
                                    )}
                                    <button className="btn btn-primary btn-sm" onClick={() => toast.info('Funcionalidade de Novo Orcamento em breve')}>Novo Orcamento</button>
                                </div>
                            </div>
                            <div className="card-body">
                                {tratamentos.length === 0 ? (
                                    <div className="empty-state">
                                        <i className="fa-solid fa-file-medical empty-state-icon" />
                                        <h3>Nenhum orcamento encontrado</h3>
                                        <p>Crie planos de tratamento para este paciente.</p>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Data</th>
                                                    <th>Descricao</th>
                                                    <th>Dentista</th>
                                                    <th>Valor</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tratamentos.map(t => (
                                                    <tr key={t.id}>
                                                        <td>{format(new Date(t.created_at), 'dd/MM/yyyy')}</td>
                                                        <td>{t.descricao}</td>
                                                        <td>{t.dentistas?.nome || '-'}</td>
                                                        <td style={{ fontWeight: 600 }}>R$ {Number(t.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        <td>
                                                            <span className={`badge badge-${t.status === 'aprovado' ? 'success' : t.status === 'finalizado' ? 'primary' : 'warning'}`}>
                                                                {(t.status || 'ORCAMENTO').toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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

            {modalAnamnese && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalAnamnese(false)}>
                    <div className="modal modal-lg">
                        <div className="modal-header">
                            <div className="modal-title">Nova Anamnese</div>
                            <button className="modal-close" onClick={() => setModalAnamnese(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="anamnese-form">
                                {perguntasAnamnese.map((q, idx) => (
                                    <div key={q.id} style={{ marginBottom: 20, padding: 16, background: 'var(--bg-light)', borderRadius: 12 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 12 }}>{idx + 1}. {q.pergunta}</div>
                                        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input type="radio" name={`q-${q.id}`} value="Sim" checked={q.resposta === 'Sim'} onChange={e => {
                                                    const newQ = [...perguntasAnamnese];
                                                    newQ[idx].resposta = e.target.value;
                                                    setPerguntasAnamnese(newQ);
                                                }} /> Sim
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                                <input type="radio" name={`q-${q.id}`} value="Não" checked={q.resposta === 'Não'} onChange={e => {
                                                    const newQ = [...perguntasAnamnese];
                                                    newQ[idx].resposta = e.target.value;
                                                    setPerguntasAnamnese(newQ);
                                                }} /> Não
                                            </label>
                                        </div>
                                        <textarea
                                            className="form-control"
                                            placeholder="Observações ou detalhes..."
                                            value={q.obs}
                                            onChange={e => {
                                                const newQ = [...perguntasAnamnese];
                                                newQ[idx].obs = e.target.value;
                                                setPerguntasAnamnese(newQ);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalAnamnese(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSaveAnamnese} disabled={saving}>Salvar Anamnese</button>
                        </div>
                    </div>
                </div>
            )}

            {modalAgendamentoDirect && (
                <ModalAgendamento
                    dataInicial={new Date()}
                    eventoExistente={null}
                    dentistas={dentistasLista}
                    cadeiras={cadeirasLista}
                    onClose={() => {
                        setModalAgendamentoDirect(false)
                        load()
                    }}
                />
            )}
        </>
    )
}
