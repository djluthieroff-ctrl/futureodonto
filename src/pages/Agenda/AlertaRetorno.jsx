import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, addDays } from 'date-fns'

export default function AlertaRetorno() {
    const [alertas, setAlertas] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [pacientes, setPacientes] = useState([])
    const [dentistas, setDentistas] = useState([])
    const [form, setForm] = useState({ paciente_id: '', dentista_id: '', motivo: '', data_alerta: format(addDays(new Date(), 30), 'yyyy-MM-dd'), observacoes: '' })
    const [pacSearch, setPacSearch] = useState('')
    const [saving, setSaving] = useState(false)
    const [tabAtiva, setTabAtiva] = useState('pendente')

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('alertas_retorno')
            .select('*,patients(name,phone),dentistas(nome)')
            .eq('status', tabAtiva)
            .order('data_alerta')
        setAlertas(data || [])
        setLoading(false)
    }, [tabAtiva])

    const loadConfigs = useCallback(async () => {
        const [{ data: d }] = await Promise.all([supabase.from('dentistas').select('id,nome').eq('ativo', true)])
        setDentistas(d || [])
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            load()
            loadConfigs()
        }, 0)
        return () => clearTimeout(timer)
    }, [load, loadConfigs])

    async function searchPacientes(q) {
        const { data } = await supabase.from('patients').select('id,name,phone').ilike('name', `%${q}%`).limit(8)
        setPacientes(data || [])
    }

    async function handleSave() {
        if (!form.paciente_id || !form.data_alerta) { alert('Paciente e data são obrigatórios'); return }
        setSaving(true)
        try {
            const { error } = await supabase.from('alertas_retorno').insert([form])
            if (error) {
                console.error('Erro ao salvar alerta de retorno:', error)
                alert('Erro ao criar alerta: ' + (error.message || 'Verifique os dados.'))
                setSaving(false)
                return
            }
            alert('Alerta de retorno criado com sucesso!')
            setSaving(false); setModal(false)
            setForm({ paciente_id: '', dentista_id: '', motivo: '', data_alerta: format(addDays(new Date(), 30), 'yyyy-MM-dd'), observacoes: '' })
            setPacSearch('')
            load()
        } catch (err) {
            console.error('Erro crítico no alerta de retorno:', err)
            alert('Erro inesperado ao salvar.')
            setSaving(false)
        }
    }

    async function marcarContatado(id) {
        await supabase.from('alertas_retorno').update({ status: 'contatado' }).eq('id', id)
        load()
    }

    const isVencido = (data) => new Date(data + 'T00:00:00') < new Date()
    const isHoje = (data) => data === format(new Date(), 'yyyy-MM-dd')

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Alerta de Retorno</h1>
                    <div className="page-subtitle">Monitore pacientes que precisam retornar</div>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(true)}>
                    <i className="fa-solid fa-plus" /> Novo Alerta
                </button>
            </div>

            <div className="tabs">
                {[
                    { k: 'pendente', l: 'Pendentes', icon: 'fa-clock' },
                    { k: 'contatado', l: 'Contatados', icon: 'fa-check' },
                    { k: 'cancelado', l: 'Cancelados', icon: 'fa-xmark' },
                ].map(t => (
                    <div key={t.k} className={`tab${tabAtiva === t.k ? ' active' : ''}`} onClick={() => setTabAtiva(t.k)}>
                        <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }} />{t.l}
                    </div>
                ))}
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                alertas.length === 0 ? (
                    <div className="card"><div className="empty-state">
                        <div className="empty-state-icon"><i className="fa-solid fa-bell" /></div>
                        <h3>Nenhum alerta {tabAtiva}</h3>
                    </div></div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Paciente</th><th>Telefone</th><th>Dentista</th><th>Motivo</th><th>Data Alerta</th><th>Status</th><th>Ações</th></tr></thead>
                            <tbody>
                                {alertas.map(a => (
                                    <tr key={a.id}>
                                        <td><strong>{a.patients?.name || '—'}</strong></td>
                                        <td>{a.patients?.phone || '—'}</td>
                                        <td>{a.dentistas?.nome || '—'}</td>
                                        <td>{a.motivo || '—'}</td>
                                        <td>
                                            <span style={{ color: isVencido(a.data_alerta) && a.status === 'pendente' ? 'var(--danger)' : isHoje(a.data_alerta) ? 'var(--warning)' : 'inherit', fontWeight: isVencido(a.data_alerta) || isHoje(a.data_alerta) ? 700 : 400 }}>
                                                {format(new Date(a.data_alerta + 'T00:00:00'), 'dd/MM/yyyy')}
                                                {isHoje(a.data_alerta) && <span className="badge badge-warning" style={{ marginLeft: 6 }}>Hoje!</span>}
                                                {isVencido(a.data_alerta) && a.status === 'pendente' && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Vencido</span>}
                                            </span>
                                        </td>
                                        <td><span className={`badge ${a.status === 'pendente' ? 'badge-warning' : a.status === 'contatado' ? 'badge-success' : 'badge-gray'}`}>{a.status}</span></td>
                                        <td>
                                            {a.status === 'pendente' && (
                                                <button className="btn btn-success btn-sm" onClick={() => marcarContatado(a.id)}>
                                                    <i className="fa-solid fa-check" /> Contatado
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {modal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title"><i className="fa-solid fa-bell" style={{ marginRight: 8, color: 'var(--primary)' }} />Novo Alerta de Retorno</div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Paciente *</label>
                                <input className="form-control" placeholder="Buscar paciente..." value={pacSearch} onChange={e => { setPacSearch(e.target.value); searchPacientes(e.target.value) }} />
                                {pacSearch && pacientes.length > 0 && !form.paciente_id && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'white', marginTop: 4, maxHeight: 150, overflowY: 'auto' }}>
                                        {pacientes.map(p => (
                                            <div key={p.id} onClick={() => { setForm(f => ({ ...f, paciente_id: p.id })); setPacSearch(p.name) }}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-light)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                            >
                                                <strong>{p.name}</strong> — {p.phone || 'sem telefone'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {form.paciente_id && <div style={{ marginTop: 4, fontSize: 12, color: 'var(--success)' }}><i className="fa-solid fa-check-circle" /> Selecionado <button type="button" style={{ marginLeft: 8, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }} onClick={() => { setForm(f => ({ ...f, paciente_id: '' })); setPacSearch('') }}>Trocar</button></div>}
                            </div>
                            <div className="form-grid form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Data do Alerta *</label>
                                    <input type="date" className="form-control" value={form.data_alerta} onChange={e => setForm(p => ({ ...p, data_alerta: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Dentista</label>
                                    <select className="form-control" value={form.dentista_id} onChange={e => setForm(p => ({ ...p, dentista_id: e.target.value }))}>
                                        <option value="">Selecionar...</option>
                                        {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Motivo</label>
                                    <input className="form-control" placeholder="Ex: Revisão semestral, continuidade do tratamento..." value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : <><i className="fa-solid fa-check" /> Salvar</>}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
