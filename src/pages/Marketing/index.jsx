import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { exportToCSV } from '../../utils/export'

const ETAPAS = [
    { key: 'lead', label: 'Lead', color: '#22C55E', icon: 'fa-user-plus' },
    { key: 'consulta_agendada', label: 'Consulta agendada', color: '#84CC16', icon: 'fa-calendar-check' },
    { key: 'faltou_desmarcou', label: 'Faltou/Desmarcou', color: '#EAB308', icon: 'fa-calendar-xmark' },
    { key: 'atendido', label: 'Atendido', color: '#F97316', icon: 'fa-stethoscope' },
    { key: 'orcamento_criado', label: 'Orçamento criado', color: '#8B5CF6', icon: 'fa-file-invoice-dollar' },
    { key: 'orcamento_aprovado', label: 'Orçamento aprovado', color: '#06B6D4', icon: 'fa-circle-check' },
    { key: 'orcamento_perdido', label: 'Orçamento perdido', color: '#EF4444', icon: 'fa-circle-xmark' },
]

const ORIGENS = ['Instagram', 'Facebook', 'Google Ads', 'Indicação', 'WhatsApp', 'Site', 'Outros']

function LeadCard({ lead }) {
    const etapa = ETAPAS.find(e => e.key === lead.etapa) || ETAPAS[0]
    return (
        <div style={{
            background: 'white',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            marginBottom: 8,
            cursor: 'pointer',
            transition: 'box-shadow 0.15s',
        }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</div>
                <span style={{ background: etapa.color + '22', color: etapa.color, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
                    {etapa.label}
                </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 10 }}>
                {lead.phone && <span><i className="fa-solid fa-phone" style={{ marginRight: 3 }} />{lead.phone}</span>}
                {lead.origem && <span><i className="fa-solid fa-share-nodes" style={{ marginRight: 3 }} />{lead.origem}</span>}
            </div>
            {lead.valor_orcamento > 0 && (
                <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginTop: 4 }}>
                    R$ {Number(lead.valor_orcamento).toFixed(2)}
                </div>
            )}
        </div>
    )
}

function Placeholder({ title }) {
    return (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-box-open" style={{ fontSize: 48, marginBottom: 20 }} />
            <h2 style={{ fontSize: 24, fontWeight: 600 }}>{title}</h2>
            <p style={{ fontSize: 16 }}>Em breve, novas funcionalidades para você!</p>
        </div>
    )
}

export default function Marketing() {
    const navigate = useNavigate()
    const location = useLocation()
    const currentTab = location.pathname.split('/').pop() || 'funil'

    const [leads, setLeads] = useState([])
    const [loading, setLoading] = useState(true)
    const [modal, setModal] = useState(false)
    const [form, setForm] = useState({ name: '', phone: '', email: '', origem: 'Instagram', etapa: 'lead', valor_orcamento: '', observacoes: '' })
    const [saving, setSaving] = useState(false)

    // Filtros de período
    const [periodo, setPeriodo] = useState({
        inicio: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        fim: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })

    const loadLeads = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('leads')
            .select('*')
            .gte('created_at', periodo.inicio + 'T00:00:00')
            .lte('created_at', periodo.fim + 'T23:59:59')
            .order('created_at', { ascending: false })
        setLeads(data || [])
        setLoading(false)
    }, [periodo])

    useEffect(() => {
        const timer = setTimeout(() => { loadLeads() }, 0)
        return () => clearTimeout(timer)
    }, [loadLeads])

    async function handleSave() {
        if (!form.name) { alert('Nome é obrigatório'); return }
        setSaving(true)
        try {
            const { error } = await supabase.from('leads').insert([{
                ...form,
                valor_orcamento: Number(form.valor_orcamento) || 0
            }])

            if (error) {
                console.error('Erro ao salvar lead:', error)
                alert('Erro ao cadastrar lead: ' + (error.message || 'Verifique os dados.'))
                setSaving(false)
                return
            }

            alert('Lead cadastrado com sucesso!')
            setSaving(false)
            setModal(false)
            setForm({ name: '', phone: '', email: '', origem: 'Instagram', etapa: 'lead', valor_orcamento: '', observacoes: '' })
            loadLeads()
        } catch (err) {
            console.error('Erro crítico no marketing:', err)
            alert('Erro inesperado ao salvar lead.')
            setSaving(false)
        }
    }

    const leadsByEtapa = (etapa) => leads.filter(l => l.etapa === etapa)

    const badgeStyle = {
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 10
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Marketing / CRM</h1>
                    <div className="page-subtitle">{leads.length} leads no período selecionado</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                        <i className="fa-solid fa-calendar" style={{ fontSize: 13, color: 'var(--text-muted)' }} />
                        <input type="date" className="form-control-clean" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} style={{ border: 'none', fontSize: 12, padding: 0, width: 110 }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>até</span>
                        <input type="date" className="form-control-clean" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} style={{ border: 'none', fontSize: 12, padding: 0, width: 110 }} />
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(leads, 'leads_marketing.csv')}>
                        <i className="fa-solid fa-file-excel" /> Exportar
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal(true)} id="btn-novo-lead">
                        <i className="fa-solid fa-plus" /> Novo Lead
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <div className={`tab${currentTab === 'funil' ? ' active' : ''}`} onClick={() => navigate('/marketing/funil')}>
                    <i className="fa-solid fa-filter" style={{ marginRight: 6 }} />Funil de Leads
                </div>
                <div className={`tab${currentTab === 'lista' ? ' active' : ''}`} onClick={() => navigate('/marketing/lista')}>
                    <i className="fa-solid fa-list" style={{ marginRight: 6 }} />Lista
                </div>
                <div className={`tab${currentTab === 'whatsapp' ? ' active' : ''}`} onClick={() => navigate('/marketing/whatsapp')}>
                    <i className="fa-solid fa-brands fa-whatsapp" style={{ marginRight: 6 }} />WhatsApp Automático
                </div>
                <div className={`tab${currentTab === 'campanhas' ? ' active' : ''}`} onClick={() => navigate('/marketing/campanhas')}>
                    <i className="fa-solid fa-bullhorn" style={{ marginRight: 6 }} />Campanhas
                </div>
            </div>

            {
                loading ? (
                    <div className="loading" > <div className="spinner" /></div>
                ) : (
                    <Routes>
                        <Route path="funil" element={(
                            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
                                {ETAPAS.map(etapa => {
                                    const etapaLeads = leadsByEtapa(etapa.key)
                                    return (
                                        <div key={etapa.key} style={{ minWidth: 220, flex: '0 0 220px' }}>
                                            <div style={{
                                                background: etapa.color + '15',
                                                border: `2px solid ${etapa.color}30`,
                                                borderRadius: 'var(--radius-lg)',
                                                padding: '10px 12px',
                                                marginBottom: 8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <i className={`fa-solid ${etapa.icon}`} style={{ color: etapa.color, fontSize: 13 }} />
                                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: etapa.color }}>{etapa.label}</span>
                                                </div>
                                                <span style={{ background: etapa.color, color: 'white', fontSize: 11, fontWeight: 700, borderRadius: 10, padding: '1px 7px' }}>
                                                    {etapaLeads.length}
                                                </span>
                                            </div>
                                            <div>
                                                {etapaLeads.map(lead => (
                                                    <LeadCard key={lead.id} lead={lead} />
                                                ))}
                                                {etapaLeads.length === 0 && (
                                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '16px 0' }}>Sem leads</div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )} />
                        <Route path="lista" element={(
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Nome</th><th>Telefone</th><th>Origem</th><th>Etapa</th><th>Orçamento</th><th>Criado em</th></tr></thead>
                                    <tbody>
                                        {leads.map(l => {
                                            const et = ETAPAS.find(e => e.key === l.etapa) || ETAPAS[0]
                                            return (
                                                <tr key={l.id}>
                                                    <td><strong>{l.name}</strong></td>
                                                    <td>{l.phone || '—'}</td>
                                                    <td>{l.origem || '—'}</td>
                                                    <td><span style={{ background: et.color + '22', color: et.color, ...badgeStyle }}>{et.label}</span></td>
                                                    <td>{l.valor_orcamento > 0 ? `R$ ${Number(l.valor_orcamento).toFixed(2)}` : '—'}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{format(new Date(l.created_at), 'dd/MM/yyyy')}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )} />
                        <Route path="whatsapp" element={<WhatsAppAutomativo />} />
                        <Route path="campanhas" element={<Placeholder title="Campanhas de Marketing" />} />
                        <Route path="*" element={<Navigate to="funil" replace />} />
                    </Routes>
                )
            }

            {/* Modal Novo Lead */}
            {
                modal && (
                    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
                        <div className="modal modal-md">
                            <div className="modal-header">
                                <div className="modal-title"><i className="fa-solid fa-user-plus" style={{ marginRight: 8, color: 'var(--primary)' }} />Novo Lead</div>
                                <button className="modal-close" onClick={() => setModal(false)}><i className="fa-solid fa-xmark" /></button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid form-grid-2">
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="form-label">Nome *</label>
                                        <input className="form-control" placeholder="Nome do lead" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Telefone / WhatsApp</label>
                                        <input className="form-control" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">E-mail</label>
                                        <input type="email" className="form-control" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Origem</label>
                                        <select className="form-control" value={form.origem} onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}>
                                            {ORIGENS.map(o => <option key={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Etapa inicial</label>
                                        <select className="form-control" value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value }))}>
                                            {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Valor do orçamento</label>
                                        <input type="number" className="form-control" placeholder="R$ 0,00" value={form.valor_orcamento} onChange={e => setForm(p => ({ ...p, valor_orcamento: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label className="form-label">Observações</label>
                                        <textarea className="form-control" rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Salvando...' : <><i className="fa-solid fa-plus" /> Cadastrar Lead</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

function WhatsAppAutomativo() {
    const [config, setConfig] = useState({
        habilitar: true,
        enviarEmNome: 'Clínica',
        antecedencia: '24 horas',
        remarcarAuto: 'Não',
        subtab: 'confirmacao'
    })

    const subtabs = [
        { key: 'confirmacao', label: 'Confirmação de consulta' },
        { key: 'lembrete', label: 'Lembrete de consulta' },
        { key: 'aniversario', label: 'Mensagem de aniversário' },
        { key: 'atrasadas', label: 'Lembrete de parcelas atrasadas' },
    ]

    return (
        <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-light)' }}>
                <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
                    {subtabs.map(s => (
                        <div
                            key={s.key}
                            className={`tab${config.subtab === s.key ? ' active' : ''}`}
                            style={{ fontSize: 12, padding: '15px 10px' }}
                            onClick={() => setConfig(p => ({ ...p, subtab: s.key }))}
                        >
                            {s.label}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, padding: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Habilitar confirmação de consulta</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Envie automaticamente mensagens de confirmação e evite esquecimentos.</p>
                        </div>
                        <div
                            style={{
                                width: 44,
                                height: 22,
                                background: config.habilitar ? 'var(--primary)' : '#D1D5DB',
                                borderRadius: 11,
                                position: 'relative',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                            onClick={() => setConfig(p => ({ ...p, habilitar: !p.habilitar }))}
                        >
                            <div style={{
                                width: 18,
                                height: 18,
                                background: 'white',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: 2,
                                left: config.habilitar ? 24 : 2,
                                transition: '0.2s'
                            }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ maxWidth: 300 }}>
                        <label className="form-label">Enviar em nome de:</label>
                        <select className="form-control" value={config.enviarEmNome} onChange={e => setConfig(p => ({ ...p, enviarEmNome: e.target.value }))}>
                            <option>Clínica</option>
                            <option>Dr. Responsável</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ marginBottom: 12 }}>Selecione o tempo de antecedência para envio da mensagem de confirmação de consulta</label>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {['24 horas', '48 horas', '72 horas'].map(t => (
                                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input type="radio" checked={config.antecedencia === t} onChange={() => setConfig(p => ({ ...p, antecedencia: t }))} />
                                    {t}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ marginBottom: 12 }}>Deseja dar a opção do paciente remarcar a consulta automaticamente quando ele desmarcar via WhatsApp automático?</label>
                        <div style={{ display: 'flex', gap: 20 }}>
                            {['Sim', 'Não'].map(t => (
                                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input type="radio" checked={config.remarcarAuto === t} onChange={() => setConfig(p => ({ ...p, remarcarAuto: t }))} />
                                    {t}
                                </label>
                            ))}
                        </div>
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 20, background: '#F9FAFB', padding: 12, borderRadius: 8 }}>
                        <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
                        O horário de envio pode variar dependendo do fuso horário da sua região.
                    </p>
                </div>

                <div style={{ background: '#E5E7EB', borderRadius: 20, padding: '12px', border: '8px solid #1F2937', height: 'fit-content' }}>
                    <div style={{ background: '#ECE5DD', borderRadius: 12, height: 440, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ background: '#075E54', padding: '10px 12px', color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                                <i className="fa-solid fa-user" style={{ fontSize: 14 }} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Dental Office</div>
                        </div>
                        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{
                                background: 'white',
                                padding: 12,
                                borderRadius: '0 8px 8px 8px',
                                maxWidth: '90%',
                                fontSize: 11,
                                boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ color: '#075E54', fontWeight: 700, marginBottom: 4 }}>Dental Office</div>
                                Olá Daniel, você tem consulta na Clínica Feliz, dia 12/11/2025 às 17:00. Você confirma sua presença?<br /><br />
                                Para mais informações ligue para:<br /><br />
                                Tel: 1112345678<br />
                                Até breve!
                                <div style={{ textAlign: 'right', fontSize: 9, color: '#999', marginTop: 4 }}>12:53</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                <div style={{ background: 'white', padding: '8px', borderRadius: 20, textAlign: 'center', fontSize: 11, color: '#00a884', fontWeight: 600, border: '1px solid #eee', cursor: 'pointer' }}>
                                    <i className="fa-solid fa-check" style={{ marginRight: 6 }} /> Confirmar
                                </div>
                                <div style={{ background: 'white', padding: '8px', borderRadius: 20, textAlign: 'center', fontSize: 11, color: '#ea4335', fontWeight: 600, border: '1px solid #eee', cursor: 'pointer' }}>
                                    <i className="fa-solid fa-calendar-xmark" style={{ marginRight: 6 }} /> Desmarcar
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-footer" style={{ borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', padding: '16px 24px' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        alert('Configurações de WhatsApp salvas com sucesso!')
                    }}
                >
                    Salvar Configurações
                </button>
            </div>
        </div>
    )
}

