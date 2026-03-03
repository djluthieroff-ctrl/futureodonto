import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { format } from 'date-fns'

export default function Ferramentas() {
    const location = useLocation()
    const sub = location.pathname.split('/ferramentas/')[1] || 'estoque'
    const navigate = useNavigate()

    const subtabs = [
        { key: 'estoque', label: 'Estoque', icon: 'fa-boxes-stacked' },
        { key: 'proteticos', label: 'Serviços Protéticos', icon: 'fa-tooth' },
        { key: 'contatos', label: 'Contatos', icon: 'fa-address-book' },
        { key: 'auditoria', label: 'Auditoria', icon: 'fa-list-check' },
    ]

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Ferramentas</h1>
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
                {subtabs.map(t => (
                    <div
                        key={t.key}
                        className={`tab${sub === t.key ? ' active' : ''}`}
                        onClick={() => navigate(`/ferramentas/${t.key}`)}
                    >
                        <i className={`fa-solid ${t.icon}`} style={{ marginRight: 6 }} />
                        {t.label}
                    </div>
                ))}
            </div>

            <Routes>
                <Route path="estoque" element={<Estoque />} />
                <Route path="proteticos" element={<Proteticos />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="auditoria" element={<Auditoria />} />
                <Route path="*" element={<Navigate to="estoque" replace />} />
            </Routes>
        </div>
    )
}

function Estoque() {
    const [itens, setItens] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ nome: '', categoria: '', quantidade: '', quantidade_minima: '', unidade: 'un', valor_unitario: '', fornecedor: '' })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase.from('estoque').select('*').order('nome')
        setItens(data || [])
        setLoading(false)
    }, [])
    useEffect(() => {
        const timer = setTimeout(() => { load() }, 0)
        return () => clearTimeout(timer)
    }, [load])
    async function handleSave() {
        if (!form.nome) { alert('Nome obrigatório'); return }
        setSaving(true)
        await supabase.from('estoque').insert({ ...form, quantidade: Number(form.quantidade) || 0, quantidade_minima: Number(form.quantidade_minima) || 0, valor_unitario: Number(form.valor_unitario) || 0 })
        setSaving(false); setModal(false)
        setForm({ nome: '', categoria: '', quantidade: '', quantidade_minima: '', unidade: 'un', valor_unitario: '', fornecedor: '' })
        load()
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{itens.length} itens no estoque</span>
                <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
                    <i className="fa-solid fa-plus" /> Novo Item
                </button>
            </div>
            {loading ? <div className="loading"><div className="spinner" /></div> : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Nome</th><th>Categoria</th><th>Qtd.</th><th>Qtd. Mínima</th><th>Unidade</th><th>Valor Unit.</th><th>Fornecedor</th><th>Status</th></tr></thead>
                        <tbody>
                            {itens.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty-state" style={{ padding: '30px 0' }}><div className="empty-state-icon"><i className="fa-solid fa-boxes-stacked" /></div><h3>Estoque vazio</h3></div></td></tr>
                            ) : itens.map(i => (
                                <tr key={i.id}>
                                    <td><strong>{i.nome}</strong></td>
                                    <td>{i.categoria || '—'}</td>
                                    <td><strong style={{ color: Number(i.quantidade) <= Number(i.quantidade_minima) ? 'var(--danger)' : 'var(--success)' }}>{i.quantidade}</strong></td>
                                    <td>{i.quantidade_minima}</td>
                                    <td>{i.unidade}</td>
                                    <td>R$ {Number(i.valor_unitario).toFixed(2)}</td>
                                    <td>{i.fornecedor || '—'}</td>
                                    <td>
                                        {Number(i.quantidade) <= Number(i.quantidade_minima)
                                            ? <span className="badge badge-danger">Baixo</span>
                                            : <span className="badge badge-success">OK</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title"><i className="fa-solid fa-boxes-stacked" style={{ marginRight: 8, color: 'var(--primary)' }} />Novo Item de Estoque</div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Nome *</label>
                                    <input className="form-control" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
                                </div>
                                <div className="form-group"><label className="form-label">Categoria</label><input className="form-control" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Unidade</label><select className="form-control" value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}><option value="un">un</option><option value="cx">caixa</option><option value="kg">kg</option><option value="ml">ml</option><option value="par">par</option></select></div>
                                <div className="form-group"><label className="form-label">Quantidade atual</label><input type="number" className="form-control" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Quantidade mínima</label><input type="number" className="form-control" value={form.quantidade_minima} onChange={e => setForm(p => ({ ...p, quantidade_minima: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Valor unitário</label><input type="number" className="form-control" value={form.valor_unitario} onChange={e => setForm(p => ({ ...p, valor_unitario: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Fornecedor</label><input className="form-control" value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} /></div>
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

function Proteticos() {
    const [itens, setItens] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('solicitados')
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ servico: '', protetico: '', data_entrega_prevista: '', valor: '', observacoes: '' })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const statusMap = { solicitados: 'solicitado', atrasados: 'atrasado', entregues: 'entregue' }
        let q = supabase.from('servicos_proteticos').select('*,patients(name),dentistas(nome)')
        if (statusMap[tab]) q = q.eq('status', statusMap[tab])
        const { data } = await q.order('data_solicitacao', { ascending: false })
        setItens(data || [])
        setLoading(false)
    }, [tab])
    useEffect(() => {
        const timer = setTimeout(() => { load() }, 0)
        return () => clearTimeout(timer)
    }, [load])
    async function handleSave() {
        if (!form.servico) { alert('Serviço obrigatório'); return }
        setSaving(true)
        await supabase.from('servicos_proteticos').insert({ ...form, valor: Number(form.valor) || 0 })
        setSaving(false); setModal(false)
        setForm({ servico: '', protetico: '', data_entrega_prevista: '', valor: '', observacoes: '' })
        load()
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 2 }}>
                    {['solicitados', 'atrasados', 'entregues'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                    ))}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
                    <i className="fa-solid fa-plus" /> Novo Serviço
                </button>
            </div>

            {loading ? <div className="loading"><div className="spinner" /></div> : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Solicitação</th><th>Serviço</th><th>Paciente</th><th>Protético</th><th>Dentista</th><th>Previsão de entrega</th><th>Ações</th></tr></thead>
                        <tbody>
                            {itens.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty-state" style={{ padding: '30px 0' }}><div className="empty-state-icon"><i className="fa-solid fa-tooth" /></div><h3>Nenhum item encontrado</h3></div></td></tr>
                            ) : itens.map(i => (
                                <tr key={i.id}>
                                    <td>{i.data_solicitacao ? format(new Date(i.data_solicitacao + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
                                    <td><strong>{i.servico}</strong></td>
                                    <td>{i.patients?.name || '—'}</td>
                                    <td>{i.protetico || '—'}</td>
                                    <td>{i.dentistas?.nome || '—'}</td>
                                    <td>{i.data_entrega_prevista ? format(new Date(i.data_entrega_prevista + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
                                    <td>
                                        <button className="btn btn-sm btn-secondary btn-icon"><i className="fa-solid fa-pen" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title"><i className="fa-solid fa-tooth" style={{ marginRight: 8, color: 'var(--primary)' }} />Novo Serviço Protético</div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Serviço *</label>
                                    <input className="form-control" placeholder="Ex: Prótese total, coroa, etc." value={form.servico} onChange={e => setForm(p => ({ ...p, servico: e.target.value }))} />
                                </div>
                                <div className="form-group"><label className="form-label">Protético</label><input className="form-control" value={form.protetico} onChange={e => setForm(p => ({ ...p, protetico: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Previsão de entrega</label><input type="date" className="form-control" value={form.data_entrega_prevista} onChange={e => setForm(p => ({ ...p, data_entrega_prevista: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Valor (R$)</label><input type="number" className="form-control" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Observações</label><textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} /></div>
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

function Contatos() {
    return (
        <div className="card">
            <div className="card-header"><div className="card-title">Contatos Úteis</div></div>
            <div className="table-wrapper">
                <table>
                    <thead><tr><th>Nome</th><th>Tipo</th><th>Telefone</th><th>E-mail</th></tr></thead>
                    <tbody>
                        <tr><td><strong>ProDental S.A.</strong></td><td>Fornecedor</td><td>(11) 99999-8888</td><td>vendas@prodental.com</td></tr>
                        <tr><td><strong>Lab Sorriso Gold</strong></td><td>Protético</td><td>(11) 98888-7777</td><td>lab@sorrisogold.com</td></tr>
                        <tr><td><strong>Dental Clean</strong></td><td>Higiene</td><td>0800 123 456</td><td>sac@dentalclean.com</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function Auditoria() {
    const logs = useMemo(() => ([
        { id: 1, data: '2026-03-02T09:00:00.000Z', usuario: 'Administrador', acao: 'Acesso ao sistema', modulo: 'Login' },
        { id: 2, data: '2026-03-02T08:00:00.000Z', usuario: 'Administrador', acao: 'Novo paciente cadastrado: João Silva', modulo: 'Pacientes' },
        { id: 3, data: '2026-03-02T07:00:00.000Z', usuario: 'Administrador', acao: 'Agendamento criado: Maria Oliveira', modulo: 'Agenda' },
        { id: 4, data: '2026-03-02T06:00:00.000Z', usuario: 'Administrador', acao: 'Receita confirmada R$ 500,00', modulo: 'Financeiro' },
    ]), [])

    return (
        <div className="card">
            <div className="card-header"><div className="card-title">Auditoria de Operações</div></div>
            <div className="table-wrapper">
                <table>
                    <thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th></tr></thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td style={{ fontSize: 12 }}>{format(new Date(log.data), 'dd/MM/yyyy HH:mm')}</td>
                                <td><strong>{log.usuario}</strong></td>
                                <td>{log.acao}</td>
                                <td><span className="badge badge-gray">{log.modulo}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
