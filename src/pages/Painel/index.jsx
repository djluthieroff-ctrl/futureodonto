import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
    format,
    addDays,
    eachDayOfInterval,
    startOfMonth,
    endOfMonth,
    startOfDay,
    endOfDay
} from 'date-fns'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'

export default function Painel() {
    const [pacientesTotal, setPacientesTotal] = useState(0)
    const [novosPacientesMes, setNovosPacientesMes] = useState(0)
    const [generoResumo, setGeneroResumo] = useState({ feminino: 0, masculino: 0 })
    const [proximosPacientes, setProximosPacientes] = useState([])
    const [financeiroResumo, setFinanceiroResumo] = useState({ receitas: 0, despesas: 0 })
    const [financeiroHoje, setFinanceiroHoje] = useState({ receber: 0, pagar: 0 })
    const [consultasResumo, setConsultasResumo] = useState({ realizadasMes: 0, agendadasMes: 0, taxaFaltas: 0 })
    const [procedimentosData, setProcedimentosData] = useState([])
    const [previsaoData, setPrevisaoData] = useState([])
    const [ocupacao, setOcupacao] = useState(0)
    const [loading, setLoading] = useState(true)
    const refreshTimerRef = useRef(null)

    const loadPainel = useCallback(async () => {
        setLoading(true)
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            const next3Days = format(addDays(new Date(), 3), 'yyyy-MM-dd')
            const weekEnd = format(addDays(new Date(), 6), 'yyyy-MM-dd')
            const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
            const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
            const startTodayIso = startOfDay(new Date()).toISOString()
            const endTodayIso = endOfDay(new Date()).toISOString()

            const [
                pacientesTotalRes,
                novosPacientesRes,
                pacientesGeneroRes,
                agendamentosProximosRes,
                agendamentosMesRes,
                receitasMesRes,
                despesasMesRes,
                cadeirasAtivasRes,
                agendamentosHojeRes
            ] = await Promise.all([
                supabase.from('patients').select('id', { count: 'exact', head: true }),
                supabase.from('patients').select('id', { count: 'exact', head: true }).gte('created_at', `${monthStart}T00:00:00`).lte('created_at', `${monthEnd}T23:59:59`),
                supabase.from('patients').select('gender'),
                supabase
                    .from('agendamentos')
                    .select('id, data_inicio, situacao, patients(name)')
                    .gte('data_inicio', `${today}T00:00:00`)
                    .lte('data_inicio', `${next3Days}T23:59:59`)
                    .order('data_inicio', { ascending: true })
                    .limit(10),
                supabase
                    .from('agendamentos')
                    .select('situacao,motivo,data_inicio')
                    .gte('data_inicio', `${monthStart}T00:00:00`)
                    .lte('data_inicio', `${monthEnd}T23:59:59`),
                supabase
                    .from('financeiro_receitas')
                    .select('valor_total,data_vencimento,status')
                    .gte('data_vencimento', monthStart)
                    .lte('data_vencimento', monthEnd),
                supabase
                    .from('financeiro_despesas')
                    .select('valor_total,data_vencimento,status')
                    .gte('data_vencimento', monthStart)
                    .lte('data_vencimento', monthEnd),
                supabase.from('cadeiras').select('id', { count: 'exact', head: true }).eq('ativa', true),
                supabase
                    .from('agendamentos')
                    .select('id', { count: 'exact', head: true })
                    .gte('data_inicio', startTodayIso)
                    .lte('data_inicio', endTodayIso)
                    .in('situacao', ['agendado', 'confirmado', 'atendido']),
            ])

            if (pacientesTotalRes.error) throw pacientesTotalRes.error
            if (novosPacientesRes.error) throw novosPacientesRes.error
            if (pacientesGeneroRes.error) throw pacientesGeneroRes.error
            if (agendamentosProximosRes.error) throw agendamentosProximosRes.error
            if (agendamentosMesRes.error) throw agendamentosMesRes.error
            if (receitasMesRes.error) throw receitasMesRes.error
            if (despesasMesRes.error) throw despesasMesRes.error
            if (cadeirasAtivasRes.error) throw cadeirasAtivasRes.error
            if (agendamentosHojeRes.error) throw agendamentosHojeRes.error

            const pacientesGenero = pacientesGeneroRes.data || []
            const feminino = pacientesGenero.filter((p) => (p.gender || '').toLowerCase().startsWith('f')).length
            const masculino = pacientesGenero.filter((p) => (p.gender || '').toLowerCase().startsWith('m')).length

            setPacientesTotal(pacientesTotalRes.count || 0)
            setNovosPacientesMes(novosPacientesRes.count || 0)
            setGeneroResumo({ feminino, masculino })
            setProximosPacientes(agendamentosProximosRes.data || [])

            const receitasMes = receitasMesRes.data || []
            const despesasMes = despesasMesRes.data || []
            const agendamentosMes = agendamentosMesRes.data || []

            const totalRec = receitasMes.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
            const totalDesp = despesasMes.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
            setFinanceiroResumo({ receitas: totalRec, despesas: totalDesp })

            const receberHoje = receitasMes
                .filter((r) => r.data_vencimento === today && ['pendente', 'atrasado'].includes(r.status))
                .reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)

            const pagarHoje = despesasMes
                .filter((d) => d.data_vencimento === today && ['pendente', 'atrasado'].includes(d.status))
                .reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)

            setFinanceiroHoje({ receber: receberHoje, pagar: pagarHoje })

            const realizadasMes = agendamentosMes.filter((a) => a.situacao === 'atendido').length
            const agendadasMes = agendamentosMes.filter((a) => ['agendado', 'confirmado'].includes(a.situacao)).length
            const faltasMes = agendamentosMes.filter((a) => ['faltou', 'desmarcou'].includes(a.situacao)).length
            const baseTaxa = realizadasMes + faltasMes
            const taxaFaltas = baseTaxa === 0 ? 0 : Math.round((faltasMes / baseTaxa) * 100)

            setConsultasResumo({ realizadasMes, agendadasMes, taxaFaltas })

            const mapaProcedimentos = {}
            agendamentosMes
                .filter((a) => a.motivo)
                .forEach((a) => {
                    mapaProcedimentos[a.motivo] = (mapaProcedimentos[a.motivo] || 0) + 1
                })

            const procedimentos = Object.entries(mapaProcedimentos)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5)
            setProcedimentosData(procedimentos)

            const diasSemana = eachDayOfInterval({
                start: new Date(`${today}T00:00:00`),
                end: new Date(`${weekEnd}T00:00:00`),
            })

            const serieSemana = diasSemana.map((dia) => {
                const dStr = format(dia, 'yyyy-MM-dd')
                const receitasDia = receitasMes
                    .filter((r) => r.data_vencimento === dStr)
                    .reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)
                const despesasDia = despesasMes
                    .filter((d) => d.data_vencimento === dStr)
                    .reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0)

                return {
                    name: format(dia, 'dd/MM'),
                    receitas: receitasDia,
                    despesas: despesasDia,
                }
            })
            setPrevisaoData(serieSemana)

            const cadeirasAtivas = cadeirasAtivasRes.count || 0
            const consultasHoje = agendamentosHojeRes.count || 0
            const capacidadeDia = Math.max(cadeirasAtivas * 8, 1)
            const ocupacaoPct = Math.min(100, Math.round((consultasHoje / capacidadeDia) * 100))
            setOcupacao(cadeirasAtivas > 0 ? ocupacaoPct : 0)
        } catch (e) {
            console.error('Erro ao carregar painel:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPainel()
    }, [loadPainel])

    useEffect(() => {
        const channel = supabase
            .channel('painel-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => scheduleRefresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => scheduleRefresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_receitas' }, () => scheduleRefresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_despesas' }, () => scheduleRefresh())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'cadeiras' }, () => scheduleRefresh())
            .subscribe()

        function scheduleRefresh() {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
            refreshTimerRef.current = setTimeout(() => {
                loadPainel()
            }, 500)
        }

        return () => {
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
            supabase.removeChannel(channel)
        }
    }, [loadPainel])

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

    if (loading) return <div className="loading"><div className="spinner" /></div>

    return (
        <div className="painel-dental-office" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, padding: 20 }}>
            {/* Coluna Principal */}
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Secao Pacientes e Consultas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">PACIENTES</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 'bold' }}>{pacientesTotal}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total de pacientes</div>
                            </div>
                            <div style={{ width: 100, height: 60 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[{ v: Math.max(pacientesTotal - 4, 0) }, { v: Math.max(pacientesTotal - 3, 0) }, { v: Math.max(pacientesTotal - 2, 0) }, { v: Math.max(pacientesTotal - 1, 0) }, { v: pacientesTotal }]}>
                                        <Bar dataKey="v" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Novos este mes</span>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>+{novosPacientesMes}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Distribuicao por genero</span>
                                <span>{generoResumo.feminino}F / {generoResumo.masculino}M</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">CONSULTAS</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 'bold' }}>{consultasResumo.realizadasMes}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Realizadas no mes</div>
                            </div>
                            <div style={{ width: 100, height: 60 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={previsaoData.map((p) => ({ v: p.receitas - p.despesas }))}>
                                        <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Agendadas</span>
                                <span style={{ fontWeight: 600 }}>{consultasResumo.agendadasMes}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Taxa de Faltas</span>
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{consultasResumo.taxaFaltas}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Balanco Financeiro */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">BALANCO FINANCEIRO</div>
                    </div>
                    <div style={{ height: 250 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={previsaoData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="receitas" stroke="var(--success)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="despesas" stroke="var(--danger)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Procedimentos e Ocupacao */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">PROCEDIMENTOS REALIZADOS</div>
                        </div>
                        <div style={{ height: 200 }}>
                            {procedimentosData.length === 0 ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                    Sem procedimentos registrados no periodo
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={procedimentosData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                            {procedimentosData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="card-title" style={{ marginBottom: 20 }}>TAXA DE OCUPACAO</div>
                        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="120" height="120">
                                <circle cx="60" cy="60" r="54" fill="none" stroke="#eee" strokeWidth="12" />
                                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--primary)" strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 54 * (ocupacao / 100)} ${2 * Math.PI * 54}`}
                                    strokeLinecap="round" transform="rotate(-90 60 60)" />
                            </svg>
                            <div style={{ position: 'absolute', fontSize: 24, fontWeight: 800 }}>{ocupacao}%</div>
                        </div>
                        <div style={{ marginTop: 15, fontSize: 12, color: 'var(--text-muted)' }}>Cadeiras ocupadas hoje</div>
                    </div>
                </div>
            </div>

            {/* Sidebar Lateral */}
            <div className="sidebar-right" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Proximos Pacientes */}
                <div className="card" style={{ padding: '15px 0' }}>
                    <div style={{ padding: '0 15px 10px 15px', borderBottom: '1px solid var(--border-light)', marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>PROXIMOS PACIENTES</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hoje e proximos 3 dias</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {proximosPacientes.length === 0 ? (
                            <div style={{ padding: 15, fontSize: 12, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum agendamento</div>
                        ) : (
                            proximosPacientes.map(ag => (
                                <div key={ag.id} style={{ padding: '10px 15px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 10 }}>
                                    <div style={{ background: 'var(--bg)', borderRadius: 4, padding: '4px 8px', textAlign: 'center', minWidth: 50 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{format(new Date(ag.data_inicio), 'HH:mm')}</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{ag.patients?.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ag.situacao}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Financeiro Rapido */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">FINANCEIRO</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Receitas</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>R$ {financeiroResumo.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div style={{ paddingBottom: 15, borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Despesas</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>R$ {financeiroResumo.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div style={{ fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                <span>A receber hoje</span>
                                <span style={{ fontWeight: 600 }}>R$ {financeiroHoje.receber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>A pagar hoje</span>
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>R$ {financeiroHoje.pagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
