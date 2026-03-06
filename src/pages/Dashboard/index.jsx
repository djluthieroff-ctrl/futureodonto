import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, subMonths, startOfMonth, subDays, addDays, startOfWeek, endOfWeek, addMonths, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function FunnelChart({ etapas, onSelectEtapa }) {
    if (!etapas || etapas.length === 0) return null

    const maxWidth = 100
    const minWidth = 40
    const step = (maxWidth - minWidth) / Math.max(etapas.length - 1, 1)

    return (
        <div style={{ padding: '8px 0' }}>
            {etapas.map((etapa, i) => {
                const width = maxWidth - i * step
                const pct = etapas[0].count === 0 ? 0 : Math.round((etapa.count / etapas[0].count) * 100)
                return (
                    <div key={i} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                            style={{
                                width: `${width}%`,
                                background: etapa.color,
                                borderRadius: 6,
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'filter 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                            onMouseLeave={e => (e.currentTarget.style.filter = '')}
                            onClick={() => onSelectEtapa?.(etapa)}
                        >
                            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{etapa.label}</span>
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                                {etapa.count} ({pct}%)
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function MetricCard({ icon, iconBg, value, label, desc, period, onClick }) {
    return (
        <div className="metric-card" onClick={onClick}>
            <div className="metric-card-header">
                <div className="metric-card-icon" style={{ background: iconBg }}>
                    <i className={`fa-solid ${icon}`} style={{ color: 'white' }} />
                </div>
                <i className="fa-solid fa-up-right-and-down-left-from-center metric-card-expand" />
            </div>
            <div className="metric-card-value">{value}</div>
            <div className="metric-card-label">{label}</div>
            <div className="metric-card-desc">{desc}</div>
            {period && (
                <div className="metric-card-period">
                    <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
                    {period}
                </div>
            )}
        </div>
    )
}

function ParcelasAtraso({ parcelas }) {
    return (
        <div className="card">
            <div className="card-header">
                <div>
                    <div className="card-title">Pacientes com parcelas em atraso</div>
                    <div className="card-subtitle">Valores em aberto no financeiro</div>
                </div>
                <Link className="btn btn-sm btn-outline" to="/financeiro">Ver todos</Link>
            </div>
            {parcelas.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                    <i className="fa-solid fa-check-circle empty-state-icon" style={{ color: 'var(--success)' }} />
                    <h3>Nenhuma parcela em atraso</h3>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Valor</th>
                                <th>Vencimento</th>
                                <th>Situacao</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parcelas.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <strong>{p.patient_name}</strong>
                                    </td>
                                    <td>R$ {Number(p.valor).toFixed(2)}</td>
                                    <td>{format(new Date(p.data_vencimento), 'dd/MM/yyyy')}</td>
                                    <td>
                                        <span className="badge badge-danger">Atrasado</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const [metrics, setMetrics] = useState({
        aniversariantes: 0,
        agendamentosSemana: 0,
        faltaramDesmarcaram: 0,
        naoConfirmados: 0,
        orcamentosNaoAprovados: 0,
        pacientesAusentes: 0,
        ticketsAbertos: 0,
        tratamentosAbertos: 0,
    })
    const [funil, setFunil] = useState([])
    const [funilDetalheModal, setFunilDetalheModal] = useState({ open: false, etapa: null, leads: [], loading: false })
    const [parcelas, setParcelas] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentDate, setCurrentDate] = useState(new Date())

    const periodo = React.useMemo(() => ({
        inicio: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
        fim: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
    }), [currentDate])


    const loadDashboard = useCallback(async () => {
        setLoading(true)
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            const mm = format(currentDate, 'MM')
            const prox72h = format(addDays(new Date(), 3), 'yyyy-MM-dd')
            const ha6meses = format(subMonths(new Date(), 6), 'yyyy-MM-dd')
            const ha30d = format(subDays(new Date(), 30), 'yyyy-MM-dd')
            const inicioSemana = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
            const fimSemana = format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')

            const inicioMes = periodo.inicio
            const fimMes = periodo.fim

            // Usamos Promise.allSettled para evitar que um erro em uma tabela trave o dashboard inteiro
            const results = await Promise.allSettled([
                supabase.from('leads').select('*').gte('created_at', inicioMes).lte('created_at', `${fimMes}T23:59:59`),
                supabase
                    .from('agendamentos')
                    .select('id', { count: 'exact', head: true })
                    .gte('data_inicio', `${inicioSemana}T00:00:00`)
                    .lte('data_inicio', `${fimSemana}T23:59:59`)
                    .eq('situacao', 'atendido'),
                supabase
                    .from('agendamentos')
                    .select('id,situacao', { count: 'exact' })
                    .eq('situacao', 'agendado')
                    .gte('data_inicio', today)
                    .lte('data_inicio', `${prox72h}T23:59:59`),
                supabase.from('agendamentos').select('id', { count: 'exact' }).in('situacao', ['faltou', 'desmarcou']).gte('data_inicio', ha30d),
                supabase.from('agendamentos').select('id', { count: 'exact' }).eq('situacao', 'agendado').lte('data_inicio', `${today}T23:59:59`),
                supabase.from('tratamentos').select('id', { count: 'exact' }).eq('status', 'orcamento'),
                supabase.from('patients').select('id', { count: 'exact' }).lte('last_contact', `${ha6meses}T00:00:00`),
                supabase.from('financeiro_parcelas').select('id,valor,data_vencimento,receita_id').eq('status', 'pendente').lte('data_vencimento', today).limit(20),
            ])

            const [leadsRes, agSemanaRes, , faltaramRes, naoConfRes, orcNaoAprovRes, ausentesRes, parcAtrasadasRes] = results.map(r => r.status === 'fulfilled' ? r.value : { data: [], count: 0, error: r.reason })

            const { data: aniversPs } = await supabase.from('patients').select('id,birth_date').not('birth_date', 'is', null)
            const aniversariantes = (aniversPs || []).filter((p) => p.birth_date?.split('-')[1] === mm).length

            let parcelasData = []
            if (parcAtrasadasRes.data?.length > 0) {
                const receitaIds = [...new Set(parcAtrasadasRes.data.map((p) => p.receita_id))]
                const { data: receitas } = await supabase
                    .from('financeiro_receitas')
                    .select('id,paciente_id,patients(name)')
                    .in('id', receitaIds)

                const receitaMap = {}
                receitas?.forEach((r) => {
                    receitaMap[r.id] = r.patients?.name || '-'
                })

                parcelasData = parcAtrasadasRes.data.map((p) => ({
                    ...p,
                    patient_name: receitaMap[p.receita_id] || '-',
                }))
            }

            const etapas = ['lead', 'consulta_agendada', 'faltou_desmarcaram', 'atendido', 'orcamento_criado', 'orcamento_aprovado', 'orcamento_perdido']
            const etapasLabels = ['Leads', 'Consulta agendada', 'Faltaram ou desmarcaram', 'Atendidos', 'Orcamento criado', 'Orcamento aprovado', 'Orcamento perdido']
            const etapasCores = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#8B5CF6', '#06B6D4', '#EF4444']

            const leadsData = leadsRes.data || []

            const contagem = {}
            etapas.forEach((e) => {
                contagem[e] = 0
            })
            leadsData?.forEach((l) => {
                const etapaLead = l.etapa || l.status || 'lead'
                if (contagem[etapaLead] !== undefined) contagem[etapaLead] += 1
            })

            setFunil(etapas.map((e, i) => ({ key: e, label: etapasLabels[i], count: contagem[e], color: etapasCores[i] })))
            setParcelas(parcelasData)
            setMetrics({
                aniversariantes,
                agendamentosSemana: agSemanaRes.count || 0,
                faltaramDesmarcaram: faltaramRes.count || 0,
                naoConfirmados: naoConfRes.count || 0,
                orcamentosNaoAprovados: orcNaoAprovRes.count || 0,
                pacientesAusentes: ausentesRes.count || 0,
                ticketsAbertos: 0,
                tratamentosAbertos: 0,
            })
        } catch (e) {
            console.error('Erro ao carregar dashboard:', e)
        }
        setLoading(false)
    }, [currentDate, periodo])

    const handleOpenEtapaDetalhe = useCallback(async (etapa) => {
        if (!etapa?.key) return

        setFunilDetalheModal({ open: true, etapa, leads: [], loading: true })
        try {
            let leadsData = []

            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .or(`etapa.eq.${etapa.key},status.eq.${etapa.key}`)
                .gte('created_at', periodo.inicio)
                .lte('created_at', `${periodo.fim}T23:59:59`)
                .order('created_at', { ascending: false })

            if (error) throw error
            leadsData = data || []

            const leads = leadsData
            const pacienteIds = [...new Set(leads.map((l) => l.paciente_id).filter(Boolean))]
            let pacienteMap = {}

            if (pacienteIds.length > 0) {
                const { data: patientsData } = await supabase
                    .from('patients')
                    .select('id,name')
                    .in('id', pacienteIds)
                patientsData?.forEach((p) => {
                    pacienteMap[p.id] = p.name
                })
            }

            setFunilDetalheModal({
                open: true,
                etapa,
                loading: false,
                leads: leads.map((lead) => ({
                    ...lead,
                    convertido_em_paciente: Boolean(lead.convertido_em_paciente || lead.paciente_id),
                    patient_name: pacienteMap[lead.paciente_id] || null,
                })),
            })
        } catch (error) {
            console.error('Erro ao carregar detalhe da etapa do funil:', error)
            setFunilDetalheModal({ open: true, etapa, leads: [], loading: false })
        }
    }, [periodo])

    useEffect(() => {
        loadDashboard()
    }, [loadDashboard])

    const metricCards = [
        {
            icon: 'fa-cake-candles',
            iconBg: '#F59E0B',
            value: metrics.aniversariantes,
            label: 'Aniversariantes do mes',
            desc: 'Pacientes fazendo aniversario',
            period: 'Este mes',
            onClick: () => navigate('/crm/kpis/aniversariantes'),
        },
        {
            icon: 'fa-share-nodes',
            iconBg: '#8B5CF6',
            value: metrics.agendamentosSemana,
            label: 'Agendamentos realizados',
            desc: 'Consultas atendidas na semana',
            period: 'Esta semana',
        },
        {
            icon: 'fa-person-running',
            iconBg: '#EF4444',
            value: metrics.faltaramDesmarcaram,
            label: 'Faltaram ou desmarcaram',
            desc: 'Pacientes nao reagendados',
            period: 'Ultimos 30 dias',
            onClick: () => navigate('/crm/kpis/faltaram_desmarcaram'),
        },
        {
            icon: 'fa-calendar-xmark',
            iconBg: '#F97316',
            value: metrics.naoConfirmados,
            label: 'Agendamentos nao confirmados',
            desc: 'Seu custo hora. Reduza as faltas.',
            period: 'Proximas 72 horas',
            onClick: () => navigate('/crm/kpis/nao_confirmados'),
        },
        {
            icon: 'fa-file-invoice-dollar',
            iconBg: '#06B6D4',
            value: metrics.orcamentosNaoAprovados,
            label: 'Orcamentos nao aprovados',
            desc: 'Em orcamentos nao aprovados',
            period: 'Ultimos 30 dias',
        },
        {
            icon: 'fa-user-clock',
            iconBg: '#6366F1',
            value: metrics.pacientesAusentes,
            label: 'Pacientes ausentes ha 6 meses',
            desc: 'Receita gerada por esses pacientes',
            period: 'Ultimos 2 anos',
            onClick: () => navigate('/crm/kpis/nao_agendaram'),
        },
        {
            icon: 'fa-ticket',
            iconBg: '#EC4899',
            value: metrics.ticketsAbertos,
            label: 'Pacientes com maiores tickets',
            desc: 'Receita gerada por estes pacientes',
            period: 'Ultimos 12 meses',
        },
        {
            icon: 'fa-tooth',
            iconBg: '#10B981',
            value: metrics.tratamentosAbertos,
            label: 'Tratamentos abertos sem agendamento',
            desc: 'Receita gerada nestes tratamentos',
            period: 'Ultimos 30 dias',
        },
    ]

    return (
        <div>
            <div
                style={{
                    background: 'linear-gradient(135deg, var(--primary-ultra-light), #E0E7FF)',
                    border: '1px solid #C7D2FE',
                    borderRadius: 'var(--radius)',
                    padding: '10px 16px',
                    fontSize: 13,
                    color: 'var(--primary-dark)',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>
                        <i className="fa-solid fa-circle-info" style={{ marginRight: 8 }} />
                        Dados do CRM atualizados em tempo real com o Supabase
                    </span>
                    <div className="month-selector" style={{ display: 'flex', alignItems: 'center', gap: 15, background: 'white', padding: '4px 12px', borderRadius: 20, border: '1px solid #C7D2FE' }}>
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                            <i className="fa-solid fa-chevron-left" />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', minWidth: 100, textAlign: 'center' }}>
                            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                        </span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                            <i className="fa-solid fa-chevron-right" />
                        </button>
                    </div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={loadDashboard}>
                    <i className="fa-solid fa-rotate" />
                    Atualizar
                </button>
            </div>

            {loading ? (
                <div className="loading">
                    <div className="spinner" />
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">
                                        <i className="fa-solid fa-filter" style={{ marginRight: 8, color: 'var(--primary)' }} />
                                        Funil de vendas: Leads ate aprovacao de orcamento
                                    </div>
                                    <div className="card-subtitle">
                                        Periodo: {format(new Date(periodo.inicio), 'dd/MM/yyyy')} - {format(new Date(periodo.fim), 'dd/MM/yyyy')}
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-secondary">
                                    <i className="fa-solid fa-up-right-and-down-left-from-center" />
                                </button>
                            </div>
                            <div style={{ marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Oportunidade</span>
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px' }}>R$ 0,00</div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Valor medio por orcamento aprovado</span>
                            </div>
                            <FunnelChart etapas={funil} onSelectEtapa={handleOpenEtapaDetalhe} />
                        </div>

                        <div className="grid-2">
                            {metricCards.slice(0, 4).map((m, i) => (
                                <MetricCard key={i} {...m} />
                            ))}
                        </div>
                    </div>

                    <div className="grid-4" style={{ marginBottom: 20 }}>
                        {metricCards.slice(4).map((m, i) => (
                            <MetricCard key={i} {...m} />
                        ))}
                    </div>

                    <ParcelasAtraso parcelas={parcelas} />

                    <div className="card" style={{ marginTop: 20 }}>
                        <div className="card-header">
                            <div>
                                <div className="card-title">Atalhos rápidos</div>
                                <div className="card-subtitle">Acesso direto para as principais funções</div>
                            </div>
                        </div>
                        <div className="grid-4">
                            <Link to="/agenda" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                                <i className="fa-solid fa-calendar-days" /> Agenda
                            </Link>
                            <Link to="/agenda/agendamento-online" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                                <i className="fa-solid fa-link" /> Link de agendamento
                            </Link>
                            <Link to="/pacientes" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                                <i className="fa-solid fa-users" /> Pacientes
                            </Link>
                            <Link to="/relatorios" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                                <i className="fa-solid fa-chart-column" /> Relatórios
                            </Link>
                        </div>
                    </div>
                </>
            )}

            {funilDetalheModal.open && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setFunilDetalheModal((prev) => ({ ...prev, open: false }))}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title">
                                {funilDetalheModal.etapa?.label || 'Etapa do funil'}
                            </div>
                            <button className="modal-close" onClick={() => setFunilDetalheModal((prev) => ({ ...prev, open: false }))}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>

                        <div className="modal-body">
                            {funilDetalheModal.loading ? (
                                <div className="loading"><div className="spinner" /></div>
                            ) : funilDetalheModal.leads.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Nenhum paciente/lead nesta etapa.
                                </div>
                            ) : (
                                <div className="table-wrapper">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Nome</th>
                                                <th>Telefone</th>
                                                <th>E-mail</th>
                                                <th>Paciente</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {funilDetalheModal.leads.map((lead) => (
                                                <tr key={lead.id}>
                                                    <td><strong>{lead.patient_name || lead.name}</strong></td>
                                                    <td>{lead.phone || '-'}</td>
                                                    <td>{lead.email || '-'}</td>
                                                    <td>
                                                        {lead.convertido_em_paciente ? (
                                                            <span className="badge badge-success">Convertido</span>
                                                        ) : (
                                                            <span className="badge badge-outline">Lead</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
