import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { exportToCSV } from '../../utils/export'
import { useToast } from '../../components/ui/Toast'
import { registrarAuditoria } from '../../lib/auditoria'

export default function Pacientes() {
    const navigate = useNavigate()
    const toast = useToast()
    const [pacientes, setPacientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [totalCount, setTotalCount] = useState(0)
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ name: '', phone: '', email: '', cpf: '', birth_date: '', gender: '', city: '', status: 'ativo', notes: '', is_ortodontia: false, is_protese: false, is_clinico: true })
    const [showFilters, setShowFilters] = useState(false)
    const [activeTab, setActiveTab] = useState('todos')
    const [filterType, setFilterType] = useState('todos') // todos, ortodontia, protese, clinico

    const loadPacientes = useCallback(async () => {
        setLoading(true)
        const isLeadView = search === 'status:leads'
        let q = supabase.from('patients').select('id,name,phone,email,city,status,birth_date,created_at,is_ortodontia,is_active_patient', { count: 'exact' })
        if (search && !isLeadView) {
            q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        }

        if (activeTab === 'ortodontia' || activeTab === 'manutencao' || filterType === 'ortodontia') {
            q = q.eq('is_ortodontia', true)
        }
        if (filterType === 'protese') {
            q = q.eq('is_protese', true)
        }
        if (filterType === 'clinico') {
            q = q.eq('is_clinico', true)
        }

        // Filtro padrão: apenas pacientes ativos (tratamento fechado)
        // Se estiver buscando ou filtrando especificamente, talvez queira ver todos, 
        // mas o pedido foi que eles "só devem vir para cá depois de fechar"
        if (isLeadView) {
            q = q.eq('is_active_patient', false)
        } else if (!search && filterType === 'todos') {
            q = q.eq('is_active_patient', true)
        }

        const { data, count, error } = await q.order('name')
        if (error) {
            console.error('Erro ao carregar pacientes:', error)
            toast.error('Erro ao carregar pacientes: ' + (error.message || 'Verifique a conexão.'))
        }

        setPacientes(data || [])
        setTotalCount(count || 0)
        setLoading(false)
    }, [search, activeTab, filterType, toast])

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
            setForm({ name: '', phone: '', email: '', cpf: '', birth_date: '', gender: '', city: '', status: 'ativo', notes: '', is_ortodontia: false, is_protese: false, is_clinico: true })
            loadPacientes()
            toast.success('Paciente cadastrado com sucesso!')
            await registrarAuditoria({
                modulo: 'Pacientes',
                acao: 'Paciente cadastrado',
                detalhes: `Paciente: ${dataToSave.name}`,
            })
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
                    <div className="page-subtitle">{totalCount} pacientes com tratamento fechado</div>
                </div>
                <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-novo-paciente">
                    <i className="fa-solid fa-user-plus" /> Novo Paciente
                </button>
            </div>

            {/* Tabs de Submenu */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
                <button
                    onClick={() => setActiveTab('todos')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'todos' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'todos' ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: activeTab === 'todos' ? 600 : 400,
                        fontSize: 14
                    }}
                >
                    Todos os Pacientes
                </button>
                <button
                    onClick={() => setActiveTab('ortodontia')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'ortodontia' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'ortodontia' ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: activeTab === 'ortodontia' ? 600 : 400,
                        fontSize: 14
                    }}
                >
                    Ortodontia
                </button>
                <button
                    onClick={() => setActiveTab('manutencao')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        color: activeTab === 'manutencao' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'manutencao' ? '2px solid var(--primary)' : '2px solid transparent',
                        fontWeight: activeTab === 'manutencao' ? 600 : 400,
                        fontSize: 14
                    }}
                >
                    Manutenção do Mês
                </button>
            </div>
            <div className="page-toolbar">
                <div className="search-bar">
                    <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)' }} />
                    <input placeholder="Buscar por nome, telefone..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ position: 'relative' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>
                        <i className="fa-solid fa-filter" /> Filtros {filterType !== 'todos' && `(${filterType})`}
                    </button>
                    {showFilters && (
                        <div className="card" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 10, width: 220, marginTop: 8, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tipo de Tratamento</div>
                            <button className="btn btn-clean w-100" style={{ justifyContent: 'flex-start', fontSize: 13, background: filterType === 'todos' ? 'var(--bg-light)' : 'transparent' }} onClick={() => { setFilterType('todos'); setShowFilters(false) }}>Todos</button>
                            <button className="btn btn-clean w-100" style={{ justifyContent: 'flex-start', fontSize: 13, background: filterType === 'clinico' ? 'var(--bg-light)' : 'transparent' }} onClick={() => { setFilterType('clinico'); setShowFilters(false) }}>Clínico</button>
                            <button className="btn btn-clean w-100" style={{ justifyContent: 'flex-start', fontSize: 13, background: filterType === 'ortodontia' ? 'var(--bg-light)' : 'transparent' }} onClick={() => { setFilterType('ortodontia'); setShowFilters(false) }}>Ortodontia</button>
                            <button className="btn btn-clean w-100" style={{ justifyContent: 'flex-start', fontSize: 13, background: filterType === 'protese' ? 'var(--bg-light)' : 'transparent' }} onClick={() => { setFilterType('protese'); setShowFilters(false) }}>Prótese Parcial</button>
                            <div style={{ height: 1, background: 'var(--border-light)', margin: '8px 0' }} />
                            <button className="btn btn-clean w-100" style={{ justifyContent: 'flex-start', fontSize: 13 }} onClick={() => { setFilterType('todos'); setSearch('status:leads'); setShowFilters(false) }}>Ver Leads (Não Ativados)</button>
                            <button className="btn btn-link btn-sm w-100" onClick={() => { setFilterType('todos'); setSearch(''); setShowFilters(false) }}>Limpar Filtros</button>
                        </div>
                    )}
                </div>
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
                                <th>Tipo</th>
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
                                    <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {p.is_clinico && <span className="badge badge-outline" style={{ fontSize: 10 }}>Clínico</span>}
                                            {p.is_ortodontia && <span className="badge" style={{ fontSize: 10, background: '#7C3AED', color: '#fff' }}>Ortodontia</span>}
                                            {p.is_protese && <span className="badge" style={{ fontSize: 10, background: '#F59E0B', color: '#fff' }}>Prótese</span>}
                                            {!p.is_clinico && !p.is_ortodontia && !p.is_protese && <span className="badge badge-gray" style={{ fontSize: 10 }}>Não Def.</span>}
                                        </div>
                                    </td>
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
                                                            await registrarAuditoria({
                                                                modulo: 'Pacientes',
                                                                acao: 'Paciente excluído',
                                                                detalhes: `Paciente: ${p.name}`,
                                                            })
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
                                    <label className="form-label" style={{ marginBottom: 12 }}>Tipos de Tratamento</label>
                                    <div style={{ display: 'flex', gap: 20 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.is_clinico} onChange={e => setForm(p => ({ ...p, is_clinico: e.target.checked }))} />
                                            <span style={{ fontSize: 14 }}>Clínico</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.is_ortodontia} onChange={e => setForm(p => ({ ...p, is_ortodontia: e.target.checked }))} />
                                            <span style={{ fontSize: 14 }}>Ortodontia</span>
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.is_protese} onChange={e => setForm(p => ({ ...p, is_protese: e.target.checked }))} />
                                            <span style={{ fontSize: 14 }}>Prótese Parcial</span>
                                        </label>
                                    </div>
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
