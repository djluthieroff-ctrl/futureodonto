import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

export default function ListaEspera() {
    const [lista, setLista] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [pacientes, setPacientes] = useState([])
    const [dentistas, setDentistas] = useState([])
    const [form, setForm] = useState({ paciente_id: '', dentista_id: '', prioridade: 'normal', observacoes: '' })
    const [pacSearch, setPacSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('lista_espera')
            .select('*,patients(name,phone),dentistas(nome)')
            .eq('status', 'pendente')
            .order('prioridade', { ascending: false })
            .order('criado_em')
        setLista(data || [])
        setLoading(false)
    }, [])

    const loadConfigs = useCallback(async () => {
        const { data } = await supabase.from('dentistas').select('id,nome').eq('ativo', true)
        setDentistas(data || [])
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => {
            load()
            loadConfigs()
        }, 0)
        return () => clearTimeout(timer)
    }, [load, loadConfigs])

    async function searchPacientes(q) {
        if (q.length < 2) return
        const { data } = await supabase.from('patients').select('id,name,phone').ilike('name', `%${q}%`).limit(8)
        setPacientes(data || [])
    }

    async function handleSave() {
        if (!form.paciente_id) { alert('Selecione um paciente'); return }
        setSaving(true)
        try {
            const { error } = await supabase.from('lista_espera').insert([form])
            if (error) {
                console.error('Erro ao salvar lista de espera:', error)
                alert('Erro ao adicionar à lista: ' + (error.message || 'Verifique os dados.'))
                setSaving(false)
                return
            }
            alert('Paciente adicionado à lista de espera!')
            setSaving(false); setModal(false)
            setForm({ paciente_id: '', dentista_id: '', prioridade: 'normal', observacoes: '' })
            setPacSearch('')
            load()
        } catch (err) {
            console.error('Erro crítico na lista de espera:', err)
            alert('Erro inesperado ao salvar.')
            setSaving(false)
        }
    }

    async function remover(id) {
        if (!confirm('Deseja remover este paciente da lista?')) return
        await supabase.from('lista_espera').update({ status: 'removido' }).eq('id', id)
        load()
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Lista de Espera</h1>
                    <div className="page-subtitle">Pacientes aguardando vaga ou desistência</div>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(true)}>
                    <i className="fa-solid fa-plus" /> Adicionar à Lista
                </button>
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                lista.length === 0 ? (
                    <div className="card"><div className="empty-state">
                        <div className="empty-state-icon"><i className="fa-solid fa-clock" /></div>
                        <h3>Lista vazia</h3>
                        <p>Não há pacientes aguardando agendamento</p>
                    </div></div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Entrada</th><th>Paciente</th><th>Telefone</th><th>Dentista Preferencial</th><th>Prioridade</th><th>Observações</th><th>Ações</th></tr></thead>
                            <tbody>
                                {lista.map(item => (
                                    <tr key={item.id}>
                                        <td>{format(new Date(item.criado_em), 'dd/MM/yyyy')}</td>
                                        <td><strong>{item.patients?.name || '—'}</strong></td>
                                        <td>{item.patients?.phone || '—'}</td>
                                        <td>{item.dentistas?.nome || 'Qualquer'}</td>
                                        <td>
                                            <span className={`badge ${item.prioridade === 'urgente' ? 'badge-danger' : item.prioridade === 'alta' ? 'badge-warning' : 'badge-info'}`}>
                                                {item.prioridade}
                                            </span>
                                        </td>
                                        <td>{item.observacoes || '—'}</td>
                                        <td>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => remover(item.id)} title="Remover da lista">
                                                <i className="fa-solid fa-trash" />
                                            </button>
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
                            <div className="modal-title"><i className="fa-solid fa-users-clock" style={{ marginRight: 8, color: 'var(--primary)' }} />Adicionar à Lista de Espera</div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Paciente *</label>
                                <input className="form-control" placeholder="Buscar paciente..." value={pacSearch} onChange={e => { setPacSearch(e.target.value); searchPacientes(e.target.value) }} />
                                {pacSearch && pacientes.length > 0 && !form.paciente_id && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'white', marginTop: 4, maxHeight: 150, overflowY: 'auto', zIndex: 10 }}>
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
                                    <label className="form-label">Prioridade</label>
                                    <select className="form-control" value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value }))}>
                                        <option value="baixa">Baixa</option>
                                        <option value="normal">Normal</option>
                                        <option value="alta">Alta</option>
                                        <option value="urgente">Urgente</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Dentista Preferencial</label>
                                    <select className="form-control" value={form.dentista_id} onChange={e => setForm(p => ({ ...p, dentista_id: e.target.value }))}>
                                        <option value="">Qualquer dentista</option>
                                        {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Observações / Preferência de Horário</label>
                                    <textarea className="form-control" rows={3} placeholder="Ex: Apenas no período da manhã, prefere quintas-feiras..." value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : <><i className="fa-solid fa-check" /> Adicionar</>}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
