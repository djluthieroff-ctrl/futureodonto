import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameMonth,
    addMonths,
    subMonths,
    isSameDay
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { exportToCSV } from '../../utils/export'

export default function RelatorioMensalDetalhado() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState({ detailedRows: [], summaryRows: [] })
    const [activeTab, setActiveTab] = useState('mensal') // 'mensal' ou 'detalhado'

    const handleExport = () => {
        if (activeTab === 'detalhado') {
            const exportData = data.detailedRows.map(d => ({
                'Data': format(d.data, 'dd/MM/yyyy'),
                'Nome': d.nome,
                'Status': d.status,
                'Ação/Resultado': d.acao,
                'Procedimento': d.procedimento,
                'Valor Venda': d.valor
            }))
            const fileName = `Relatorio_Detalhado_${format(currentDate, 'MMMM_yyyy', { locale: ptBR })}.csv`
            exportToCSV(exportData, fileName)
        } else {
            const exportData = data.summaryRows.map(d => ({
                'Data': format(d.data, 'dd/MM/yyyy'),
                'Dia da Semana': d.diaSemana,
                'Agendamentos Criados': d.criados,
                'Visitas Previstas': d.previstos,
                'Compareceram': d.compareceram,
                'Vendas': d.vendas
            }))
            const fileName = `Relatorio_Mensal_${format(currentDate, 'MMMM_yyyy', { locale: ptBR })}.csv`
            exportToCSV(exportData, fileName)
        }
    }

    const loadData = useCallback(async () => {
        setLoading(true)
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)

        try {
            const [
                { data: agendamentosData, error: agError },
                { data: receitasData, error: recError }
            ] = await Promise.all([
                supabase
                    .from('agendamentos')
                    .select('*, patients(name)')
                    .or(`data_inicio.gte.${monthStart.toISOString()},data_inicio.lte.${monthEnd.toISOString()},created_at.gte.${monthStart.toISOString()},created_at.lte.${monthEnd.toISOString()}`)
                    .order('data_inicio', { ascending: true }),
                supabase
                    .from('financeiro_receitas')
                    .select('*, patients(name)')
                    .gte('created_at', monthStart.toISOString())
                    .lte('created_at', monthEnd.toISOString())
            ])

            if (agError) throw agError
            if (recError) throw recError

            const agendamentos = agendamentosData || []
            const receitas = receitasData || []

            // 1. Detalhado (Rows based on appointment in month)
            const detailedRows = agendamentos
                .filter(ag => isSameMonth(new Date(ag.data_inicio), monthStart))
                .map(ag => {
                    const dataAg = new Date(ag.data_inicio)
                    const vendaVinculada = receitas.find(r => r.paciente_id === ag.paciente_id && isSameDay(new Date(r.created_at), dataAg))
                    let status = 'Agendado', acao = 'Agendamento', cor = 'transparent'
                    if (ag.situacao === 'atendido') { status = 'Compareceu'; acao = 'Comparecimento'; cor = '#D1E9FF' }
                    if (vendaVinculada || ag.tipo === 'venda') { status = 'Venda Fechada'; acao = 'Venda Fechada'; cor = '#DCFCE7' } // Changed status to Venda Fechada
                    return {
                        id: `ag-${ag.id}`,
                        data: dataAg,
                        nome: ag.patients?.name || 'Paciente não informado',
                        status, acao, procedimento: ag.motivo || 'Avaliação',
                        valor: vendaVinculada ? Number(vendaVinculada.valor_total) : (ag.valor || 0),
                        cor
                    }
                })

            // 2. Resumo (Daily metrics)
            const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
            const summaryRows = days.map(day => {
                return {
                    data: day,
                    diaSemana: format(day, 'EEEE', { locale: ptBR }),
                    criados: agendamentos.filter(ag => isSameDay(new Date(ag.created_at), day)).length,
                    previstos: agendamentos.filter(ag => isSameMonth(new Date(ag.data_inicio), monthStart) && isSameDay(new Date(ag.data_inicio), day)).length,
                    compareceram: agendamentos.filter(ag => ag.situacao === 'atendido' && isSameDay(new Date(ag.data_inicio), day)).length,
                    vendas: receitas.filter(r => isSameDay(new Date(r.created_at), day)).length + agendamentos.filter(ag => ag.tipo === 'venda' && isSameDay(new Date(ag.data_inicio), day)).length
                }
            })

            setData({ detailedRows, summaryRows })
        } catch (error) {
            console.error('Erro ao carregar relatorio:', error)
            setData({ detailedRows: [], summaryRows: [] })
        } finally {
            setLoading(false)
        }
    }, [currentDate])

    useEffect(() => { loadData() }, [loadData])

    // Estilos Inline Compactos (Spreadsheet style)
    const cellStyle = { padding: '4px 8px', border: '1px solid #cbd5e1', fontSize: '11.5px', color: '#1e293b' }
    const headerStyle = { ...cellStyle, background: '#f1f5f9', fontWeight: 'bold', textAlign: 'left', color: '#475569' }

    return (
        <div className="relatorio-mensal-container" style={{ background: '#f8fafc', minHeight: '100vh', padding: '20px' }}>
            {/* Header / Selector */}
            <div style={{ background: '#fff', borderRadius: '8px', padding: '15px', border: '1px solid #e2e8f0', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn btn-clean icon-only"><i className="fa-solid fa-chevron-left" /></button>
                        <span style={{ fontWeight: 800, fontSize: '16px', textTransform: 'capitalize' }}>{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn btn-clean icon-only"><i className="fa-solid fa-chevron-right" /></button>
                    </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleExport}><i className="fa-solid fa-file-excel" /> Exportar para Excel</button>
            </div>

            {/* Abas Estilo Excel */}
            <div style={{ display: 'flex', gap: '2px', paddingLeft: '5px' }}>
                <div
                    onClick={() => setActiveTab('mensal')}
                    style={{
                        padding: '6px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        background: activeTab === 'mensal' ? '#fff' : '#e2e8f0',
                        border: '1px solid #cbd5e1', borderBottom: activeTab === 'mensal' ? 'none' : '1px solid #cbd5e1',
                        borderTopLeftRadius: '4px', borderTopRightRadius: '4px'
                    }}
                >
                    Relatório Mensal
                </div>
                <div
                    onClick={() => setActiveTab('detalhado')}
                    style={{
                        padding: '6px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        background: activeTab === 'detalhado' ? '#fff' : '#e2e8f0',
                        border: '1px solid #cbd5e1', borderBottom: activeTab === 'detalhado' ? 'none' : '1px solid #cbd5e1',
                        borderTopLeftRadius: '4px', borderTopRightRadius: '4px'
                    }}
                >
                    Relatório Detalhado
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0', minHeight: '600px', overflowX: 'auto' }}>
                {loading ? <div className="loading"><div className="spinner" /></div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                            {activeTab === 'mensal' ? (
                                <tr>
                                    <th style={headerStyle}>Data</th>
                                    <th style={headerStyle}>Dia da Semana</th>
                                    <th style={headerStyle}>Agendamentos Criados</th>
                                    <th style={headerStyle}>Visitas Previstas</th>
                                    <th style={headerStyle}>Compareceram</th>
                                    <th style={headerStyle}>Vendas</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={headerStyle}>Data</th>
                                    <th style={headerStyle}>Nome</th>
                                    <th style={headerStyle}>Status</th>
                                    <th style={headerStyle}>Ação/Resultado</th>
                                    <th style={headerStyle}>Procedimento/Interesse</th>
                                    <th style={{ ...headerStyle, textAlign: 'right' }}>Valor Venda</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {activeTab === 'mensal' ? data.summaryRows.map((row, i) => (
                                <tr key={i}>
                                    <td style={cellStyle}>{format(row.data, 'dd/MM/yyyy')}</td>
                                    <td style={cellStyle}>{row.diaSemana}</td>
                                    <td style={{ ...cellStyle, textAlign: 'center' }}>{row.criados}</td>
                                    <td style={{ ...cellStyle, textAlign: 'center' }}>{row.previstos}</td>
                                    <td style={{ ...cellStyle, textAlign: 'center' }}>{row.compareceram}</td>
                                    <td style={{ ...cellStyle, textAlign: 'center' }}>{row.vendas}</td>
                                </tr>
                            )) : data.detailedRows.map((row, i) => (
                                <tr key={i} style={{ background: row.cor }}>
                                    <td style={cellStyle}>{format(row.data, 'dd/MM/yyyy')}</td>
                                    <td style={{ ...cellStyle, fontWeight: 500 }}>{row.nome}</td>
                                    <td style={cellStyle}>{row.status}</td>
                                    <td style={cellStyle}>{row.acao}</td>
                                    <td style={cellStyle}>{row.procedimento}</td>
                                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{row.valor > 0 ? `R$ ${row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '0'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
