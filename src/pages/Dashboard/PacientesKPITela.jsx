import React from 'react'
import { Link, useParams } from 'react-router-dom'
import PacientesKPI from './PacientesKPI'

const KPI_CONFIG = {
    aniversariantes: {
        titulo: 'Aniversariantes do mes',
        descricao: 'Pacientes que fazem aniversario neste mes',
        cor: '#F59E0B',
    },
    nao_agendaram: {
        titulo: 'Quem nao agendou',
        descricao: 'Pacientes sem agendamento nos ultimos 6 meses',
        cor: '#6366F1',
    },
    faltaram_desmarcaram: {
        titulo: 'Faltaram ou desmarcaram',
        descricao: 'Pacientes que faltaram ou desmarcaram nos ultimos 30 dias',
        cor: '#EF4444',
    },
    nao_confirmados: {
        titulo: 'Agendamentos não confirmados',
        descricao: 'Pacientes com agendamento pendente nas próximas 48 horas',
        cor: '#F97316',
    },
}

export default function PacientesKPITela() {
    const { tipo } = useParams()
    const config = KPI_CONFIG[tipo]

    if (!config) {
        return (
            <div className="card">
                <div className="empty-state">
                    <i className="fa-solid fa-circle-exclamation empty-state-icon" />
                    <h3>KPI nao encontrado</h3>
                    <p>Selecione um indicador valido no Painel ou no CRM.</p>
                    <Link to="/painel" className="btn btn-primary" style={{ marginTop: 10 }}>
                        Voltar ao painel
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pacientes por KPI</h1>
                    <p className="page-subtitle">{config.titulo}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Link to="/crm/painel" className="btn btn-secondary">
                        <i className="fa-solid fa-chart-line" /> CRM
                    </Link>
                    <Link to="/painel" className="btn btn-outline">
                        <i className="fa-solid fa-house" /> Painel
                    </Link>
                </div>
            </div>

            <PacientesKPI
                tipo={tipo}
                titulo={config.titulo}
                descricao={config.descricao}
                cor={config.cor}
            />
        </div>
    )
}
