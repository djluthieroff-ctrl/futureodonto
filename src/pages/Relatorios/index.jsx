import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import RelatorioMensalDetalhado from './RelatorioMensalDetalhado'

export default function Relatorios() {
    const navigate = useNavigate()
    const location = useLocation()
    const currentTab = location.pathname.split('/').pop() || 'financeiro'

    const [periodo, setPeriodo] = useState('mes_atual')
    const [stats, setStats] = useState({ receitas: 0, despesas: 0, atendimentos: 0, novos_pacientes: 0 })
    const [loading, setLoading] = useState(true)
    const [chartData, setChartData] = useState([])

    const loadStats = useCallback(async () => {
        setLoading(true)
        let start
        let end

        if (periodo === 'mes_atual') {
            start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
            end = format(endOfMonth(new Date()), 'yyyy-MM-dd')
        } else if (periodo === 'mes_anterior') {
            const prev = subMonths(new Date(), 1)
            start = format(startOfMonth(prev), 'yyyy-MM-dd')
            end = format(endOfMonth(prev), 'yyyy-MM-dd')
        } else {
            start = '2000-01-01'
            end = '2100-12-31'
        }

        const [{ data: rec }, { data: des }, { count: pac }, { count: ag }] = await Promise.all([
            supabase.from('financeiro_receitas').select('valor_total').gte('data_vencimento', start).lte('data_vencimento', end),
            supabase.from('financeiro_despesas').select('valor_total').gte('data_vencimento', start).lte('data_vencimento', end),
            supabase.from('patients').select('*', { count: 'exact', head: true }).gte('created_at', start).lte('created_at', end),
            supabase.from('agendamentos').select('*', { count: 'exact', head: true }).gte('data_inicio', start).lte('data_inicio', end)
        ])

        const totRec = rec?.reduce((acc, r) => acc + Number(r.valor_total), 0) || 0
        const totDes = des?.reduce((acc, d) => acc + Number(d.valor_total), 0) || 0

        setStats({
            receitas: totRec,
            despesas: totDes,
            novos_pacientes: pac || 0,
            atendimentos: ag || 0
        })

        if (currentTab === 'financeiro') {
            setChartData([
                { name: 'Receitas', value: totRec, color: '#10B981' },
                { name: 'Despesas', value: totDes, color: '#EF4444' }
            ])
        } else {
            setChartData([
                { name: 'Pacientes', value: pac || 0, color: '#3B82F6' },
                { name: 'Atendimentos', value: ag || 0, color: '#8B5CF6' }
            ])
        }

        setLoading(false)
    }, [currentTab, periodo])

    useEffect(() => {
        if (location.pathname === '/relatorios' || location.pathname === '/relatorios/') {
            navigate('/relatorios/financeiro', { replace: true })
            return
        }
        const timer = setTimeout(() => { loadStats() }, 0)
        return () => clearTimeout(timer)
    }, [location.pathname, navigate, loadStats])

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Relatorios</h1>
                <div style={{ display: 'flex', gap: 10 }}>
                    <select className="form-control" style={{ width: 180 }} value={periodo} onChange={e => setPeriodo(e.target.value)}>
                        <option value="mes_atual">Mes Atual</option>
                        <option value="mes_anterior">Mes Anterior</option>
                        <option value="tudo">Todo Periodo</option>
                    </select>
                    <button className="btn btn-secondary">
                        <i className="fa-solid fa-download" /> Exportar PDF
                    </button>
                </div>
            </div>

            <div className="tabs">
                <div className={`tab${currentTab === 'financeiro' ? ' active' : ''}`} onClick={() => navigate('/relatorios/financeiro')}>
                    <i className="fa-solid fa-dollar-sign" style={{ marginRight: 6 }} />Financeiro
                </div>
                <div className={`tab${currentTab === 'atendimentos' ? ' active' : ''}`} onClick={() => navigate('/relatorios/atendimentos')}>
                    <i className="fa-solid fa-stethoscope" style={{ marginRight: 6 }} />Atendimentos
                </div>
                <div className={`tab${currentTab === 'detalhado' ? ' active' : ''}`} onClick={() => navigate('/relatorios/detalhado')}>
                    <i className="fa-solid fa-calendar-days" style={{ marginRight: 6 }} />Mensal Detalhado
                </div>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : currentTab === 'detalhado' ? (
                <RelatorioMensalDetalhado />
            ) : (
                <div className="grid-2">
                    <div className="card">
                        <div className="card-header"><div className="card-title">Visao Geral</div></div>
                        <div style={{ height: 300, padding: '20px 0' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid-2" style={{ gridGap: 16 }}>
                        <div className="card" style={{ borderLeft: '4px solid #10B981' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Receitas no Periodo</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', marginTop: 4 }}>R$ {stats.receitas.toFixed(2)}</div>
                        </div>
                        <div className="card" style={{ borderLeft: '4px solid #EF4444' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Despesas no Periodo</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>R$ {stats.despesas.toFixed(2)}</div>
                        </div>
                        <div className="card" style={{ borderLeft: '4px solid #3B82F6' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Novos Pacientes</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>{stats.novos_pacientes}</div>
                        </div>
                        <div className="card" style={{ borderLeft: '4px solid #8B5CF6' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Atendimentos Realizados</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', marginTop: 4 }}>{stats.atendimentos}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
