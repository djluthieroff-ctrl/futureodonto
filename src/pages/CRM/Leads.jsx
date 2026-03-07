
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { registrarAuditoria } from '../../lib/auditoria'
import { buildEndDateFromStart, DEFAULT_APPOINTMENT_MINUTES, findAgendamentoConflict } from '../../lib/agendamento'

const LEAD_STAGE_OPTIONS = [
    { value: 'lead', label: 'Novo Lead' },
    { value: 'consulta_agendada', label: 'Consulta Agendada' },
    { value: 'atendido', label: 'Atendido' },
    { value: 'faltou_desmarcou', label: 'Faltou/Desmarcou' },
    { value: 'orcamento_perdido', label: 'Perdido' }
]

const DEFAULT_NEW_LEAD = {
    name: '',
    phone: '',
    email: '',
    source: 'Manual',
    type: 'rede_social',
    is_ultima_gestao: false,
    etapa: 'lead'
}

const DEFAULT_SCHEDULE_FORM = {
    data_inicio: '',
    data_fim: '',
    dentista_id: '',
    cadeira_id: '',
    motivo: 'consulta'
}

const normalizeText = (value) => (value || '').toString().trim().toLowerCase()

const getLeadStage = (lead) => {
    if (lead?.etapa) return lead.etapa
    if (lead?.status === 'agendado' || lead?.status === 'scheduled') return 'consulta_agendada'
    if (lead?.status === 'visit') return 'atendido'
    return lead?.status || 'lead'
}

const isLeadOnline = (lead) => lead?.type === 'agendamento_online'

const sortLeads = (list, sortOrder) => {
    if (sortOrder === 'created_desc') return list
    const direction = sortOrder === 'name_desc' ? -1 : 1
    return [...list].sort((a, b) => {
        const aName = normalizeText(a?.name)
        const bName = normalizeText(b?.name)
        return aName.localeCompare(bName, 'pt-BR') * direction
    })
}

const formatDateSafely = (dateValue, mask = 'dd/MM/yyyy') => {
    if (!dateValue) return '-'
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return '-'
    return format(date, mask)
}

const formatForInput = (dateValue) => {
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const matchesLeadSearch = (lead, searchTerm) => {
    if (!searchTerm) return true
    const normalized = normalizeText(searchTerm)
    return [lead?.name, lead?.phone, lead?.email, lead?.source].some((field) => normalizeText(field).includes(normalized))
}

export default function Leads() {
    const toast = useToast()

    const [leads, setLeads] = useState([])
    const [patientMetaMap, setPatientMetaMap] = useState({})
    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState('')

    const [modalNovoLead, setModalNovoLead] = useState(false)
    const [modalImport, setModalImport] = useState(false)
    const [modalAgendamento, setModalAgendamento] = useState(false)

    const [novoLead, setNovoLead] = useState(DEFAULT_NEW_LEAD)
    const [importJson, setImportJson] = useState('')

    const [saving, setSaving] = useState(false)
    const [savingAgendamento, setSavingAgendamento] = useState(false)

    const [leadParaAgendar, setLeadParaAgendar] = useState(null)
    const [dentistas, setDentistas] = useState([])
    const [cadeiras, setCadeiras] = useState([])
    const [agendamentoForm, setAgendamentoForm] = useState(DEFAULT_SCHEDULE_FORM)

    const [sortOrder, setSortOrder] = useState('created_desc')
    const [searchTerm, setSearchTerm] = useState('')
    const [stageFilter, setStageFilter] = useState('all')
    const [sectionFilter, setSectionFilter] = useState('all')
    const [onlyUnscheduled, setOnlyUnscheduled] = useState(false)

    const setTransientStatus = useCallback((text) => {
        setStatus(text)
        setTimeout(() => setStatus(''), 3000)
    }, [])

    const loadPatientMeta = useCallback(async (leadRows) => {
        const patientIds = [...new Set((leadRows || []).map((lead) => lead.paciente_id).filter(Boolean))]

        if (patientIds.length === 0) {
            setPatientMetaMap({})
            return
        }

        const mapRows = (rows) => {
            const next = {}
                ; (rows || []).forEach((row) => {
                    const isActive = typeof row?.is_active_patient === 'boolean'
                        ? row.is_active_patient
                        : normalizeText(row?.status) === 'ativo'
                    next[row.id] = {
                        is_active_patient: Boolean(isActive),
                        status: row?.status || null
                    }
                })
            setPatientMetaMap(next)
        }

        const withIsActive = await supabase
            .from('patients')
            .select('id,status,is_active_patient')
            .in('id', patientIds)

        if (!withIsActive.error) {
            mapRows(withIsActive.data)
            return
        }

        const fallback = await supabase
            .from('patients')
            .select('id,status')
            .in('id', patientIds)

        if (fallback.error) {
            console.error('Erro ao carregar metadados de pacientes:', fallback.error)
            setPatientMetaMap({})
            return
        }

        mapRows(fallback.data)
    }, [])

    const loadLeads = useCallback(async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            const rows = data || []
            setLeads(rows)
            await loadPatientMeta(rows)
        } catch (e) {
            console.error('Erro ao carregar leads:', e)
            toast.error(`Erro ao carregar leads: ${e.message || 'falha inesperada'}`)
        } finally {
            setLoading(false)
        }
    }, [loadPatientMeta, toast])

    useEffect(() => {
        loadLeads()
    }, [loadLeads])

    const loadConfigsAgendamento = useCallback(async () => {
        try {
            const [{ data: d }, { data: c }] = await Promise.all([
                supabase.from('dentistas').select('id,nome').eq('ativo', true).order('nome'),
                supabase.from('cadeiras').select('id,nome').eq('ativa', true).order('nome')
            ])
            setDentistas(d || [])
            setCadeiras(c || [])
        } catch (e) {
            console.error('Erro ao carregar configuracoes de agendamento:', e)
        }
    }, [])

    useEffect(() => {
        loadConfigsAgendamento()
    }, [loadConfigsAgendamento])

    const buildDefaultScheduleForm = useCallback((lead) => {
        const step = 15 * 60000
        const startBase = lead?.data_desejada ? new Date(lead.data_desejada) : new Date()
        const start = new Date(Math.ceil(startBase.getTime() / step) * step)
        const end = buildEndDateFromStart(start, DEFAULT_APPOINTMENT_MINUTES)

        return {
            data_inicio: formatForInput(start),
            data_fim: formatForInput(end),
            dentista_id: dentistas[0]?.id || '',
            cadeira_id: cadeiras[0]?.id || '',
            motivo: 'consulta'
        }
    }, [dentistas, cadeiras])

    const abrirModalAgendamento = useCallback((lead) => {
        setLeadParaAgendar(lead)
        setAgendamentoForm(buildDefaultScheduleForm(lead))
        setModalAgendamento(true)
    }, [buildDefaultScheduleForm])

    const fecharModalAgendamento = useCallback(() => {
        setModalAgendamento(false)
        setLeadParaAgendar(null)
    }, [])

    const createPatientForLead = useCallback(async (lead) => {
        if (lead.paciente_id) return lead.paciente_id

        const patientPayload = {
            name: lead.name,
            phone: lead.phone || null,
            email: lead.email || null,
            source: lead.source || lead.type || 'Lead'
        }

        let { data: patient, error } = await supabase
            .from('patients')
            .insert([patientPayload])
            .select()
            .single()

        if (error) {
            const shouldRetryWithoutSource = error.message?.includes('source')
                && (error.message?.includes('column') || error.message?.includes('schema cache'))

            if (!shouldRetryWithoutSource) throw error

            delete patientPayload.source

            const retry = await supabase
                .from('patients')
                .insert([patientPayload])
                .select()
                .single()

            if (retry.error) throw retry.error
            patient = retry.data
        }

        return patient.id
    }, [])

    const updateLeadWithFallback = useCallback(async (leadId, payload) => {
        const firstTry = await supabase.from('leads').update(payload).eq('id', leadId)
        if (!firstTry.error) return

        const etapaMissing = firstTry.error.code === 'PGRST204'
            || firstTry.error.message?.includes('column "etapa" does not exist')

        if (!etapaMissing || !payload.etapa) throw firstTry.error

        const fallbackPayload = { ...payload, status: payload.etapa }
        delete fallbackPayload.etapa

        const fallbackTry = await supabase.from('leads').update(fallbackPayload).eq('id', leadId)
        if (fallbackTry.error) throw fallbackTry.error
    }, [])

    const syncLeadAsScheduled = useCallback(async (leadId, pacienteId, dataInicioIso) => {
        await updateLeadWithFallback(leadId, {
            convertido_em_paciente: true,
            paciente_id: pacienteId,
            data_desejada: dataInicioIso,
            etapa: 'consulta_agendada'
        })
    }, [updateLeadWithFallback])

    const confirmarAgendamentoLead = async () => {
        if (!leadParaAgendar) return
        if (!agendamentoForm.data_inicio) return toast.warning('Informe data e hora de inicio')
        if (!agendamentoForm.dentista_id) return toast.warning('Selecione um dentista')
        if (!agendamentoForm.cadeira_id) return toast.warning('Selecione uma cadeira')
        if (!leadParaAgendar.paciente_id && !confirm(`O lead "${leadParaAgendar.name}" sera convertido em paciente para confirmar o agendamento. Deseja continuar?`)) return

        setSavingAgendamento(true)

        try {
            const pacienteId = await createPatientForLead(leadParaAgendar)
            const dataInicioIso = new Date(agendamentoForm.data_inicio).toISOString()
            const dataFimIso = agendamentoForm.data_fim
                ? new Date(agendamentoForm.data_fim).toISOString()
                : buildEndDateFromStart(agendamentoForm.data_inicio, DEFAULT_APPOINTMENT_MINUTES).toISOString()

            const conflict = await findAgendamentoConflict({
                supabase,
                data_inicio: dataInicioIso,
                data_fim: dataFimIso,
                dentista_id: agendamentoForm.dentista_id,
                cadeira_id: agendamentoForm.cadeira_id
            })

            if (conflict) {
                const conflitandoCom = conflict?.patients?.name || 'outro paciente'
                toast.warning(`Conflito de agenda com ${conflitandoCom}. Ajuste horario, dentista ou cadeira.`)
                return
            }

            const appointmentPayload = {
                paciente_id: pacienteId,
                dentista_id: agendamentoForm.dentista_id,
                cadeira_id: agendamentoForm.cadeira_id,
                data_inicio: dataInicioIso,
                data_fim: dataFimIso,
                motivo: agendamentoForm.motivo || 'consulta',
                situacao: 'agendado',
                observacoes: `Criado a partir do lead: ${leadParaAgendar.name}`
            }

            const { error: appointmentError } = await supabase.from('agendamentos').insert([appointmentPayload])
            if (appointmentError) throw appointmentError

            await syncLeadAsScheduled(leadParaAgendar.id, pacienteId, dataInicioIso)

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Lead agendado',
                detalhes: `Lead: ${leadParaAgendar.name} | Data: ${new Date(dataInicioIso).toLocaleString('pt-BR')}`
            })

            fecharModalAgendamento()
            setTransientStatus('Lead agendado com sucesso')
            toast.success('Consulta agendada e vinculada ao contato')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao agendar lead:', e)
            toast.error(`Erro ao agendar lead: ${e.message || 'falha inesperada'}`)
        } finally {
            setSavingAgendamento(false)
        }
    }

    const handleCreateLead = async () => {
        if (!novoLead.name) return toast.warning('Nome e obrigatorio')
        setSaving(true)

        try {
            const payload = { ...novoLead }
            let { error } = await supabase.from('leads').insert([payload])

            const etapaMissing = error && (
                error.code === 'PGRST204'
                || error.message?.includes('column "etapa" does not exist')
            )

            if (etapaMissing) {
                const fallbackPayload = { ...payload, status: payload.etapa || 'lead' }
                delete fallbackPayload.etapa
                const fallback = await supabase.from('leads').insert([fallbackPayload])
                error = fallback.error
            }

            if (error) throw error

            setModalNovoLead(false)
            setNovoLead(DEFAULT_NEW_LEAD)

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Lead criado',
                detalhes: `Lead: ${payload.name}`
            })

            toast.success('Lead criado com sucesso')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao criar lead:', e)
            toast.error(`Erro ao criar lead: ${e.message || 'falha inesperada'}`)
        } finally {
            setSaving(false)
        }
    }

    const handleImportJson = async () => {
        try {
            const raw = JSON.parse(importJson)
            if (!Array.isArray(raw)) throw new Error('O conteudo deve ser um array de leads')

            setSaving(true)

            const mappedLeads = raw.map((lead) => {
                let etapa = 'lead'
                if (lead.status === 'scheduled') etapa = 'consulta_agendada'
                if (lead.status === 'visit') etapa = 'atendido'

                return {
                    name: lead.name || 'Sem nome',
                    phone: lead.phone || '',
                    email: lead.email || '',
                    source: lead.source || lead.channel || 'Importado',
                    type: lead.status === 'scheduled' ? 'agendamento_online' : 'rede_social',
                    etapa,
                    message: lead.message || '',
                    created_at: lead.createdAt || new Date().toISOString(),
                    data_desejada: lead.visitDate || lead.scheduledAt || null
                }
            })

            for (let i = 0; i < mappedLeads.length; i += 50) {
                const batch = mappedLeads.slice(i, i + 50)
                const { error } = await supabase.from('leads').insert(batch)
                if (error) throw error
            }

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Leads importados',
                detalhes: `Quantidade: ${mappedLeads.length}`
            })

            toast.success(`${mappedLeads.length} leads importados com sucesso`)
            setModalImport(false)
            setImportJson('')
            await loadLeads()
        } catch (e) {
            console.error('Erro na importacao:', e)
            toast.error(`Erro ao importar JSON: ${e.message || 'falha inesperada'}`)
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteLead = async (id) => {
        if (!window.confirm('Deseja excluir este lead permanentemente?')) return

        try {
            const { error } = await supabase.from('leads').delete().eq('id', id)
            if (error) throw error

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Lead excluido',
                detalhes: `Lead ID: ${id}`
            })

            toast.success('Lead excluido')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao excluir lead:', e)
            toast.error('Erro ao excluir lead')
        }
    }

    const updateLeadStatus = async (id, newStage) => {
        try {
            await updateLeadWithFallback(id, { etapa: newStage })

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Etapa de lead atualizada',
                detalhes: `Lead ID: ${id} -> ${newStage}`
            })

            setTransientStatus('Etapa atualizada')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao atualizar lead:', e)
            toast.error(`Erro ao atualizar lead: ${e.message || 'falha inesperada'}`)
        }
    }

    const handleEtapaChange = async (lead, newStage) => {
        const stage = getLeadStage(lead)
        if (newStage === stage) return

        if (newStage === 'consulta_agendada') {
            abrirModalAgendamento(lead)
            return
        }

        await updateLeadStatus(lead.id, newStage)
    }

    const converterEmPaciente = async (lead) => {
        if (!confirm(`Converter o lead "${lead.name}" em paciente agora?`)) return
        try {
            const patientId = await createPatientForLead(lead)
            await updateLeadWithFallback(lead.id, {
                etapa: 'consulta_agendada',
                convertido_em_paciente: true,
                paciente_id: patientId
            })

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Lead convertido em paciente',
                detalhes: `Lead: ${lead.name} | Paciente ID: ${patientId}`
            })

            toast.success('Lead convertido em paciente com sucesso')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao converter lead:', e)
            toast.error(`Erro ao converter lead: ${e.message || 'falha inesperada'}`)
        }
    }

    const desconverterEmPaciente = async (lead) => {
        if (!confirm(`Desconverter o lead "${lead.name}" de paciente? Isso removerá a vinculação com o paciente.`)) return
        try {
            await updateLeadWithFallback(lead.id, {
                etapa: 'lead',
                convertido_em_paciente: false,
                paciente_id: null
            })

            await registrarAuditoria({
                modulo: 'Leads',
                acao: 'Lead desconvertido de paciente',
                detalhes: `Lead: ${lead.name}`
            })

            toast.success('Lead desconvertido de paciente com sucesso')
            await loadLeads()
        } catch (e) {
            console.error('Erro ao desconverter lead:', e)
            toast.error(`Erro ao desconverter lead: ${e.message || 'falha inesperada'}`)
        }
    }

    const enrichedLeads = useMemo(() => {
        return (leads || []).map((lead) => {
            const patientMeta = lead?.paciente_id ? patientMetaMap[lead.paciente_id] : null
            return {
                ...lead,
                etapaAtual: getLeadStage(lead),
                patientMeta: patientMeta || null
            }
        })
    }, [leads, patientMetaMap])

    const filteredLeads = useMemo(() => {
        return enrichedLeads.filter((lead) => {
            if (!matchesLeadSearch(lead, searchTerm)) return false
            if (sectionFilter === 'online' && !isLeadOnline(lead)) return false
            if (sectionFilter === 'social' && (isLeadOnline(lead) || lead.is_ultima_gestao)) return false
            if (sectionFilter === 'reactivation' && !lead.is_ultima_gestao) return false
            if (stageFilter !== 'all' && lead.etapaAtual !== stageFilter) return false
            if (onlyUnscheduled && lead.etapaAtual === 'consulta_agendada') return false
            return true
        })
    }, [enrichedLeads, searchTerm, sectionFilter, stageFilter, onlyUnscheduled])

    const leadsOnline = useMemo(() => filteredLeads.filter((lead) => isLeadOnline(lead) && !lead.is_ultima_gestao), [filteredLeads])
    const leadsRedes = useMemo(() => filteredLeads.filter((lead) => !isLeadOnline(lead) && !lead.is_ultima_gestao), [filteredLeads])
    const leadsUltimaGestao = useMemo(() => filteredLeads.filter((lead) => lead.is_ultima_gestao), [filteredLeads])

    const sortedLeadsOnline = useMemo(() => sortLeads(leadsOnline, sortOrder), [leadsOnline, sortOrder])
    const sortedLeadsRedes = useMemo(() => sortLeads(leadsRedes, sortOrder), [leadsRedes, sortOrder])
    const sortedLeadsUltimaGestao = useMemo(() => sortLeads(leadsUltimaGestao, sortOrder), [leadsUltimaGestao, sortOrder])

    const kpis = useMemo(() => {
        const total = enrichedLeads.length
        const novos = enrichedLeads.filter((lead) => lead.etapaAtual === 'lead').length
        const agendados = enrichedLeads.filter((lead) => lead.etapaAtual === 'consulta_agendada').length
        const convertidos = enrichedLeads.filter((lead) => lead.convertido_em_paciente).length

        return { total, novos, agendados, convertidos }
    }, [enrichedLeads])

    const LeadTable = ({ leads: rows, title, isOnline }) => (
        <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
                <div>
                    <div className="card-title">{title}</div>
                    <div className="card-subtitle">{rows.length} contatos</div>
                </div>
            </div>

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Contato</th>
                            <th>Canal</th>
                            {isOnline ? <th>Data desejada</th> : <th>Origem</th>}
                            <th>Etapa</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>
                                    Nenhum lead encontrado
                                </td>
                            </tr>
                        ) : (
                            rows.map((lead) => {
                                const hasPhone = Boolean(lead.phone)
                                const patientIsActive = Boolean(lead.patientMeta?.is_active_patient)

                                return (
                                    <tr key={lead.id}>
                                        <td>{formatDateSafely(lead.created_at)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {lead.convertido_em_paciente ? (
                                                    <span
                                                        title={patientIsActive ? 'Paciente ativo' : 'Paciente em avaliacao'}
                                                        style={{
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: '50%',
                                                            background: patientIsActive ? '#22C55E' : '#F59E0B',
                                                            display: 'inline-block'
                                                        }}
                                                    />
                                                ) : (
                                                    <span
                                                        title="Lead"
                                                        style={{
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: '50%',
                                                            background: '#94A3B8',
                                                            display: 'inline-block'
                                                        }}
                                                    />
                                                )}
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>{lead.name || 'Sem nome'}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.email || 'Sem e-mail'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{lead.phone || '-'}</td>
                                        {isOnline ? (
                                            <td>{formatDateSafely(lead.data_desejada)}</td>
                                        ) : (
                                            <td><span className="badge badge-outline">{lead.source || '-'}</span></td>
                                        )}
                                        <td>
                                            <select
                                                className="form-control form-control-sm"
                                                value={lead.etapaAtual}
                                                onChange={(e) => handleEtapaChange(lead, e.target.value)}
                                                style={{ width: 'auto' }}
                                            >
                                                {LEAD_STAGE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => abrirModalAgendamento(lead)}
                                                    title="Agendar contato"
                                                >
                                                    <i className="fa-solid fa-calendar-plus" /> Agendar
                                                </button>

                                                {!lead.convertido_em_paciente && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => converterEmPaciente(lead)}
                                                        title="Converter em paciente"
                                                    >
                                                        <i className="fa-solid fa-user-plus" /> Converter
                                                    </button>
                                                )}

                                                {lead.convertido_em_paciente && (
                                                    <button
                                                        className="btn btn-sm btn-warning"
                                                        onClick={() => desconverterEmPaciente(lead)}
                                                        title="Desconverter de paciente"
                                                    >
                                                        <i className="fa-solid fa-user-minus" /> Desconverter
                                                    </button>
                                                )}

                                                {hasPhone && (
                                                    <a
                                                        className="btn btn-sm btn-outline"
                                                        href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title="Abrir WhatsApp"
                                                    >
                                                        <i className="fa-brands fa-whatsapp" /> WhatsApp
                                                    </a>
                                                )}

                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteLead(lead.id)}
                                                    title="Remover lead"
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
                <div>
                    <h1 className="page-title">Gestao de Leads</h1>
                    <div className="page-subtitle">Central comercial com cadastro, qualificacao e agendamento de contatos</div>
                </div>
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

            <div className="cards-grid cards-grid-4" style={{ marginBottom: 16 }}>
                <div className="card"><div className="card-body"><div className="card-subtitle">Total de contatos</div><div className="kpi-value">{kpis.total}</div></div></div>
                <div className="card"><div className="card-body"><div className="card-subtitle">Novos leads</div><div className="kpi-value">{kpis.novos}</div></div></div>
                <div className="card"><div className="card-body"><div className="card-subtitle">Consultas agendadas</div><div className="kpi-value">{kpis.agendados}</div></div></div>
                <div className="card"><div className="card-body"><div className="card-subtitle">Convertidos</div><div className="kpi-value">{kpis.convertidos}</div></div></div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                    <div className="form-grid form-grid-4" style={{ alignItems: 'end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Buscar contato</label>
                            <input
                                className="form-control"
                                placeholder="Nome, telefone, e-mail, origem"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Secao</label>
                            <select className="form-control" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                                <option value="all">Todas</option>
                                <option value="online">Agendamentos online</option>
                                <option value="social">Redes sociais</option>
                                <option value="reactivation">Ultima gestao</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Etapa</label>
                            <select className="form-control" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                                <option value="all">Todas</option>
                                {LEAD_STAGE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Ordenacao</label>
                            <select className="form-control" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                                <option value="created_desc">Mais recentes</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="name_desc">Nome (Z-A)</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                            id="only-unscheduled"
                            type="checkbox"
                            checked={onlyUnscheduled}
                            onChange={(e) => setOnlyUnscheduled(e.target.checked)}
                        />
                        <label htmlFor="only-unscheduled" style={{ fontSize: 13, cursor: 'pointer' }}>
                            Mostrar apenas contatos sem consulta agendada
                        </label>
                    </div>
                </div>
            </div>

            {status && <div className="alert alert-success">{status}</div>}

            {loading ? (
                <div className="loading"><div className="spinner" /></div>
            ) : (
                <>
                    <LeadTable leads={sortedLeadsOnline} title="Secao 1: Agendamentos Online" isOnline />
                    <LeadTable leads={sortedLeadsRedes} title="Secao 2: Leads de Redes Sociais" isOnline={false} />
                    <LeadTable leads={sortedLeadsUltimaGestao} title="Secao 3: Pacientes da Ultima Gestao" isOnline={false} />
                </>
            )}

            {modalAgendamento && leadParaAgendar && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && fecharModalAgendamento()}>
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <div className="modal-title">Agendar consulta do lead</div>
                            <button className="modal-close" onClick={fecharModalAgendamento}><i className="fa-solid fa-xmark" /></button>
                        </div>

                        <div className="modal-body">
                            <div style={{ fontSize: 13, marginBottom: 12 }}>
                                <strong>{leadParaAgendar.name}</strong>
                                <div style={{ color: 'var(--text-muted)' }}>{leadParaAgendar.phone || 'Sem telefone'}</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Data e hora de inicio *</label>
                                <input
                                    type="datetime-local"
                                    className="form-control"
                                    step="900"
                                    value={agendamentoForm.data_inicio}
                                    onChange={(e) => setAgendamentoForm((prev) => ({ ...prev, data_inicio: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Data e hora de fim</label>
                                <input
                                    type="datetime-local"
                                    className="form-control"
                                    step="900"
                                    value={agendamentoForm.data_fim}
                                    onChange={(e) => setAgendamentoForm((prev) => ({ ...prev, data_fim: e.target.value }))}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Dentista *</label>
                                <select
                                    className="form-control"
                                    value={agendamentoForm.dentista_id}
                                    onChange={(e) => setAgendamentoForm((prev) => ({ ...prev, dentista_id: e.target.value }))}
                                >
                                    <option value="">Selecionar...</option>
                                    {dentistas.map((dentista) => <option key={dentista.id} value={dentista.id}>{dentista.nome}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Cadeira *</label>
                                <select
                                    className="form-control"
                                    value={agendamentoForm.cadeira_id}
                                    onChange={(e) => setAgendamentoForm((prev) => ({ ...prev, cadeira_id: e.target.value }))}
                                >
                                    <option value="">Selecionar...</option>
                                    {cadeiras.map((cadeira) => <option key={cadeira.id} value={cadeira.id}>{cadeira.nome}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Motivo</label>
                                <select
                                    className="form-control"
                                    value={agendamentoForm.motivo}
                                    onChange={(e) => setAgendamentoForm((prev) => ({ ...prev, motivo: e.target.value }))}
                                >
                                    <option value="consulta">Consulta</option>
                                    <option value="avaliacao">Avaliacao</option>
                                    <option value="retorno">Retorno</option>
                                    <option value="procedimento">Procedimento</option>
                                    <option value="emergencia">Emergencia</option>
                                </select>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={fecharModalAgendamento}>Cancelar</button>
                            <button className="btn btn-primary" onClick={confirmarAgendamentoLead} disabled={savingAgendamento}>
                                {savingAgendamento ? 'Agendando...' : 'Confirmar agendamento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalNovoLead && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalNovoLead(false)}>
                    <div className="modal modal-sm">
                        <div className="modal-header">
                            <div className="modal-title">Novo Lead</div>
                            <button className="modal-close" onClick={() => setModalNovoLead(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Nome *</label>
                                <input className="form-control" value={novoLead.name} onChange={(e) => setNovoLead((prev) => ({ ...prev, name: e.target.value }))} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-control" value={novoLead.phone} onChange={(e) => setNovoLead((prev) => ({ ...prev, phone: e.target.value }))} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">E-mail</label>
                                <input className="form-control" value={novoLead.email} onChange={(e) => setNovoLead((prev) => ({ ...prev, email: e.target.value }))} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Origem</label>
                                <select className="form-control" value={novoLead.source} onChange={(e) => setNovoLead((prev) => ({ ...prev, source: e.target.value }))}>
                                    <option value="Manual">Manual</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="Facebook">Facebook</option>
                                    <option value="Google">Google</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={novoLead.is_ultima_gestao}
                                        onChange={(e) => setNovoLead((prev) => ({ ...prev, is_ultima_gestao: e.target.checked }))}
                                    />
                                    <span style={{ fontSize: 13 }}>Paciente da ultima gestao (reativacao)</span>
                                </label>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalNovoLead(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleCreateLead} disabled={saving}>
                                {saving ? 'Salvando...' : 'Criar Lead'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalImport && (
                <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalImport(false)}>
                    <div className="modal modal-md">
                        <div className="modal-header">
                            <div className="modal-title">Importar Leads do projeto antigo</div>
                            <button className="modal-close" onClick={() => setModalImport(false)}><i className="fa-solid fa-xmark" /></button>
                        </div>

                        <div className="modal-body">
                            <p style={{ fontSize: 13, marginBottom: 12 }}>
                                Cole aqui o JSON exportado do sistema anterior. Aceita array de objetos com campos como
                                <code style={{ marginLeft: 4 }}>name</code>,
                                <code style={{ marginLeft: 4 }}>phone</code>,
                                <code style={{ marginLeft: 4 }}>email</code>,
                                <code style={{ marginLeft: 4 }}>status</code> e
                                <code style={{ marginLeft: 4 }}>scheduledAt</code>.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Cole o JSON aqui</label>
                                <textarea
                                    className="form-control"
                                    rows={10}
                                    value={importJson}
                                    onChange={(e) => setImportJson(e.target.value)}
                                    placeholder="[...]"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setModalImport(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleImportJson} disabled={saving || !importJson}>
                                {saving ? 'Importando...' : 'Iniciar importacao'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
