import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

export default function IndicacaoPremiada() {
    const [indicacoes, setIndicacoes] = useState([])
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('indicacoes')
            .select('*,indicador:patients!indicador_id(name),indicado:patients!indicado_id(name)')
            .order('criado_em', { ascending: false })
        setIndicacoes(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => { load() }, 0)
        return () => clearTimeout(timer)
    }, [load])

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Indicação Premiada</h1>
                <p className="page-subtitle">Programa de recompensas para pacientes que indicam amigos</p>
            </div>

            <div className="grid-3" style={{ marginBottom: 20 }}>
                <div className="card" style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)', color: 'white' }}>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>Total de Indicações</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{indicacoes.length}</div>
                </div>
                <div className="card">
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Prêmios Resgatados</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)' }}>0</div>
                </div>
                <div className="card">
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Novos Pacientes via Indicação</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{indicacoes.filter(i => i.status === 'convertido').length}</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header"><div className="card-title">Ranking de Indicadores</div></div>
                {loading ? <div className="loading"><div className="spinner" /></div> : (
                    indicacoes.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><i className="fa-solid fa-gift" /></div>
                            <h3>Nenhuma indicação cadastrada</h3>
                            <p>As indicações aparecem aqui conforme os pacientes indicam novos amigos.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Data</th><th>Quem Indicou</th><th>Paciente Indicado</th><th>Status</th><th>Prêmio</th></tr></thead>
                                <tbody>
                                    {indicacoes.map(i => (
                                        <tr key={i.id}>
                                            <td>{format(new Date(i.criado_em), 'dd/MM/yyyy')}</td>
                                            <td><strong>{i.indicador?.name || '—'}</strong></td>
                                            <td>{i.indicado?.name || '—'}</td>
                                            <td>
                                                <span className={`badge ${i.status === 'convertido' ? 'badge-success' : 'badge-info'}`}>
                                                    {i.status}
                                                </span>
                                            </td>
                                            <td>{i.premio || 'A definir'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
