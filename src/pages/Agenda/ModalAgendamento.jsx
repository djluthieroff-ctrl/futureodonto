import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useToast } from '../../components/ui/Toast'

export default function ModalAgendamento({ dataInicial, eventoExistente, dentistas, cadeiras, onClose }) {
    const isEdit = !!eventoExistente
    const toast = useToast()
    const formatForInput = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return ''
        const pad = (n) => n.toString().padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    const [form, setForm] = useState({
        paciente_id: '',
        dentista_id: dentistas[0]?.id || '',
        cadeira_id: cadeiras[0]?.id || '',
        data_inicio: formatForInput(dataInicial) || formatForInput(new Date()),
        data_fim: '',
        motivo: 'consulta',
        tipo: 'consulta',
        situacao: 'agendado',
        observacoes: '',
        valor: '',
    })
    const [pacientes, setPacientes] = useState([])
    const [leads, setLeads] = useState([])
    const [pacienteSearch, setPacienteSearch] = useState('')
    const [searchType, setSearchMode] = useState('paciente') // 'paciente' ou 'lead'
    const [showCreateLead, setShowCreateLead] = useState(false)
    const [newLead, setNewLead] = useState({ name: '', phone: '', email: '' })
    const [saving, setSaving] = useState(false)

    const searchData = useCallback(async (q) => {
        if (!q || q.trim().length < 2) {
            setPacientes([])
            setLeads([])
            return
        }

        try {
            if (searchType === 'paciente') {
                const { data, error } = await supabase
                    .from('patients')
                    .select('id,name,phone')
                    .ilike('name', `%${q}%`)
                    .limit(10)
                if (error) throw error
                setPacientes(data || [])
            } else {
                const { data, error } = await supabase
                    .from('leads')
                    .select('id,name,phone,email')
                    .eq('convertido_em_paciente', false)
                    .ilike('name', `%${q}%`)
                    .limit(10)
                if (error) throw error
                setLeads(data || [])
            }
        } catch (err) {
            console.error('Erro na busca do modal:', err)
            setPacientes([])
            setLeads([])
        }
    }, [searchType])

    useEffect(() => {
        if (isEdit) {
            const ev = eventoExistente
            setForm({
                paciente_id: ev.paciente_id || '',
                dentista_id: ev.dentista_id || '',
                cadeira_id: ev.cadeira_id || '',
                data_inicio: formatForInput(ev.data_inicio) || '',
                data_fim: formatForInput(ev.data_fim) || '',
                motivo: ev.motivo || 'consulta',
                tipo: ev.tipo || 'consulta',
                situacao: ev.situacao || 'agendado',
                observacoes: ev.observacoes || '',
                valor: ev.valor || '',
            })
            if (ev.patients?.name) setPacienteSearch(ev.patients.name)
        }
    }, [isEdit, eventoExistente])

    async function handleCreateLeadAndSelect() {
        if (!newLead.name) { toast.warning('Nome do lead é obrigatório.'); return }
        if (!form.data_inicio) { toast.warning('Informe a data e hora de início.'); return }
        if (!form.dentista_id) { toast.warning('Selecione um dentista.'); return }
        if (!form.cadeira_id) { toast.warning('Selecione uma cadeira.'); return }

        setSaving(true)
        try {
            // 1. Criar o Lead primeiro
            const leadPayload = {
                name: newLead.name,
                phone: newLead.phone || null,
                email: newLead.email || null,
                source: 'Cadastro Rápido Agenda',
                etapa: 'consulta_agendada'
            }

            let leadData;
            const { data: lData, error: leadError } = await supabase
                .from('leads')
                .insert([leadPayload])
                .select()
                .single()

            if (leadError) {
                // Tentar com 'status' se 'etapa' falhar (retrocompatibilidade)
                if (leadError.code === 'PGRST204' || leadError.message?.includes('column "etapa" does not exist')) {
                    const retryPayload = { ...leadPayload }
                    delete retryPayload.etapa
                    retryPayload.status = 'agendado'
                    const { data: retryData, error: retryError } = await supabase
                        .from('leads')
                        .insert([retryPayload])
                        .select()
                        .single()
                    if (retryError) throw retryError
                    leadData = retryData
                } else {
                    throw leadError
                }
            } else {
                leadData = lData
            }

            // 2. Converter o Lead em Paciente imediatamente
            const patientPayload = {
                name: newLead.name,
                phone: newLead.phone || null,
                email: newLead.email || null,
                source: 'Lead'
            }

            let patientData;
            const { data: pData, error: patientError } = await supabase
                .from('patients')
                .insert([patientPayload])
                .select()
                .single()

            if (patientError) {
                // Tentar sem 'source' se falhar (retrocompatibilidade)
                // Verificação ampla para capturar erros de cache de schema ou coluna inexistente
                if (patientError.message?.includes('source') && (patientError.message?.includes('column') || patientError.message?.includes('schema cache'))) {
                    const retryPatientPayload = { ...patientPayload }
                    delete retryPatientPayload.source
                    const { data: retryData, error: retryError } = await supabase
                        .from('patients')
                        .insert([retryPatientPayload])
                        .select()
                        .single()
                    if (retryError) throw retryError
                    patientData = retryData
                } else {
                    throw patientError
                }
            } else {
                patientData = pData
            }

            // 3. Atualizar o lead com o ID do paciente e marcar como convertido
            const updatePayload = {
                convertido_em_paciente: true,
                paciente_id: patientData.id,
                etapa: 'consulta_agendada'
            }

            const { error: updateError } = await supabase
                .from('leads')
                .update(updatePayload)
                .eq('id', leadData.id)

            if (updateError && (updateError.code === 'PGRST204' || updateError.message?.includes('column "etapa" does not exist'))) {
                const retryUpdatePayload = { ...updatePayload }
                delete retryUpdatePayload.etapa
                retryUpdatePayload.status = 'agendado'
                await supabase.from('leads').update(retryUpdatePayload).eq('id', leadData.id)
            }

            // 4. Criar o agendamento automaticamente
            const dataInicioIso = new Date(form.data_inicio).toISOString()
            const dataFimIso = form.data_fim ? new Date(form.data_fim).toISOString() : new Date(new Date(form.data_inicio).getTime() + 15 * 60000).toISOString()

            const { tipo, valor, ...restForm } = form
            const appointmentPayload = {
                ...restForm,
                paciente_id: patientData.id,
                data_inicio: dataInicioIso,
                data_fim: dataFimIso
            }

            const { error: appError } = await supabase.from('agendamentos').insert([appointmentPayload])

            if (appError) {
                console.error('Erro ao agendar:', appError)
                toast.error('Lead e Paciente criados, mas erro ao gerar agendamento: ' + appError.message)
                setForm(f => ({ ...f, paciente_id: patientData.id }))
                setPacienteSearch(patientData.name)
                setShowCreateLead(false)
                setSearchMode('paciente')
            } else {
                toast.success('Lead criado e agendamento realizado com sucesso!')
                onClose()
            }
        } catch (e) {
            console.error('Erro detalhado:', e)
            toast.error('Erro ao criar lead e converter: ' + (e.message || 'Verifique o console.'))
        } finally {
            setSaving(false)
        }
    }

    async function handleConvertLead(lead) {
        setSaving(true)
        try {
            const patientPayload = {
                name: lead.name,
                phone: lead.phone || null,
                email: lead.email || null,
                source: 'Lead Convertido'
            }

            let { data: newPatient, error: pError } = await supabase
                .from('patients')
                .insert([patientPayload])
                .select()
                .single()

            if (pError) {
                // Tentar sem 'source' se falhar
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

            const updatePayload = {
                convertido_em_paciente: true,
                paciente_id: newPatient.id,
                etapa: 'consulta_agendada'
            }

            const { error: updateError } = await supabase
                .from('leads')
                .update(updatePayload)
                .eq('id', lead.id)

            if (updateError && (updateError.code === 'PGRST204' || updateError.message?.includes('column "etapa" does not exist'))) {
                delete updatePayload.etapa
                updatePayload.status = 'agendado'
                await supabase.from('leads').update(updatePayload).eq('id', lead.id)
            }

            setForm(f => ({ ...f, paciente_id: newPatient.id }))
            setPacienteSearch(newPatient.name)
            setLeads([])
        } catch (e) {
            console.error('Erro detalhado:', e)
            toast.error('Erro ao converter lead: ' + (e.message || ''))
        } finally {
            setSaving(false)
        }
    }

    async function handleSave() {
        if (!form.paciente_id) { toast.warning('Selecione um paciente.'); return }
        if (!form.data_inicio) { toast.warning('Informe a data e hora de início.'); return }
        if (!form.dentista_id) { toast.warning('Selecione um dentista.'); return }
        if (!form.cadeira_id) { toast.warning('Selecione uma cadeira.'); return }

        setSaving(true)
        try {
            const dataInicioIso = new Date(form.data_inicio).toISOString()
            const dataFimIso = form.data_fim ? new Date(form.data_fim).toISOString() : new Date(new Date(form.data_inicio).getTime() + 15 * 60000).toISOString()

            // Remove campos que não existem na tabela agendamentos
            const { tipo, valor, ...rest } = form;
            const payload = {
                ...rest,
                data_inicio: dataInicioIso,
                data_fim: dataFimIso
            }

            let result;
            if (isEdit) {
                result = await supabase.from('agendamentos').update(payload).eq('id', eventoExistente.id)
            } else {
                result = await supabase.from('agendamentos').insert([payload])
            }

            if (result.error) {
                console.error('Erro ao salvar agendamento:', result.error)
                toast.error('Erro ao salvar agendamento: ' + (result.error.message || 'Verifique os dados e tente novamente.'))
                setSaving(false)
                return
            }

            toast.success('Agendamento ' + (isEdit ? 'atualizado' : 'realizado') + ' com sucesso!')
            onClose()
        } catch (e) {
            console.error('Erro crítico no agendamento:', e)
            toast.error('Ocorreu um erro inesperado ao salvar.')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!confirm('Excluir este agendamento?')) return
        await supabase.from('agendamentos').delete().eq('id', eventoExistente.id)
        onClose()
    }

    const situacoes = [
        { value: 'agendado', label: 'Agendado', color: '#6366F1' },
        { value: 'confirmado', label: 'Confirmado', color: '#10B981' },
        { value: 'atendido', label: 'Atendido', color: '#3B82F6' },
        { value: 'faltou', label: 'Faltou', color: '#EF4444' },
        { value: 'desmarcou', label: 'Desmarcou', color: '#F59E0B' },
        { value: 'cancelado', label: 'Cancelado', color: '#9CA3AF' },
    ]

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-md">
                <div className="modal-header">
                    <div className="modal-title">
                        <i className="fa-solid fa-calendar-plus" style={{ marginRight: 8, color: 'var(--primary)' }} />
                        {isEdit ? 'Editar agendamento' : 'Novo agendamento'}
                    </div>
                    <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
                </div>

                <div className="modal-body">
                    {/* Situação */}
                    <div className="form-group">
                        <label className="form-label">Situação</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {situacoes.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, situacao: s.value }))}
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 20,
                                        border: `2px solid ${form.situacao === s.value ? s.color : 'var(--border)'}`,
                                        background: form.situacao === s.value ? s.color : 'white',
                                        color: form.situacao === s.value ? 'white' : 'var(--text-secondary)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Paciente / Lead */}
                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Paciente ou Lead *</label>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                    type="button"
                                    onClick={() => { setSearchMode('paciente'); setPacienteSearch(''); setPacientes([]); setLeads([]); setShowCreateLead(false) }}
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: 10,
                                        borderRadius: 4,
                                        border: '1px solid ' + (searchType === 'paciente' ? 'var(--primary)' : 'var(--border)'),
                                        background: searchType === 'paciente' ? 'var(--primary-ultra-light)' : 'white',
                                        color: searchType === 'paciente' ? 'var(--primary)' : 'var(--text-secondary)',
                                        fontWeight: 600
                                    }}
                                >
                                    PACIENTES
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSearchMode('lead'); setPacienteSearch(''); setPacientes([]); setLeads([]); setShowCreateLead(false) }}
                                    style={{
                                        padding: '2px 8px',
                                        fontSize: 10,
                                        borderRadius: 4,
                                        border: '1px solid ' + (searchType === 'lead' ? 'var(--primary)' : 'var(--border)'),
                                        background: searchType === 'lead' ? 'var(--primary-ultra-light)' : 'white',
                                        color: searchType === 'lead' ? 'var(--primary)' : 'var(--text-secondary)',
                                        fontWeight: 600
                                    }}
                                >
                                    LEADS
                                </button>
                            </div>
                        </div>

                        {!showCreateLead ? (
                            <>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-control"
                                        placeholder={searchType === 'paciente' ? "Buscar paciente por nome..." : "Buscar lead por nome..."}
                                        value={pacienteSearch}
                                        onChange={e => { setPacienteSearch(e.target.value); searchData(e.target.value) }}
                                        autoComplete="off"
                                    />
                                    {searchType === 'lead' && !form.paciente_id && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateLead(true)}
                                            style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                background: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '2px 8px',
                                                fontSize: 10,
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            + NOVO LEAD
                                        </button>
                                    )}
                                </div>

                                {/* Resultados Pacientes */}
                                {searchType === 'paciente' && pacienteSearch && pacientes.length > 0 && !form.paciente_id && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'white', marginTop: 4, maxHeight: 160, overflowY: 'auto', boxShadow: 'var(--shadow)', position: 'absolute', width: 'calc(100% - 48px)', zIndex: 10 }}>
                                        {pacientes.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => { setForm(f => ({ ...f, paciente_id: p.id })); setPacienteSearch(p.name) }}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-light)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                            >
                                                <strong>{p.name}</strong> — {p.phone || 'sem telefone'}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Resultados Leads */}
                                {searchType === 'lead' && pacienteSearch && leads.length > 0 && !form.paciente_id && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'white', marginTop: 4, maxHeight: 160, overflowY: 'auto', boxShadow: 'var(--shadow)', position: 'absolute', width: 'calc(100% - 48px)', zIndex: 10 }}>
                                        {leads.map(l => (
                                            <div
                                                key={l.id}
                                                onClick={() => handleConvertLead(l)}
                                                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-light)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>{l.name}</strong> — {l.phone || 'sem telefone'}
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.email || 'sem e-mail'}</div>
                                                    </div>
                                                    <span style={{ fontSize: 10, background: 'var(--warning-light)', color: 'var(--warning)', padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>CONVERTER EM PACIENTE</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ padding: 12, border: '1px solid var(--primary-light)', borderRadius: 'var(--radius)', background: 'var(--primary-ultra-light)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>CADASTRAR NOVO LEAD</span>
                                    <button type="button" onClick={() => setShowCreateLead(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><i className="fa-solid fa-xmark" /></button>
                                </div>
                                <div className="form-grid form-grid-2">
                                    <div className="form-group" style={{ marginBottom: 8 }}>
                                        <label className="form-label" style={{ fontSize: 10 }}>Nome Completo</label>
                                        <input className="form-control form-control-sm" value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 8 }}>
                                        <label className="form-label" style={{ fontSize: 10 }}>Telefone</label>
                                        <input className="form-control form-control-sm" value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label className="form-label" style={{ fontSize: 10 }}>E-mail (opcional)</label>
                                    <input className="form-control form-control-sm" value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ width: '100%' }}
                                    onClick={handleCreateLeadAndSelect}
                                    disabled={saving}
                                >
                                    {saving ? 'Salvando...' : 'Criar Lead e Agendar'}
                                </button>
                            </div>
                        )}

                        {form.paciente_id && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span><i className="fa-solid fa-check-circle" /> <strong>{pacienteSearch}</strong> selecionado</span>
                                <button type="button" onClick={() => { setForm(f => ({ ...f, paciente_id: '' })); setPacienteSearch(''); setPacientes([]); setLeads([]) }} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                    <i className="fa-solid fa-rotate" /> TROCAR
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Data/hora */}
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Data e hora início *</label>
                            <input type="datetime-local" className="form-control" step="900" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Data e hora fim</label>
                            <input type="datetime-local" className="form-control" step="900" value={form.data_fim} onChange={e => setForm(p => ({ ...p, data_fim: e.target.value }))} />
                        </div>
                    </div>

                    {/* Dentista e Cadeira */}
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Cirurgião-Dentista</label>
                            <select className="form-control" value={form.dentista_id} onChange={e => setForm(p => ({ ...p, dentista_id: e.target.value }))}>
                                <option value="">Selecionar...</option>
                                {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cadeira</label>
                            <select className="form-control" value={form.cadeira_id} onChange={e => setForm(p => ({ ...p, cadeira_id: e.target.value }))}>
                                <option value="">Selecionar...</option>
                                {cadeiras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Motivo */}
                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Motivo</label>
                            <select className="form-control" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}>
                                <option value="consulta">Consulta</option>
                                <option value="retorno">Retorno</option>
                                <option value="emergencia">Emergência</option>
                                <option value="procedimento">Procedimento</option>
                                <option value="avaliacao">Avaliação</option>
                                <option value="exame">Exame</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Valor (R$)</label>
                            <input type="number" className="form-control" placeholder="0,00" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="form-group">
                        <label className="form-label">Observações</label>
                        <textarea className="form-control" placeholder="Observações sobre o agendamento..." value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
                    </div>
                </div>

                <div className="modal-footer">
                    {isEdit && (
                        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                            <i className="fa-solid fa-trash" /> Excluir
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Salvando...</> : <><i className="fa-solid fa-check" /> {isEdit ? 'Salvar' : 'Agendar'}</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
