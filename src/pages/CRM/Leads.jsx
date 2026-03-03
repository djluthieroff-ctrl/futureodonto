import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useToast } from '../../components/ui/Toast'

export default function Leads() {
    const toast = useToast()
    const [leadsOnline, setLeadsOnline] = useState([])
    const [leadsRedes, setLeadsRedes] = useState([])
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState('')
    const [modalNovoLead, setModalNovoLead] = useState(false)
    const [novoLead, setNovoLead] = useState({ name: '', phone: '', email: '', source: 'Manual', type: 'rede_social' })
    const [saving, setSaving] = useState(false)
    const [modalImport, setModalImport] = useState(false)
    const [importJson, setImportJson] = useState('')
    const [sortOrder, setSortOrder] = useState('created_desc')

    const loadLeads = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            setLeadsOnline((data || []).filter(l => l.type === 'agendamento_online'))
            setLeadsRedes((data || []).filter(l => l.type !== 'agendamento_online'))
        } catch (e) {
            console.error('Erro ao carregar leads:', e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadLeads()
    }, [loadLeads])

    const handleCreateLead = async () => {
        if (!novoLead.name) return toast.warning('Nome é obrigatório')
        setSaving(true)
        try {
            const { error } = await supabase.from('leads').insert([novoLead])
            if (error) throw error
            setModalNovoLead(false)
            setNovoLead({ name: '', phone: '', email: '', source: 'Manual', type: 'rede_social' })
            loadLeads()
            toast.success('Lead criado com sucesso!')
        } catch (e) {
            console.error('Erro ao criar lead:', e)
            toast.error('Erro ao criar lead: ' + (e.message || ''))
        } finally {
            setSaving(false)
        }
    }

    const handleImportJson = async () => {
        try {
            const data = JSON.parse(importJson)
            if (!Array.isArray(data)) throw new Error('O conteúdo deve ser um array de leads')

            setSaving(true)

            // Mapear campos do projeto antigo para o novo
            const mappedLeads = data.map(l => {
                let etapa = 'lead'
                if (l.status === 'scheduled') etapa = 'consulta_agendada'
                if (l.status === 'visit') etapa = 'atendido'

                return {
                    name: l.name || 'Sem nome',
                    phone: l.phone || '',
                    email: l.email || '',
                    source: l.source || l.channel || 'Importado',
                    type: l.status === 'scheduled' ? 'agendamento_online' : 'rede_social',
                    etapa: etapa,
                    message: l.message || '',
                    created_at: l.createdAt || new Date().toISOString(),
                    data_desejada: l.visitDate || l.scheduledAt || null
                }
            })

            // Inserir em lotes de 50 para evitar limites
            for (let i = 0; i < mappedLeads.length; i += 50) {
                const batch = mappedLeads.slice(i, i + 50)
                const { error } = await supabase.from('leads').insert(batch)
                if (error) throw error
            }

            toast.success(`${mappedLeads.length} leads importados com sucesso!`)
            setModalImport(false)
            setImportJson('')
            loadLeads()
        } catch (e) {
            console.error('Erro na importação:', e)
            toast.error('Erro ao importar JSON: ' + e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteLead = async (id) => {
        if (!confirm('Deseja excluir este lead permanentemente?')) return
        try {
            const { error } = await supabase.from('leads').delete().eq('id', id)
            if (error) throw error
            loadLeads()
            toast.success('Lead excluído!')
        } catch (e) {
            console.error('Erro ao excluir lead:', e)
            toast.error('Erro ao excluir lead')
        }
    }

    const updateLeadStatus = async (id, newEtapa) => {
        try {
            const { error } = await supabase
                .from('leads')
                .update({ etapa: newEtapa })
                .eq('id', id)

            if (error) {
                if (error.code === 'PGRST204' || error.message?.includes('column "etapa" does not exist')) {
                    await supabase.from('leads').update({ status: newEtapa }).eq('id', id)
                } else {
                    throw error
                }
            }
            loadLeads()
            setStatus('Status atualizado!')
            setTimeout(() => setStatus(''), 3000)
        } catch (e) {
            console.error('Erro ao atualizar lead:', e)
        }
    }

    const converterEmPaciente = async (lead) => {
        try {
            const patientPayload = {
                name: lead.name,
                phone: lead.phone || null,
                email: lead.email || null,
                source: lead.source || lead.type
            }

            let { data: newPatient, error: pError } = await supabase
                .from('patients')
                .insert([patientPayload])
                .select()
                .single()

            if (pError) {
                if (pError.message?.includes('source') && (pError.message?.includes('column') || pError.message?.includes('schema cache'))) {
                    delete patientPayload.source
                    const { data: retryData, error: retryError } = await supabase
                        .from('patients')
                        .insert([patientPayload])
                        .select()
                        .single()
                    if (retryError) throw retryError
                    newPatient = retryData
                } else {
                    throw pError
                }
            }

            await supabase.from('leads').update({
                etapa: 'consulta_agendada',
                convertido_em_paciente: true,
                paciente_id: newPatient.id
            }).eq('id', lead.id)

            loadLeads()
            toast.success('Lead convertido em paciente com sucesso!')
        } catch (e) {
            console.error('Erro ao converter lead:', e)
            toast.error('Erro ao converter lead: ' + (e.message || ''))
        }
    }

    const sortLeadsByName = useCallback((leads, order) => {
        if (order === 'created_desc') return leads
        const direction = order === 'name_desc' ? -1 : 1
        return [...leads].sort((a, b) => {
            const nameA = (a?.name || '').toLowerCase()
            const nameB = (b?.name || '').toLowerCase()
            return nameA.localeCompare(nameB, 'pt-BR') * direction
        })
    }, [])

    const sortedLeadsOnline = useMemo(
        () => sortLeadsByName(leadsOnline, sortOrder),
        [leadsOnline, sortLeadsByName, sortOrder]
    )

    const sortedLeadsRedes = useMemo(
        () => sortLeadsByName(leadsRedes, sortOrder),
        [leadsRedes, sortLeadsByName, sortOrder]
    )

    const LeadTable = ({ leads, title, isOnline }) => (
        <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
                <div>
                    <div className="card-title">{title}</div>
                    <div className="card-subtitle">{leads.length} leads encontrados</div>
                </div>
            </div>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Nome</th>
                            <th>Contato</th>
                            {isOnline && <th>Data Desejada</th>}
                            {!isOnline && <th>Origem</th>}
                            <th>Etapa</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20 }}>Nenhum lead encontrado</td></tr>
                        ) : (
                            leads.map(lead => {
                                let formattedDate = '-'
                                try {
                                    if (lead.created_at) formattedDate = format(new Date(lead.created_at), 'dd/MM/yyyy')
                                } catch (e) {
                                    console.error('Erro ao formatar data do lead:', e)
                                }

                                let formattedDataDesejada = '-'
                                try {
                                    if (lead.data_desejada) formattedDataDesejada = format(new Date(lead.data_desejada), 'dd/MM/yyyy')
                                } catch (e) {
                                    console.error('Erro ao formatar data desejada:', e)
                                }

                                return (
                                    <tr key={lead.id}>
                                        <td>{formattedDate}</td>
                                        <td><strong>{lead.name}</strong></td>
                                        <td>
                                            <div style={{ fontSize: 12 }}>{lead.phone}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.email}</div>
                                        </td>
                                        {isOnline && <td>{formattedDataDesejada}</td>}
                                        {!isOnline && <td><span className="badge badge-outline">{lead.source}</span></td>}
                                        <td>
                                            <select
                                                className="form-control form-control-sm"
                                                value={lead.etapa}
                                                onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                                                style={{ width: 'auto' }}
                                            >
                                                <option value="lead">Novo Lead</option>
                                                <option value="consulta_agendada">Consulta Agendada</option>
                                                <option value="atendido">Atendido</option>
                                                <option value="faltou_desmarcou">Faltou/Desmarcou</option>
                                                <option value="orcamento_perdido">Perdido</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {!lead.convertido_em_paciente && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => converterEmPaciente(lead)}
                                                        title="Converter em paciente"
                                                    >
                                                        <i className="fa-solid fa-user-plus" />
                                                    </button>
                                                )}
                                                <button className="btn btn-sm btn-outline" title="Ver mensagem">
                                                    <i className="fa-solid fa-envelope" />
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteLead(lead.id)}
                                                    title="Remover Lead"
                                                >
                                                    <i className="fa-solid fa-trash" /> Remover
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    return (
        <div className="leads-container">
            <div className="page-header">
                <h1 className="page-title">Gestão de Leads</h1>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={() => setModalImport(true)} style={{ marginRight: 8 }}>
                        <i className="fa-solid fa-file-import" /> Importar JSON
                    </button>
                    <button className="btn btn-primary" onClick={() => setModalNovoLead(true)} style={{ marginRight: 8 }}>
                        <i className="fa-solid fa-plus" /> Novo Lead
                    </button>
                    <button className="btn btn-secondary" onClick={loadLeads}>
                        <i className="fa-solid fa-rotate" /> Atualizar
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ padding: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0, maxWidth: 260 }}>
                        <label className="form-label">Ordenacao</label>
                        <select className="form-control" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                            <option value="created_desc">Mais recentes</option>
                            <option value="name_asc">Nome (A-Z)</option>
                            <option value="name_desc">Nome (Z-A)</option>
                        </select>
                    </div>
                </div>
            </div>

            {status && <div className="alert alert-success">{status}</div>}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : (
                <>
                    <LeadTable leads={sortedLeadsOnline} title="Seção 1: Agendamentos Online" isOnline={true} />
                    <LeadTable leads={sortedLeadsRedes} title="Seção 2: Leads de Redes Sociais" isOnline={false} />
                </>
            )}

            {modalNovoLead && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovoLead(false)}>
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <div className="modal-title">Novo Lead</div>
                            <button className="modal-close" onClick={() => setModalNovoLead(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nome *</label>
                                <input className="form-control" value={novoLead.name} onChange={e => setNovoLead(p => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-control" value={novoLead.phone} onChange={e => setNovoLead(p => ({ ...p, phone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">E-mail</label>
                                <input className="form-control" value={novoLead.email} onChange={e => setNovoLead(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Origem</label>
                                <select className="form-control" value={novoLead.source} onChange={e => setNovoLead(p => ({ ...p, source: e.target.value }))}>
                                    <option value="Manual">Manual</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Facebook">Facebook</option>
                                    <option value="Google">Google</option>
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalNovoLead(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleCreateLead} disabled={saving}>{saving ? 'Salvando...' : 'Criar Lead'}</button>
                        </div>
                    </div>
                </div>
            )}

            {modalImport && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalImport(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title">Importar Leads do Projeto Antigo</div>
                            <button className="modal-close" onClick={() => setModalImport(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 13, marginBottom: 12 }}>
                                Vi no seu print que o sistema antigo está sincronizado com a nuvem. Use este comando que é garantido:<br />
                                1. Abra seu <strong>projeto antigo</strong> no navegador.<br />
                                2. Aperte <strong>F12</strong> e vá na aba <strong>Console</strong>.<br />
                                3. Cole o comando abaixo e aperte Enter:<br />
                                <code style={{ display: 'block', background: '#f1f5f9', padding: 8, marginTop: 4, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {"copy(JSON.stringify(AppState.leads))"}
                                </code>
                                4. Se o comando acima der erro, tente este (pega direto do banco):<br />
                                <code style={{ display: 'block', background: '#f1f5f9', padding: 8, marginTop: 4, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {"copy(JSON.stringify(await supabaseClient.from('leads').select('*').then(r => r.data)))"}
                                </code>
                                5. Volte aqui e cole o conteúdo abaixo.
                            </p>
                            <div className="form-group">
                                <label className="form-label">Cole o JSON aqui</label>
                                <textarea
                                    className="form-control"
                                    rows={10}
                                    value={importJson}
                                    onChange={e => setImportJson(e.target.value)}
                                    placeholder='[...] '
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalImport(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleImportJson} disabled={saving || !importJson}>
                                {saving ? 'Importando...' : 'Iniciar Importação'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
