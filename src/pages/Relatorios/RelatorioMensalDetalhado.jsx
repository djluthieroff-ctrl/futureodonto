import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    addMonths,
    subMonths,
    isSameDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { exportToCSV } from '../../utils/export'

export default function RelatorioMensalDetalhado() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState([])
    const [selectedDay, setSelectedDay] = useState(null)

    const handleExport = () => {
        if (!data || data.length === 0) return

        const allDays = data.flat().filter(d => d.isCurrentMonth)
        const exportData = allDays.map(d => ({
            'Data': format(d.day, 'dd/MM/yyyy'),
            'Dia da Semana': format(d.day, 'EEEE', { locale: ptBR }),
            'Agendamentos Criados': d.novosAgendamentos,
            'Visitas Previstas': d.confirmados,
            'Compareceram': d.compareceram,
            'Vendas': d.vendas
        }))

        const fileName = `Relatorio_Mensal_${format(currentDate, 'MMMM_yyyy', { locale: ptBR })}.csv`
        exportToCSV(exportData, fileName)
    }

    const loadData = useCallback(async () => {
        setLoading(true)

        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)
        const rangeStart = startOfWeek(monthStart)
        const rangeEnd = endOfWeek(monthEnd)

        try {
            const [
                { data: agendamentosData, error: agError },
                { data: receitasCriadasData, error: recCriadasError },
                { data: receitasVencimentoData, error: recVencError }
            ] = await Promise.all([
                supabase
                    .from('agendamentos')
                    .select('id,paciente_id,data_inicio,created_at,situacao,motivo,tipo,patients(name)')
                    .gte('data_inicio', rangeStart.toISOString())
                    .lte('data_inicio', rangeEnd.toISOString()),
                supabase
                    .from('financeiro_receitas')
                    .select('id,paciente_id,created_at,data_vencimento,valor_total,status')
                    .gte('created_at', rangeStart.toISOString())
                    .lte('created_at', rangeEnd.toISOString()),
                supabase
                    .from('financeiro_receitas')
                    .select('id,paciente_id,created_at,data_vencimento,valor_total,status')
                    .gte('data_vencimento', format(rangeStart, 'yyyy-MM-dd'))
                    .lte('data_vencimento', format(rangeEnd, 'yyyy-MM-dd'))
            ])

            if (agError) throw agError
            if (recCriadasError) throw recCriadasError
            if (recVencError) throw recVencError

            const agendamentos = agendamentosData || []
            const receitasMap = {}
                ; (receitasCriadasData || []).forEach((r) => { receitasMap[r.id] = r })
                ; (receitasVencimentoData || []).forEach((r) => { receitasMap[r.id] = r })
            const receitas = Object.values(receitasMap)

            const patientIds = [
                ...new Set([
                    ...agendamentos.map((a) => a.paciente_id).filter(Boolean),
                    ...receitas.map((r) => r.paciente_id).filter(Boolean)
                ])
            ]
            const patientMap = {}

            if (patientIds.length > 0) {
                const { data: patientsData, error: pError } = await supabase
                    .from('patients')
                    .select('id,name')
                    .in('id', patientIds)
                if (!pError) {
                    ; (patientsData || []).forEach((p) => {
                        patientMap[p.id] = p.name
                    })
                }
            }

            const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })

            const processed = days.map(day => {
                const agendadosNoDia = agendamentos
                    .filter(e => isSameDay(new Date(e.data_inicio), day))
                    .map((e) => ({ ...e, patient_name: e.patients?.name || patientMap[e.paciente_id] || '-' }))

                // Indicador 2: Compareceram (User Check)
                const compareceramNoDia = agendadosNoDia.filter(e => e.situacao === 'atendido')

                // Indicador 1: Quem estava para visitar (Clock) - Todo o agendamento do dia
                const totalVisitasPrevistas = agendadosNoDia.length

                // Indicador 4: Quem fechou venda (Sack Dollar)
                const vendasNoDia = [
                    ...receitas.filter((r) => {
                        if (r.created_at && isSameDay(new Date(r.created_at), day)) return true
                        if (r.data_vencimento) {
                            const [year, month, d] = r.data_vencimento.split('-').map(Number);
                            return isSameDay(new Date(year, month - 1, d), day);
                        }
                        return false
                    }).map((r) => ({ ...r, patient_name: patientMap[r.paciente_id] || '-' })),
                    ...agendadosNoDia.filter(a => a.tipo === 'venda')
                ]

                // Indicador 3: Quem foi agendado aquele dia (Calendar Plus) - Data de criação
                const novosAgendamentosNoDia = agendamentos.filter(e => e.created_at && isSameDay(new Date(e.created_at), day)).length

                return {
                    day,
                    isCurrentMonth: isSameMonth(day, monthStart),
                    agendados: totalVisitasPrevistas,
                    confirmados: totalVisitasPrevistas, // No UI, confirmados é o ícone de relógio (Visitas para o dia)
                    compareceram: compareceramNoDia.length,
                    vendas: vendasNoDia.length,
                    novosAgendamentos: novosAgendamentosNoDia,
                    detalhes: {
                        agendadosNoDia,
                        compareceramNoDia,
                        vendasNoDia
                    }
                }
            })

            const weeks = []
            for (let i = 0; i < processed.length; i += 7) {
                weeks.push(processed.slice(i, i + 7))
            }

            setData(weeks)
        } catch (error) {
            console.error('Erro ao carregar relatorio mensal detalhado:', error)
            setData([])
        } finally {
            setLoading(false)
        }
    }, [currentDate])

    useEffect(() => {
        const timer = setTimeout(() => { loadData() }, 0)
        return () => clearTimeout(timer)
    }, [loadData])

    const renderPessoa = (item, prefix = 'Paciente') => {
        const nome = item?.patient_name || item?.patients?.name || '-'
        return (
            <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                <strong>{nome}</strong>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {prefix} {item.data_inicio ? `| ${format(new Date(item.data_inicio), 'HH:mm')}` : ''}
                </div>
            </div>
        )
    }

    return (
        <div className="relatorio-mensal-container">
            <div className="relatorio-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fa-solid fa-calendar-days" style={{ fontSize: 20, color: 'var(--primary)' }} />
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Relatorio Mensal Detalhado</h2>
                </div>

                <div className="month-selector" style={{ display: 'flex', alignItems: 'center', gap: 15, background: 'white', padding: '6px 16px', borderRadius: 25, border: '1px solid var(--border)' }}>
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <i className="fa-solid fa-chevron-left" />
                    </button>
                    <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <i className="fa-solid fa-chevron-right" />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} /> Meta Batida</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} /> Pendente</div>
                    <button
                        className="btn btn-sm btn-secondary"
                        onClick={handleExport}
                    >
                        <i className="fa-solid fa-file-excel" /> Exportar Mensal (.xlsx)
                    </button>
                </div>
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                <div className="weeks-container" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                    {data.map((week, wIdx) => {
                        const totalAg = week.reduce((acc, d) => acc + d.agendados, 0)
                        const totalComp = week.reduce((acc, d) => acc + d.compareceram, 0)

                        return (
                            <div key={wIdx} className="week-card" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div className="week-header" style={{ padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700 }}>Semana {wIdx + 1}</div>
                                    <div style={{ display: 'flex', gap: 30, fontSize: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <i className="fa-solid fa-calendar-check" style={{ color: '#6366F1' }} /> Visitas Previstas:
                                            <span style={{ fontWeight: 700, color: '#0F172A' }}> {totalAg}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <i className="fa-solid fa-user-check" style={{ color: '#8B5CF6' }} /> Compareceram:
                                            <span style={{ fontWeight: 700, color: '#0F172A' }}> {totalComp}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F1F5F9', gap: 1 }}>
                                    {week.map((dayObj, dIdx) => (
                                        <div
                                            key={dIdx}
                                            onClick={() => setSelectedDay(dayObj)}
                                            style={{
                                                background: dayObj.isCurrentMonth ? 'white' : '#F8FAFC',
                                                padding: 15,
                                                minHeight: 140,
                                                opacity: dayObj.isCurrentMonth ? 1 : 0.5,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {format(dayObj.day, 'EEE', { locale: ptBR })}
                                                </div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: dayObj.isCurrentMonth ? '#1E293B' : '#94A3B8' }}>
                                                    {format(dayObj.day, 'd')}
                                                </div>
                                            </div>

                                            <div className="metrics-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div className="metric-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                                    <i className="fa-solid fa-calendar-plus" style={{ width: 14, color: '#64748B' }} title="Agendamentos Criados Hoje" />
                                                    <span style={{ fontWeight: 700 }}>{dayObj.novosAgendamentos}</span>
                                                </div>
                                                <div className="metric-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                                    <i className="fa-solid fa-clock" style={{ width: 14, color: '#64748B' }} title="Visitas para o dia" />
                                                    <span style={{ fontWeight: 700 }}>{dayObj.confirmados}</span>
                                                </div>
                                                <div className="metric-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                                    <i className="fa-solid fa-user-check" style={{ width: 14, color: '#64748B' }} title="Compareceram" />
                                                    <span style={{ fontWeight: 700 }}>{dayObj.compareceram}</span>
                                                </div>
                                                <div className="metric-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                                    <i className="fa-solid fa-sack-dollar" style={{ width: 14, color: '#64748B' }} title="Vendas" />
                                                    <span style={{ fontWeight: 700 }}>{dayObj.vendas}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {selectedDay && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedDay(null)}>
                    <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <div className="modal-title">
                                Detalhes do dia {format(selectedDay.day, 'dd/MM/yyyy')}
                            </div>
                            <button className="modal-close" onClick={() => setSelectedDay(null)}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>

                        <div className="modal-body" style={{
                            flex: 1,
                            overflowY: 'auto',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: 16,
                            padding: '16px'
                        }}>
                            <div className="card" style={{ margin: 0, height: 'fit-content' }}>
                                <div className="card-header"><div className="card-title">Agendados no dia</div></div>
                                <div style={{ padding: '0 16px 12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                                    Total: {selectedDay.detalhes.agendadosNoDia.length}
                                </div>
                                <div style={{ padding: '0 16px 12px 16px' }}>
                                    {selectedDay.detalhes.agendadosNoDia.length === 0 ? <span>Nenhum agendamento.</span> : selectedDay.detalhes.agendadosNoDia.map((a) => renderPessoa(a, 'Agendado'))}
                                </div>
                            </div>

                            <div className="card" style={{ margin: 0, height: 'fit-content' }}>
                                <div className="card-header"><div className="card-title">Compareceram</div></div>
                                <div style={{ padding: '0 16px 12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                                    Total: {selectedDay.detalhes.compareceramNoDia.length}
                                </div>
                                <div style={{ padding: '0 16px 12px 16px' }}>
                                    {selectedDay.detalhes.compareceramNoDia.length === 0 ? <span>Ninguem compareceu.</span> : selectedDay.detalhes.compareceramNoDia.map((a) => renderPessoa(a, 'Compareceu'))}
                                </div>
                            </div>

                            <div className="card" style={{ margin: 0, height: 'fit-content' }}>
                                <div className="card-header"><div className="card-title">Fecharam venda</div></div>
                                <div style={{ padding: '0 16px 12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                                    Total: {selectedDay.detalhes.vendasNoDia.length}
                                </div>
                                <div style={{ padding: '0 16px 12px 16px' }}>
                                    {selectedDay.detalhes.vendasNoDia.length === 0 ? (
                                        <span>Nenhuma venda registrada.</span>
                                    ) : (
                                        selectedDay.detalhes.vendasNoDia.map((v) => (
                                            <div key={v.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                                                <strong>{v?.patient_name || v?.patients?.name || '-'}</strong>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Valor: R$ {Number(v.valor_total || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="card" style={{ margin: 0, height: 'fit-content' }}>
                                <div className="card-header"><div className="card-title">Resumo do dia</div></div>
                                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                                    <div><strong>Novos agendamentos criados:</strong> {selectedDay.novosAgendamentos}</div>
                                    <div><strong>Agendados para o dia:</strong> {selectedDay.agendados}</div>
                                    <div><strong>Compareceram:</strong> {selectedDay.compareceram}</div>
                                    <div><strong>Vendas:</strong> {selectedDay.vendas}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
