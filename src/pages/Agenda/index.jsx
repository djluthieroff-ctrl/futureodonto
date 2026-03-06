import React, { useState, useRef, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { supabase } from '../../lib/supabase'
import { format, addDays, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ModalAgendamento from './ModalAgendamento'
import { useToast } from '../../components/ui/Toast'
import '../../styles/agenda-moderna.css'
import '../../styles/agenda-vertical.css'

export default function Agenda({ defaultView = 'calendar' }) {
    const calendarRef = useRef(null)
    const toast = useToast()
    const [eventos, setEventos] = useState([])
    const [dentistas, setDentistas] = useState([])
    const [cadeiras, setCadeiras] = useState([])
    const [dentistaSelecionado, setDentistaSelecionado] = useState('')
    const [viewMode, setViewMode] = useState('timeGridWeek')
    const [viewType, setViewType] = useState(defaultView)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [modal, setModal] = useState({ open: false, data: null, evento: null })

    useEffect(() => {
        setViewType(defaultView)
    }, [defaultView])

    // Correção da dependência circular: loadConfigs não depende de dentistaSelecionado
    // usamos uma ref para saber se já setamos o dentista inicial
    const dentistaSelecionadoInitialized = useRef(false)

    const loadConfigs = useCallback(async () => {
        const [{ data: d }, { data: c }] = await Promise.all([
            supabase.from('dentistas').select('id,nome,cor').eq('ativo', true),
            supabase.from('cadeiras').select('id,nome').eq('ativa', true),
        ])
        setDentistas(d || [])
        setCadeiras(c || [])
        // Só define o dentista inicial na primeira carga
        if (d?.length > 0 && !dentistaSelecionadoInitialized.current) {
            dentistaSelecionadoInitialized.current = true
            setDentistaSelecionado(d[0].id)
        }
    }, []) // sem dependência de dentistaSelecionado

    const getSituacaoColor = (sit) => {
        const map = {
            agendado: '#818CF8',
            confirmado: '#34D399',
            atendido: '#60A5FA',
            faltou: '#F87171',
            desmarcou: '#FB923C',
            cancelado: '#9CA3AF',
        }
        return map[sit] || '#818CF8'
    }

    const loadEventos = useCallback(async () => {
        try {
            let q = supabase
                .from('agendamentos')
                .select('id,data_inicio,data_fim,motivo,situacao,observacoes,paciente_id,dentista_id,patients(name,phone)')

            if (dentistaSelecionado) q = q.eq('dentista_id', dentistaSelecionado)

            const { data, error } = await q
            if (error) {
                console.error('Erro ao carregar agendamentos:', error)
                return
            }
            const evs = (data || []).map(a => ({
                id: a.id,
                title: a.patients?.name || 'Paciente',
                start: a.data_inicio,
                end: a.data_fim,
                backgroundColor: getSituacaoColor(a.situacao),
                borderColor: 'transparent',
                extendedProps: a,
            }))
            setEventos(evs)
        } catch (err) {
            console.error('Erro crítico ao carregar eventos:', err)
        }
    }, [dentistaSelecionado])

    useEffect(() => {
        loadConfigs()
    }, [loadConfigs])

    useEffect(() => {
        loadEventos()
    }, [loadEventos])

    const handlePrev = () => {
        if (viewType === 'calendar') {
            calendarRef.current.getApi().prev()
            setCurrentDate(calendarRef.current.getApi().getDate())
        } else {
            setCurrentDate(prev => addDays(prev, -1))
        }
    }

    const handleNext = () => {
        if (viewType === 'calendar') {
            calendarRef.current.getApi().next()
            setCurrentDate(calendarRef.current.getApi().getDate())
        } else {
            setCurrentDate(prev => addDays(prev, 1))
        }
    }

    const handleToday = () => {
        if (viewType === 'calendar') {
            calendarRef.current.getApi().today()
            setCurrentDate(calendarRef.current.getApi().getDate())
        } else {
            setCurrentDate(new Date())
        }
    }

    const handleViewChange = (view) => {
        setViewMode(view)
        if (viewType === 'calendar') {
            calendarRef.current.getApi().changeView(view)
        }
    }

    const handleDateClick = (arg) => {
        setModal({ open: true, data: arg.dateStr, evento: null })
    }

    const handleEventClick = (info) => {
        setModal({ open: true, data: null, evento: info.event.extendedProps })
    }

    const handleModalClose = () => {
        setModal({ open: false, data: null, evento: null })
        loadEventos()
    }

    // Drag & drop salva no banco
    const handleEventDrop = async (info) => {
        const { event } = info
        try {
            const { error } = await supabase
                .from('agendamentos')
                .update({
                    data_inicio: event.start.toISOString(),
                    data_fim: event.end ? event.end.toISOString() : new Date(event.start.getTime() + 60 * 60000).toISOString(),
                })
                .eq('id', event.id)

            if (error) {
                info.revert()
                toast.error('Erro ao mover agendamento: ' + (error.message || ''))
            } else {
                toast.success('Agendamento remarcado com sucesso!')
                loadEventos()
            }
        } catch {
            info.revert()
            toast.error('Erro inesperado ao mover agendamento.')
        }
    }

    const updateSituacao = async (id, novaSituacao) => {
        try {
            const { error } = await supabase
                .from('agendamentos')
                .update({ situacao: novaSituacao })
                .eq('id', id)
            if (error) throw error
            toast.success('Situação atualizada!')
            loadEventos()
        } catch (err) {
            console.error('Erro ao atualizar situação:', err)
            toast.error('Erro ao atualizar situação')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Deseja realmente excluir este agendamento?')) return
        try {
            const { error } = await supabase.from('agendamentos').delete().eq('id', id)
            if (error) throw error
            toast.success('Agendamento excluído.')
            loadEventos()
        } catch (err) {
            console.error('Erro ao excluir agendamento:', err)
            toast.error('Erro ao excluir agendamento')
        }
    }

    const renderHeader = () => {
        return (
            <div className="modern-agenda-header">
                <div className="header-left">
                    <h1 className="header-title">Agenda</h1>
                    <div className="header-nav">
                        <button className="nav-btn" onClick={handlePrev}><i className="fa-solid fa-chevron-left" /></button>
                        <button className="nav-btn-today" onClick={handleToday}>Hoje</button>
                        <button className="nav-btn" onClick={handleNext}><i className="fa-solid fa-chevron-right" /></button>
                    </div>
                    <span className="header-date-range" style={{ textTransform: 'capitalize' }}>
                        {viewMode === 'timeGridWeek' ? (
                            `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd')} a ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd \'de\' MMMM', { locale: ptBR })}`
                        ) : (
                            format(currentDate, 'EEEE, d \'de\' MMMM', { locale: ptBR })
                        )}
                    </span>
                </div>

                <div className="header-right">
                    <div className="dentista-selector">
                        <i className="fa-solid fa-user-doctor" />
                        <select value={dentistaSelecionado} onChange={e => setDentistaSelecionado(e.target.value)}>
                            <option value="">Todos os Dentistas</option>
                            {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                        </select>
                    </div>
                    {viewType === 'calendar' && (
                        <div className="view-switcher">
                            <button className={viewMode === 'timeGridDay' ? 'active' : ''} onClick={() => handleViewChange('timeGridDay')}>Dia</button>
                            <button className={viewMode === 'timeGridWeek' ? 'active' : ''} onClick={() => handleViewChange('timeGridWeek')}>Semana</button>
                        </div>
                    )}
                    <button className="btn-new-appointment" onClick={() => setModal({ open: true, data: new Date().toISOString(), evento: null })}>
                        <i className="fa-solid fa-plus" />
                        Novo Agendamento
                    </button>
                </div>
            </div>
        )
    }

    const eventosDoDia = eventos.filter(e => isSameDay(parseISO(e.start), currentDate))
        .sort((a, b) => a.start.localeCompare(b.start))

    const kpis = {
        total: eventosDoDia.length,
        concluidos: eventosDoDia.filter(e => e.extendedProps.situacao === 'atendido').length,
        pendentes: eventosDoDia.filter(e => e.extendedProps.situacao === 'agendado' || e.extendedProps.situacao === 'confirmado').length
    }

    const renderVerticalView = () => {
        return (
            <div className="agenda-vertical-container">
                <div className="agenda-header">
                    <div className="agenda-title-section">
                        <h1>Agendamentos</h1>
                        <p>Gerencie consultas e procedimentos</p>
                    </div>
                    <div className="header-right">
                        <div className="dentista-selector" style={{ marginRight: 12 }}>
                            <i className="fa-solid fa-user-doctor" />
                            <select value={dentistaSelecionado} onChange={e => setDentistaSelecionado(e.target.value)}>
                                <option value="">Todos os Dentistas</option>
                                {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                            </select>
                        </div>
                        <button className="btn-novo-agendamento" onClick={() => setModal({ open: true, data: currentDate.toISOString(), evento: null })}>
                            <i className="fa-solid fa-plus" /> Novo Agendamento
                        </button>
                    </div>
                </div>

                <div className="agenda-controls">
                    <div className="date-nav">
                        <button className="nav-arrow" onClick={handlePrev}><i className="fa-solid fa-chevron-left" /></button>
                        <div className="current-date-display" style={{ textTransform: 'capitalize' }}>
                            {format(currentDate, "EEEE, d 'De' MMMM", { locale: ptBR })}
                        </div>
                        <button className="nav-arrow" onClick={handleNext}><i className="fa-solid fa-chevron-right" /></button>

                        <div className="date-picker-wrapper">
                            <input
                                type="date"
                                className="date-input"
                                value={format(currentDate, 'yyyy-MM-dd')}
                                onChange={(e) => setCurrentDate(parseISO(e.target.value))}
                            />
                            <button className="btn-hoje" onClick={handleToday}>Hoje</button>
                        </div>
                    </div>

                    <div className="kpi-cards">
                        <div className="kpi-card total">
                            <span className="kpi-value">{kpis.total}</span>
                            <span className="kpi-label">Total</span>
                        </div>
                        <div className="kpi-card concluidos">
                            <span className="kpi-value">{kpis.concluidos}</span>
                            <span className="kpi-label">Concluídos</span>
                        </div>
                        <div className="kpi-card pendentes">
                            <span className="kpi-value">{kpis.pendentes}</span>
                            <span className="kpi-label">Pendentes</span>
                        </div>
                    </div>
                </div>

                <div className="appointments-list">
                    {eventosDoDia.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            Nenhum agendamento para este dia.
                        </div>
                    ) : (
                        eventosDoDia.map(ev => {
                            const data = ev.extendedProps
                            const startTime = format(parseISO(ev.start), 'HH:mm')
                            return (
                                <div className="appointment-row" key={ev.id}>
                                    <div className="appointment-time">{startTime}</div>
                                    <div className={`appointment-card ${data.situacao}`}>
                                        <div className="status-badge">{data.situacao}</div>
                                        <div className="appointment-main-info">
                                            <h3 className="patient-name">{data.patients?.name || 'Paciente'}</h3>
                                            <div className="appointment-details">
                                                <span>{data.motivo || 'Consulta'}</span>
                                                <span>•</span>
                                                <span>60 min</span>
                                            </div>
                                            {data.observacoes && (
                                                <div className="appointment-note">"{data.observacoes}"</div>
                                            )}
                                        </div>
                                        <div className="appointment-actions">
                                            <button className="btn-action btn-whatsapp" onClick={() => window.open(`https://wa.me/55${data.patients?.phone?.replace(/\D/g, '')}`, '_blank')}>
                                                <i className="fa-brands fa-whatsapp" /> WhatsApp
                                            </button>
                                            <button className="btn-action btn-remarcar" onClick={() => setModal({ open: true, data: null, evento: data })}>
                                                <i className="fa-solid fa-calendar-days" /> Remarcar
                                            </button>
                                            <button className="btn-action btn-edit" onClick={() => setModal({ open: true, data: null, evento: data })}>
                                                <i className="fa-solid fa-pencil" />
                                            </button>
                                            <button className="btn-action btn-confirmar" onClick={() => updateSituacao(ev.id, 'confirmado')}>
                                                <i className="fa-solid fa-check" /> Confirmar
                                            </button>
                                            <button className="btn-action btn-atendido" onClick={() => updateSituacao(ev.id, 'atendido')}>
                                                <i className="fa-solid fa-user-check" /> Atendido
                                            </button>
                                            <button className="btn-action btn-delete" onClick={() => handleDelete(ev.id)}>
                                                <i className="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="modern-agenda-container" style={{ padding: viewType === 'vertical' ? 0 : 20 }}>
            {viewType === 'calendar' && renderHeader()}

            {viewType === 'calendar' ? (
                <div className="modern-calendar-wrapper">
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[timeGridPlugin, interactionPlugin]}
                        locale={ptBrLocale}
                        initialView={viewMode}
                        headerToolbar={false}
                        events={eventos}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                        eventDrop={handleEventDrop}
                        selectable
                        selectMirror
                        slotMinTime="08:00:00"
                        slotMaxTime="19:00:00"
                        slotDuration="00:15:00"
                        slotLabelInterval="00:30:00"
                        slotLabelFormat={{
                            hour: '2-digit',
                            minute: '2-digit',
                            omitZeroMinute: false,
                            meridiem: false
                        }}
                        allDaySlot={false}
                        height="100%"
                        nowIndicator
                        editable
                        dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'long' }}
                        dayHeaderContent={(args) => (
                            <div className="custom-modern-header">
                                <span className="weekday">{format(args.date, 'EEEE', { locale: ptBR })}</span>
                                <span className="daynum">{format(args.date, 'dd')}</span>
                            </div>
                        )}
                        eventClassNames="modern-event"
                        slotClassNames="modern-slot"
                        eventContent={(eventInfo) => (
                            <div className="modern-event-content">
                                <div className="event-time">{format(eventInfo.event.start, 'HH:mm')}</div>
                                <div className="event-title">{eventInfo.event.title}</div>
                            </div>
                        )}
                    />
                </div>
            ) : renderVerticalView()}

            {modal.open && (
                <ModalAgendamento
                    dataInicial={modal.data}
                    eventoExistente={modal.evento}
                    dentistas={dentistas}
                    cadeiras={cadeiras}
                    onClose={handleModalClose}
                />
            )}
        </div>
    )
}
