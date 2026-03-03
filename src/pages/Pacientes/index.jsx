import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { exportToCSV } from '../../utils/export'
import { useToast } from '../../components/ui/Toast'

export default function Pacientes() {
    const navigate = useNavigate()
    const toast = useToast()
    const [pacientes, setPacientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ name: '', phone: '', email: '', cpf: '', birth_date: '', gender: '', city: '', status: 'ativo', notes: '' })
    const [saving, setSaving] = useState(false)
    const [totalCount, setTotalCount] = useState(0)

    const loadPacientes = useCallback(async () => {
        setLoading(true)
        let q = supabase.from('patients').select('id,name,phone,email,city,status,birth_date,created_at', { count: 'exact' })
        if (search) {
            q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        }
        const { data, count, error } = await q.order('name')
        if (error) {
            console.error('Erro ao carregar pacientes:', error)
            toast.error('Erro ao carregar pacientes: ' + (error.message || 'Verifique a conexão.'))
        }
        setPacientes(data || [])
        setTotalCount(count || 0)
        setLoading(false)
    }, [search])

    useEffect(() => {
        const timer = setTimeout(() => { loadPacientes() }, 0)
        return () => clearTimeout(timer)
    }, [loadPacientes])

    useEffect(() => {
        const handlePatientAdded = () => {
            loadPacientes()
        }
        window.addEventListener('patient-added', handlePatientAdded)
        return () => window.removeEventListener('patient-added', handlePatientAdded)
    }, [loadPacientes])

    async function handleSave() {
        if (!form.name) { toast.warning('Nome é obrigatório.'); return }
        setSaving(true)

        try {
            const dataToSave = {
                ...form,
                birth_date: form.birth_date || null,
                last_contact: new Date().toISOString()
            }

            const { error } = await supabase.from('patients').insert([dataToSave])

            if (error) {
                console.error('Erro ao salvar paciente:', error)
                if (error.code === '23505') {
                    toast.error('Já existe um paciente cadastrado com este telefone.')
                } else {
                    toast.error('Erro ao cadastrar paciente: ' + (error.message || 'Verifique os dados e tente novamente.'))
                }
                setSaving(false)
                return
            }

            setSaving(false)
            setModal(false)
            setForm({ name: '', phone: '', email: '', cpf: '', birth_date: '', gender: '', city: '', status: 'ativo', notes: '' })
            loadPacientes()
            toast.success('Paciente cadastrado com sucesso!')
        } catch (err) {
            console.error('Erro crítico:', err)
            toast.error('Ocorreu um erro inesperado ao tentar salvar.')
            setSaving(false)
        }
    }

    const getInitials = (name) => name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
    const getStatusBadge = (s) => {
        if (s === 'ativo') return <span className="badge badge-success">Ativo</span>
        if (s === 'inativo') return <span className="badge badge-gray">Inativo</span>
        return <span className="badge badge-warning">{s}</span>
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pacientes</h1>
                    <div className="page-subtitle">{totalCount} pacientes cadastrados</div>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-novo-paciente">
                    <i className="fa-solid fa-user-plus" /> Novo Paciente
                </button>
            </div>

            {/* Toolbar */}
            <div className="page-toolbar">
                <div className="search-bar">
                    <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }} />
                    <input placeholder="Buscar por nome, telefone..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button className="btn btn-secondary btn-sm">
                    <i className="fa-solid fa-filter" /> Filtros
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(pacientes, 'pacientes.csv')}>
                    <i className="fa-solid fa-file-excel" /> Exportar Excel
                </button>
            </div>

            {/* Tabela */}
            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : pacientes.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><i className="fa-solid fa-users" /></div>
                        <h3>Nenhum paciente cadastrado</h3>
                        <p>Clique em "Novo Paciente" para começar</p>
                    </div>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Telefone</th>
                                <th>E-mail</th>
                                <th>Cidade</th>
                                <th>Situação</th>
                                <th>Cadastrado em</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {pacientes.map(p => (
                                <tr key={p.id} onClick={() => navigate(`/pacientes/${p.id}`)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div className="avatar">{getInitials(p.name)}</div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                {p.birth_date && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{format(new Date(p.birth_date + 'T00:00:00'), 'dd/MM/yyyy')}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td>{p.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td>{p.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td>{p.city || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td>{getStatusBadge(p.status)}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{format(new Date(p.created_at), 'dd/MM/yyyy')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm btn-icon" onClick={e => { e.stopPropagation(); navigate(`/pacientes/${p.id}`) }} title="Editar">
                                                <i className="fa-solid fa-pen" />
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm btn-icon"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Deseja realmente excluir o paciente ${p.name}?`)) {
                                                        try {
                                                            const { error } = await supabase.from('patients').delete().eq('id', p.id);
                                                            if (error) throw error;
                                                            loadPacientes();
                                                            toast.success('Paciente excluído com sucesso!');
                                                        } catch (err) {
                                                            console.error('Erro ao excluir paciente:', err);
                                                            toast.error('Erro ao excluir paciente: ' + (err.message || 'Erro desconhecido'));
                                                        }
                                                    }
                                                }}
                                                title="Excluir"
                                            >
                                                <i className="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal Novo Paciente */}
            {modal && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                    <div className="modal modal-lg">
                        <div className="modal-header">
                            <div className="modal-title">
                                <i className="fa-solid fa-user-plus" style={{ marginRight: 8, color: 'var(--primary)' }} />
                                Novo Paciente
                            </div>
                            <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Nome completo *</label>
                                    <input className="form-control" placeholder="Nome do paciente" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Telefone / WhatsApp</label>
                                    <input className="form-control" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">E-mail</label>
                                    <input type="email" className="form-control" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CPF</label>
                                    <input className="form-control" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data de nascimento</label>
                                    <input type="date" className="form-control" value={form.birth_date} onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sexo</label>
                                    <select className="form-control" value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                                        <option value="">Selecionar...</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Feminino</option>
                                        <option value="O">Outro</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cidade</label>
                                    <input className="form-control" placeholder="Cidade" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-control" placeholder="Informações adicionais sobre o paciente..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Salvando...' : <><i className="fa-solid fa-check" /> Cadastrar Paciente</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
