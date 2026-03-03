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

export default function RelatorioMensalDetalhado() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState([])

    const loadData = useCallback(async () => {
        setLoading(true)
        const start = startOfMonth(currentDate)
        const end = endOfMonth(currentDate)

        // Buscar agendamentos do mês
        const { data: agendamentos } = await supabase
            .from('agendamentos')
            .select('data_inicio, situacao')
            .gte('data_inicio', start.toISOString())
            .lte('data_inicio', end.toISOString())

        // Agrupar por dia
        const days = eachDayOfInterval({ start: startOfWeek(start), end: endOfWeek(end) })

        const processed = days.map(day => {
            const dayEvents = (agendamentos || []).filter(e => isSameDay(new Date(e.data_inicio), day))

            return {
                day,
                isCurrentMonth: isSameMonth(day, start),
                agendados: dayEvents.length,
                confirmados: dayEvents.filter(e => ['confirmado', 'agendado'].includes(e.situacao)).length,
                compareceram: dayEvents.filter(e => e.situacao === 'atendido').length,
                vendas: dayEvents.filter(e => e.situacao === 'atendido' && e.valor > 0).length,
                // Em um sistema real, "vendas" viria da tabela financeiro_receitas
            }
        })

        // Agrupar por semanas
        const weeks = []
        for (let i = 0; i < processed.length; i += 7) {
            weeks.push(processed.slice(i, i + 7))
        }

        setData(weeks)
        setLoading(false)
    }, [currentDate])

    useEffect(() => {
        const timer = setTimeout(() => { loadData() }, 0)
        return () => clearTimeout(timer)
    }, [loadData])

    return (
        <div className="relatorio-mensal-container">
            <div className="relatorio-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className="fa-solid fa-calendar-days" style={{ fontSize: 20, color: 'var(--primary)' }} />
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Relatório Mensal Detalhado</h2>
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
                    <button className="btn btn-sm btn-secondary"><i className="fa-solid fa-file-excel" /> Exportar Mensal (.xlsx)</button>
                </div>
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                <div className="weeks-container" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                    {data.map((week, wIdx) => (
                        <div key={wIdx} className="week-card" style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div className="week-header" style={{ padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>Semana {wIdx + 1}</div>
                                <div style={{ display: 'flex', gap: 30, fontSize: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <i className="fa-solid fa-calendar-check" style={{ color: '#6366F1' }} /> Agendamentos:
                                        <span style={{ fontWeight: 700, color: '#EF4444' }}> 0/80</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <i className="fa-solid fa-user-check" style={{ color: '#8B5CF6' }} /> Visitas:
                                        <span style={{ fontWeight: 700, color: '#EF4444' }}> 0/40</span>
                                    </div>
                                </div>
                            </div>

                            <div className="days-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#F1F5F9', gap: 1 }}>
                                {week.map((dayObj, dIdx) => (
                                    <div key={dIdx} style={{
                                        background: dayObj.isCurrentMonth ? 'white' : '#F8FAFC',
                                        padding: 15,
                                        minHeight: 140,
                                        opacity: dayObj.isCurrentMonth ? 1 : 0.5
                                    }}>
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
                                                <i className="fa-solid fa-calendar-plus" style={{ width: 14, color: '#64748B' }} title="Agendamentos Criados" />
                                                <span style={{ fontWeight: 700 }}>{dayObj.agendados}</span>
                                            </div>
                                            <div className="metric-item" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                                                <i className="fa-solid fa-clock" style={{ width: 14, color: '#64748B' }} title="Previstos" />
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
                    ))}
                </div>
            )}
        </div>
    )
}
