import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'

export default function AgendamentoOnline() {
    const [config, setConfig] = useState({
        habilitado: false,
        link: '',
        mensagem: 'Agende sua consulta online',
        horarios: [],
        dias: []
    })
    const [pacientes, setPacientes] = useState([])
    const [pacienteSearch, setPacienteSearch] = useState('')
    const [pacienteSelecionado, setPacienteSelecionado] = useState(null)
    const [dataSelecionada, setDataSelecionada] = useState('')
    const [horarioSelecionado, setHorarioSelecionado] = useState('')
    const [dentistaSelecionado, setDentistaSelecionado] = useState('')
    const [dentistas, setDentistas] = useState([])
    const [cadeiras, setCadeiras] = useState([])
    const [motivo, setMotivo] = useState('consulta')
    const [observacoes, setObservacoes] = useState('')
    const [status, setStatus] = useState('')

    const loadConfig = useCallback(async () => {
        try {
            const { data: configData } = await supabase
                .from('config_agendamento_online')
                .select('*')
                .single()

            if (configData) {
                setConfig(configData)
            }

            const [{ data: d }, { data: c }] = await Promise.all([
                supabase.from('dentistas').select('id,nome,cor').eq('ativo', true),
                supabase.from('cadeiras').select('id,nome').eq('ativa', true),
            ])
            setDentistas(d || [])
            setCadeiras(c || [])
        } catch (e) {
            console.error('Erro ao carregar configura��es:', e)
        }
    }, [])

    useEffect(() => {
        loadConfig()
    }, [loadConfig])

    const searchPacientes = useCallback(async (q) => {
        if (!q || q.length < 3) {
            setPacientes([])
            return
        }
        const { data } = await supabase
            .from('patients')
            .select('id,name,phone,email')
            .ilike('name', `%${q}%`)
            .limit(10)
        setPacientes(data || [])
    }, [])

    const handlePacienteSelect = (paciente) => {
        setPacienteSelecionado(paciente)
        setPacienteSearch(paciente.name)
        setPacientes([])
    }

    const handleSaveConfig = async () => {
        try {
            await supabase.from('config_agendamento_online').upsert([config], { onConflict: 'id' })
            setStatus('Configurações salvas com sucesso!')
            setTimeout(() => setStatus(''), 3000)
        } catch (e) {
            console.error('Erro ao salvar configurações:', e)
            setStatus('Erro ao salvar configurações')
        }
    }

    const handleAgendar = async () => {
        if (!pacienteSelecionado) {
            alert('Selecione um paciente')
            return
        }
        if (!dataSelecionada) {
            alert('Selecione uma data')
            return
        }
        if (!horarioSelecionado) {
            alert('Selecione um horário')
            return
        }
        if (!dentistaSelecionado) {
            alert('Selecione um dentista')
            return
        }

        const dataHoraInicio = new Date(`${dataSelecionada}T${horarioSelecionado}`).toISOString()
        const dataHoraFim = new Date(new Date(dataHoraInicio).getTime() + 30 * 60000).toISOString()

        try {
            const { error } = await supabase.from('agendamentos').insert([{
                paciente_id: pacienteSelecionado.id,
                dentista_id: dentistaSelecionado,
                cadeira_id: cadeiras[0]?.id || null,
                data_inicio: dataHoraInicio,
                data_fim: dataHoraFim,
                motivo,
                situacao: 'agendado',
                observacoes
            }])

            if (error) throw error

            alert('Agendamento realizado com sucesso!')
            // Limpar formulário
            setPacienteSelecionado(null)
            setPacienteSearch('')
            setDataSelecionada('')
            setHorarioSelecionado('')
            setDentistaSelecionado('')
            setObservacoes('')
        } catch (e) {
            console.error('Erro ao agendar:', e)
            alert('Erro ao realizar agendamento')
        }
    }

    const gerarHorariosDisponiveis = () => {
        if (!dataSelecionada || !dentistaSelecionado) return []

        const horarios = config.horarios || []
        const diaSemana = new Date(dataSelecionada).getDay()
        const diasDisponiveis = config.dias || []

        if (!diasDisponiveis.includes(diaSemana)) return []

        return horarios
    }

    const formatarTelefone = (tel) => {
        if (!tel) return '-'
        const clean = tel.replace(/\D/g, '')
        if (clean.length === 11) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
        }
        if (clean.length === 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`
        }
        return tel
    }

    return (
        <div className="agendamento-online-container">
            <div className="page-header">
                <h1 className="page-title">Agendamento Online</h1>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={handleAgendar}>
                        <i className="fa-solid fa-calendar-plus" /> Agendar
                    </button>
                </div>
            </div>

            {status && (
                <div className="alert alert-success" style={{ marginBottom: 20 }}>
                    {status}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Configurações */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Configurações</div>
                            <div className="card-subtitle">Habilite e personalize o agendamento online</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Habilitar agendamento online</label>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={config.habilitado}
                                onChange={e => setConfig(p => ({ ...p, habilitado: e.target.checked }))}
                            />
                            <span className="slider" />
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Link de agendamento</label>
                        <input
                            className="form-control"
                            placeholder="https://suaclínica.com.br/agenda"
                            value={config.link}
                            onChange={e => setConfig(p => ({ ...p, link: e.target.value }))}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Mensagem de boas-vindas</label>
                        <textarea
                            className="form-control"
                            rows={3}
                            placeholder="Bem-vindo ao agendamento online..."
                            value={config.mensagem}
                            onChange={e => setConfig(p => ({ ...p, mensagem: e.target.value }))}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Horários disponíveis</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(h => (
                                <label key={h} className="checkbox">
                                    <input
                                        type="checkbox"
                                        checked={config.horarios?.includes(h) || false}
                                        onChange={e => {
                                            const horarios = config.horarios || []
                                            if (e.target.checked) {
                                                setConfig(p => ({ ...p, horarios: [...horarios, h] }))
                                            } else {
                                                setConfig(p => ({ ...p, horarios: horarios.filter(x => x !== h) }))
                                            }
                                        }}
                                    />
                                    <span>{h}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Dias disponíveis</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia, i) => (
                                <label key={i} className="checkbox">
                                    <input
                                        type="checkbox"
                                        checked={config.dias?.includes(i) || false}
                                        onChange={e => {
                                            const dias = config.dias || []
                                            if (e.target.checked) {
                                                setConfig(p => ({ ...p, dias: [...dias, i] }))
                                            } else {
                                                setConfig(p => ({ ...p, dias: dias.filter(x => x !== i) }))
                                            }
                                        }}
                                    />
                                    <span>{dia}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button className="btn btn-primary" onClick={handleSaveConfig}>
                            <i className="fa-solid fa-save" /> Salvar configurações
                        </button>
                    </div>
                </div>

                {/* Formulário de agendamento */}
                <div className="card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">Novo agendamento</div>
                            <div className="card-subtitle">Agende uma consulta para o paciente</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Paciente *</label>
                        <input
                            className="form-control"
                            placeholder="Buscar paciente..."
                            value={pacienteSearch}
                            onChange={e => { setPacienteSearch(e.target.value); searchPacientes(e.target.value) }}
                        />
                        {pacienteSearch && pacientes.length > 0 && !pacienteSelecionado && (
                            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'white', marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                                {pacientes.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => handlePacienteSelect(p)}
                                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-light)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    >
                                        <strong>{p.name}</strong> — {formatarTelefone(p.phone)} — {p.email || '-'}
                                    </div>
                                ))}
                            </div>
                        )}
                        {pacienteSelecionado && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--success)' }}>
                                <i className="fa-solid fa-check-circle" /> Paciente selecionado: <strong>{pacienteSelecionado.name}</strong>
                                <button type="button" onClick={() => { setPacienteSelecionado(null); setPacienteSearch('') }} style={{ marginLeft: 8, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>
                                    Trocar
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Data *</label>
                            <input
                                type="date"
                                className="form-control"
                                value={dataSelecionada}
                                onChange={e => setDataSelecionada(e.target.value)}
                                min={format(new Date(), 'yyyy-MM-dd')}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Horário *</label>
                            <select className="form-control" value={horarioSelecionado} onChange={e => setHorarioSelecionado(e.target.value)}>
                                <option value="">Selecione...</option>
                                {gerarHorariosDisponiveis().map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-grid form-grid-2">
                        <div className="form-group">
                            <label className="form-label">Dentista *</label>
                            <select className="form-control" value={dentistaSelecionado} onChange={e => setDentistaSelecionado(e.target.value)}>
                                <option value="">Selecione...</option>
                                {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Motivo</label>
                            <select className="form-control" value={motivo} onChange={e => setMotivo(e.target.value)}>
                                <option value="consulta">Consulta</option>
                                <option value="retorno">Retorno</option>
                                <option value="emergencia">Emergência</option>
                                <option value="procedimento">Procedimento</option>
                                <option value="avaliacao">Avaliação</option>
                                <option value="exame">Exame</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Observações</label>
                        <textarea className="form-control" rows={3} placeholder="Observações sobre o agendamento..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                    </div>
                </div>
            </div>
        </div>
    )
}

