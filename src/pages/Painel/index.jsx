import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addDays } from 'date-fns'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'

export default function Painel() {
    const [pacientesTotal, setPacientesTotal] = useState(0)
    const [proximosPacientes, setProximosPacientes] = useState([])
    const [financeiroResumo, setFinanceiroResumo] = useState({ receitas: 0, despesas: 0 })
    const [procedimentosData, setProcedimentosData] = useState([])
    const [previsaoData, setPrevisaoData] = useState([])
    const [ocupacao, setOcupacao] = useState(0)
    const [loading, setLoading] = useState(true)

    const loadPainel = useCallback(async () => {
        setLoading(true)
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            const next3Days = format(addDays(new Date(), 3), 'yyyy-MM-dd')

            // 1. Total de pacientes
            const { count: pCount } = await supabase.from('patients').select('*', { count: 'exact', head: true })
            setPacientesTotal(pCount || 0)

            // 2. Próximos pacientes (Agendamentos Hoje/Amanhã)
            const { data: agendamentos } = await supabase
                .from('agendamentos')
                .select('id, data_inicio, situacao, patients(name)')
                .gte('data_inicio', `${today}T00:00:00`)
                .lte('data_inicio', `${next3Days}T23:59:59`)
                .order('data_inicio', { ascending: true })
                .limit(10)

            setProximosPacientes(agendamentos || [])

            // 3. Financeiro Resumo (Mês Atual)
            const firstDayMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
            const { data: receitas } = await supabase.from('financeiro_receitas').select('valor').gte('data_pagamento', firstDayMonth)
            const { data: despesas } = await supabase.from('financeiro_despesas').select('valor').gte('data_pagamento', firstDayMonth)

            const totalRec = (receitas || []).reduce((acc, curr) => acc + Number(curr.valor), 0)
            const totalDesp = (despesas || []).reduce((acc, curr) => acc + Number(curr.valor), 0)
            setFinanceiroResumo({ receitas: totalRec, despesas: totalDesp })

            // 4. Mock data para gráficos (se não houver dados reais suficientes)
            setProcedimentosData([
                { name: 'Limpeza', value: 400 },
                { name: 'Restauração', value: 300 },
                { name: 'Implante', value: 300 },
                { name: 'Ortodontia', value: 200 },
            ])

            setPrevisaoData([
                { name: 'Seg', receitas: 1200, despesas: 800 },
                { name: 'Ter', receitas: 1900, despesas: 1100 },
                { name: 'Qua', receitas: 1500, despesas: 900 },
                { name: 'Qui', receitas: 2200, despesas: 1400 },
                { name: 'Sex', receitas: 2800, despesas: 1200 },
            ])

            setOcupacao(65) // Mock 65%

        } catch (e) {
            console.error('Erro ao carregar painel:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPainel()
    }, [loadPainel])

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

    if (loading) return <div className="loading"><div className="spinner" /></div>

    return (
        <div className="painel-dental-office" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, padding: 20 }}>
            {/* Coluna Principal */}
            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Seção Pacientes e Consultas */}
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
                                    <BarChart data={[{ v: 40 }, { v: 45 }, { v: 50 }, { v: 55 }, { v: 60 }]}>
                                        <Bar dataKey="v" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Novos este mês</span>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>+12</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Distribuição por Gênero</span>
                                <span>60% F / 40% M</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">CONSULTAS</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 'bold' }}>128</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Realizadas no mês</div>
                            </div>
                            <div style={{ width: 100, height: 60 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={[{ v: 10 }, { v: 15 }, { v: 12 }, { v: 20 }, { v: 18 }]}>
                                        <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Agendadas</span>
                                <span style={{ fontWeight: 600 }}>45</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Taxa de Faltas</span>
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>8%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Balanço Financeiro */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">BALANÇO FINANCEIRO</div>
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

                {/* Procedimentos e Ocupação */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">PROCEDIMENTOS REALIZADOS</div>
                        </div>
                        <div style={{ height: 200 }}>
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
                        </div>
                    </div>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="card-title" style={{ marginBottom: 20 }}>TAXA DE OCUPAÇÃO</div>
                        <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="120" height="120">
                                <circle cx="60" cy="60" r="54" fill="none" stroke="#eee" strokeWidth="12" />
                                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--primary)" strokeWidth="12"
                                    strokeDasharray={`${2 * Math.PI * 54 * (ocupacao / 100)} ${2 * Math.PI * 54}`}
                                    strokeLinecap="round" transform="rotate(-90 60 60)" />
                            </svg>
                            <div style={{ position: 'absolute', fontSize: 24, fontWeight: 800 }}>{ocupacao}%</div>
                        </div>
                        <div style={{ marginTop: 15, fontSize: 12, color: 'var(--text-muted)' }}>Cadeiras ocupadas</div>
                    </div>
                </div>
            </div>

            {/* Sidebar Lateral */}
            <div className="sidebar-right" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Próximos Pacientes */}
                <div className="card" style={{ padding: '15px 0' }}>
                    <div style={{ padding: '0 15px 10px 15px', borderBottom: '1px solid var(--border-light)', marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>PRÓXIMOS PACIENTES</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hoje | Amanhã</div>
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

                {/* Financeiro Rápido */}
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
                                <span style={{ fontWeight: 600 }}>R$ 1.250,00</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>A pagar hoje</span>
                                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>R$ 450,00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
