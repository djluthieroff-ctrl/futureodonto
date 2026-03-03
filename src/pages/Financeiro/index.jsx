import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { exportToCSV } from '../../utils/export'
import { useToast } from '../../components/ui/Toast'

export default function Financeiro() {
    const toast = useToast()
    const [tab, setTab] = useState('receitas')
    const [receitas, setReceitas] = useState([])
    const [despesas, setDespesas] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ descricao: '', valor_total: '', data_vencimento: '', forma_pagamento: 'dinheiro', status: 'pendente', num_parcelas: 1 })
    const [saving, setSaving] = useState(false)
    const [fluxoData, setFluxoData] = useState([])

    const loadFluxo = useCallback(async () => {
        const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
        const end = format(endOfMonth(new Date()), 'yyyy-MM-dd')

        const { data: rec } = await supabase.from('financeiro_receitas').select('valor_total,data_vencimento').gte('data_vencimento', start).lte('data_vencimento', end)
        const { data: des } = await supabase.from('financeiro_despesas').select('valor_total,data_vencimento').gte('data_vencimento', start).lte('data_vencimento', end)

        const dias = eachDayOfInterval({ start: new Date(start + 'T00:00:00'), end: new Date(end + 'T00:00:00') })

        const chartData = dias.map(dia => {
            const dStr = format(dia, 'yyyy-MM-dd')
            const rTotal = rec?.filter(r => r.data_vencimento === dStr).reduce((acc, r) => acc + Number(r.valor_total), 0) || 0
            const dTotal = des?.filter(d => d.data_vencimento === dStr).reduce((acc, d) => acc + Number(d.valor_total), 0) || 0
            return {
                label: format(dia, 'dd/MM'),
                receitas: rTotal,
                despesas: dTotal
            }
        })
        setFluxoData(chartData)
    }, [])

    const loadFinanceiro = useCallback(async () => {
        setLoading(true)
        try {
            if (tab === 'receitas') {
                const { data, error } = await supabase.from('financeiro_receitas').select('*,patients(name)').order('data_vencimento')
                if (error) throw error
                setReceitas(data || [])
            } else if (tab === 'despesas') {
                const { data, error } = await supabase.from('financeiro_despesas').select('*').order('data_vencimento')
                if (error) throw error
                setDespesas(data || [])
            } else if (tab === 'fluxo') {
                await loadFluxo()
            }
        } catch (err) {
            console.error('Erro ao carregar financeiro:', err)
            toast.error('Erro ao carregar dados: ' + (err.message || 'Verifique a conexão.'))
        } finally {
            setLoading(false)
        }
    }, [tab, loadFluxo, toast])

    useEffect(() => {
        const timer = setTimeout(() => { loadFinanceiro() }, 0)
        return () => clearTimeout(timer)
    }, [loadFinanceiro])

    async function handleSave() {
        if (!form.descricao || !form.valor_total) { toast.warning('Preencha os campos obrigatórios.'); return }
        setSaving(true)
        try {
            const table = tab === 'receitas' ? 'financeiro_receitas' : 'financeiro_despesas'
            const { error } = await supabase.from(table).insert([{
                ...form,
                valor_total: Number(form.valor_total),
                paciente_id: form.paciente_id || null
            }])

            if (error) {
                console.error('Erro ao salvar financeiro:', error)
                toast.error('Erro ao salvar: ' + (error.message || 'Verifique os dados.'))
                setSaving(false)
                return
            }

            toast.success((tab === 'receitas' ? 'Receita' : 'Despesa') + ' salva com sucesso!')
            setSaving(false)
            setModal(false)
            setForm({ descricao: '', valor_total: '', data_vencimento: '', forma_pagamento: 'dinheiro', status: 'pendente', num_parcelas: 1 })
            loadFinanceiro()
        } catch (err) {
            console.error('Erro crítico no financeiro:', err)
            toast.error('Erro inesperado ao salvar.')
            setSaving(false)
        }
    }

    const getStatusBadge = (s) => {
        if (s === 'pago' || s === 'recebido') return <span className="badge badge-success">Pago</span>
        if (s === 'pendente') return <span className="badge badge-warning">Pendente</span>
        if (s === 'atrasado') return <span className="badge badge-danger">Atrasado</span>
        return <span className="badge badge-gray">{s}</span>
    }

    const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor_total || 0), 0)
    const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor_total || 0), 0)

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Financeiro</h1>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => exportToCSV(tab === 'receitas' ? receitas : despesas, `financeiro_${tab}.csv`)}>
                        <i className="fa-solid fa-file-excel" /> Exportar
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal(true)}>
                        <i className="fa-solid fa-plus" /> {tab === 'receitas' ? 'Nova Receita' : 'Nova Despesa'}
                    </button>
                </div>
            </div>

            <div className="grid-3" style={{ marginBottom: 20 }}>
                <div className="card" style={{ borderTop: '3px solid var(--success)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Total a Receber</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>R$ {totalReceitas.toFixed(2)}</div>
                </div>
                <div className="card" style={{ borderTop: '3px solid var(--danger)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Total a Pagar</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>R$ {totalDespesas.toFixed(2)}</div>
                </div>
                <div className="card" style={{ borderTop: '3px solid var(--info)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Saldo Previsto</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: totalReceitas - totalDespesas >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        R$ {(totalReceitas - totalDespesas).toFixed(2)}
                    </div>
                </div>
            </div>

            <div className="tabs">
                {['receitas', 'despesas', 'fluxo'].map(t => (
                    <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'receitas' && <><i className="fa-solid fa-arrow-down" style={{ marginRight: 6, color: 'var(--success)' }} />Contas a Receber</>}
                        {t === 'despesas' && <><i className="fa-solid fa-arrow-up" style={{ marginRight: 6, color: 'var(--danger)' }} />Contas a Pagar</>}
                        {t === 'fluxo' && <><i className="fa-solid fa-chart-line" style={{ marginRight: 6 }} />Fluxo de Caixa</>}
                    </div>
                ))}
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                <>
                    {tab === 'receitas' && (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Descrição</th><th>Paciente</th><th>Valor</th><th>Vencimento</th><th>Forma Pag.</th><th>Status</th></tr></thead>
                                <tbody>
                                    {receitas.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Nenhuma receita encontrada</td></tr>
                                    ) : receitas.map(r => (
                                        <tr key={r.id}>
                                            <td><strong>{r.descricao}</strong></td>
                                            <td>{r.patients?.name || '—'}</td>
                                            <td style={{ color: 'var(--success)', fontWeight: 600 }}>R$ {Number(r.valor_total).toFixed(2)}</td>
                                            <td>{r.data_vencimento ? format(new Date(r.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
                                            <td>{r.forma_pagamento || '—'}</td>
                                            <td>{getStatusBadge(r.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'despesas' && (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead>
                                <tbody>
                                    {despesas.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>Nenhuma despesa encontrada</td></tr>
                                    ) : despesas.map(d => (
                                        <tr key={d.id}>
                                            <td><strong>{d.descricao}</strong></td>
                                            <td>{d.categoria || '—'}</td>
                                            <td>{d.fornecedor || '—'}</td>
                                            <td style={{ color: 'var(--danger)', fontWeight: 600 }}>R$ {Number(d.valor_total).toFixed(2)}</td>
                                            <td>{d.data_vencimento ? format(new Date(d.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
                                            <td>{getStatusBadge(d.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'fluxo' && (
                        <div className="card">
                            <div className="card-header"><div className="card-title">Fluxo de Caixa Mensal</div></div>
                            <div style={{ height: 400, padding: '20px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={fluxoData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" fontSize={11} />
                                        <YAxis fontSize={11} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </>
            )}

            {modal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title">{tab === 'receitas' ? 'Nova Receita' : 'Nova Despesa'}</div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Descrição *</label>
                                    <input className="form-control" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Valor (R$) *</label>
                                    <input type="number" className="form-control" value={form.valor_total} onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data de vencimento</label>
                                    <input type="date" className="form-control" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Forma de Pagamento</label>
                                    <select className="form-control" value={form.forma_pagamento} onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value }))}>
                                        <option value="dinheiro">Dinheiro</option>
                                        <option value="pix">PIX</option>
                                        <option value="cartao_credito">Cartão de Crédito</option>
                                        <option value="cartao_debito">Cartão de Débito</option>
                                        <option value="boleto">Boleto</option>
                                        <option value="transferencia">Transferência</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-control" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                                        <option value="pendente">Pendente</option>
                                        <option value="pago">Pago</option>
                                        <option value="atrasado">Atrasado</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
