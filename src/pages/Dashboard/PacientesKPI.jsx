import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, subMonths, subDays, addDays } from 'date-fns'

export default function PacientesKPI({ tipo, titulo, descricao, cor }) {
    const [pacientes, setPacientes] = useState([])
    const [loading, setLoading] = useState(true)

    const loadPacientes = useCallback(async () => {
        setLoading(true)
        try {
            const today = format(new Date(), 'yyyy-MM-dd')
            const mesAtual = format(new Date(), 'MM')
            const prox72h = format(addDays(new Date(), 3), 'yyyy-MM-dd')
            const ha6meses = format(subMonths(new Date(), 6), 'yyyy-MM-dd')
            const ha30d = format(subDays(new Date(), 30), 'yyyy-MM-dd')

            switch (tipo) {
                case 'aniversariantes': {
                    const { data } = await supabase
                        .from('patients')
                        .select('id,name,birth_date,phone,email,last_contact,created_at')
                        .not('birth_date', 'is', null)

                    const aniversariantes = (data || []).filter((p) => p.birth_date?.split('-')[1] === mesAtual)
                    setPacientes(aniversariantes)
                    break
                }
                case 'nao_agendaram': {
                    const { data: agendamentosRecentes } = await supabase
                        .from('agendamentos')
                        .select('paciente_id')
                        .gte('data_inicio', ha6meses)

                    const idsRecentes = new Set(agendamentosRecentes?.map((a) => a.paciente_id) || [])

                    const { data: todosPacientes } = await supabase
                        .from('patients')
                        .select('id,name,birth_date,phone,email,last_contact,created_at')

                    const semAgendaRecente = (todosPacientes || []).filter((p) => !idsRecentes.has(p.id))
                    setPacientes(semAgendaRecente)
                    break
                }
                case 'faltaram_desmarcaram': {
                    const { data } = await supabase
                        .from('agendamentos')
                        .select('paciente_id,patients(name),patients(phone),patients(email),patients(birth_date),patients(last_contact),patients(created_at)')
                        .in('situacao', ['faltou', 'desmarcou'])
                        .gte('data_inicio', ha30d)

                    const unicos = new Map()
                    ;(data || []).forEach((a) => {
                        unicos.set(a.paciente_id, {
                            id: a.paciente_id,
                            name: a.patients?.name,
                            phone: a.patients?.phone,
                            email: a.patients?.email,
                            birth_date: a.patients?.birth_date,
                            last_contact: a.patients?.last_contact,
                            created_at: a.patients?.created_at,
                        })
                    })
                    setPacientes([...unicos.values()])
                    break
                }
                case 'nao_confirmados': {
                    const { data } = await supabase
                        .from('agendamentos')
                        .select('paciente_id,patients(name),patients(phone),patients(email),patients(birth_date),patients(last_contact),patients(created_at)')
                        .eq('situacao', 'agendado')
                        .gte('data_inicio', today)
                        .lte('data_inicio', `${prox72h}T23:59:59`)

                    const unicos = new Map()
                    ;(data || []).forEach((a) => {
                        unicos.set(a.paciente_id, {
                            id: a.paciente_id,
                            name: a.patients?.name,
                            phone: a.patients?.phone,
                            email: a.patients?.email,
                            birth_date: a.patients?.birth_date,
                            last_contact: a.patients?.last_contact,
                            created_at: a.patients?.created_at,
                        })
                    })
                    setPacientes([...unicos.values()])
                    break
                }
                default:
                    setPacientes([])
            }
        } catch (e) {
            console.error('Erro ao carregar pacientes:', e)
            setPacientes([])
        } finally {
            setLoading(false)
        }
    }, [tipo])

    useEffect(() => {
        loadPacientes()
    }, [loadPacientes])

    const formatarData = (data) => {
        if (!data) return '-'
        try {
            return format(new Date(data), 'dd/MM/yyyy')
        } catch {
            return data
        }
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
        <div className="card">
            <div className="card-header">
                <div>
                    <div className="card-title" style={{ color: cor }}>
                        <i className="fa-solid fa-users" style={{ marginRight: 8 }} />
                        {titulo}
                    </div>
                    <div className="card-subtitle">{descricao}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {loading ? 'Carregando...' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''}`}
                    </span>
                    <button className="btn btn-sm btn-outline" onClick={loadPacientes}>
                        <i className="fa-solid fa-rotate" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading" style={{ padding: '30px 20px' }}>
                    <div className="spinner" />
                </div>
            ) : pacientes.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                    <i className="fa-solid fa-check-circle empty-state-icon" style={{ color: 'var(--success)' }} />
                    <h3>Nenhum paciente encontrado</h3>
                    <p>{descricao}</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>Telefone</th>
                                <th>Email</th>
                                <th>Aniversario</th>
                                <th>Ultimo contato</th>
                                <th>Cadastro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pacientes.map((p) => (
                                <tr key={p.id}>
                                    <td>
                                        <strong>{p.name || '-'}</strong>
                                    </td>
                                    <td>{formatarTelefone(p.phone)}</td>
                                    <td>{p.email || '-'}</td>
                                    <td>{formatarData(p.birth_date)}</td>
                                    <td>{formatarData(p.last_contact)}</td>
                                    <td>{formatarData(p.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
