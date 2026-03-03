import React, { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
    {
        icon: 'fa-chart-line',
        label: 'CRM',
        path: '/crm',
        children: [
            { label: 'Dashboard', path: '/crm/dashboard' },
            { label: 'Leads', path: '/crm/leads' },
            { label: 'Aniversariantes', path: '/crm/kpis/aniversariantes' },
            { label: 'Quem não agendou', path: '/crm/kpis/nao_agendaram' },
            { label: 'Faltaram/Desmarcaram', path: '/crm/kpis/faltaram_desmarcaram' },
            { label: 'Não confirmados', path: '/crm/kpis/nao_confirmados' },
        ],
    },
    {
        icon: 'fa-gauge-high',
        label: 'Painel',
        path: '/painel',
    },
    {
        icon: 'fa-calendar',
        label: 'Agenda',
        path: '/agenda',
        children: [
            { label: 'Calendário', path: '/agenda' },
            { label: 'Agenda Vertical', path: '/agenda/vertical' },
            { label: 'Alerta de retorno', path: '/agenda/alerta-retorno' },
            { label: 'Lista de espera', path: '/agenda/lista-espera' },
        ],
    },
    {
        icon: 'fa-users',
        label: 'Pacientes',
        path: '/pacientes',
    },
    {
        icon: 'fa-dollar-sign',
        label: 'Financeiro',
        path: '/financeiro',
        children: [
            { label: 'Contas a receber', path: '/financeiro/receitas' },
            { label: 'Contas a pagar', path: '/financeiro/despesas' },
            { label: 'Fluxo de caixa', path: '/financeiro/fluxo' },
        ],
    },
    {
        icon: 'fa-bullhorn',
        label: 'Marketing',
        path: '/marketing',
        children: [
            { label: 'Funil de Leads', path: '/marketing/funil' },
            { label: 'Lista de Leads', path: '/marketing/lista' },
            { label: 'WhatsApp Automatico', path: '/marketing/whatsapp' },
            { label: 'Campanhas', path: '/marketing/campanhas' },
        ],
    },
    {
        icon: 'fa-toolbox',
        label: 'Ferramentas',
        path: '/ferramentas',
        children: [
            { label: 'Contatos', path: '/ferramentas/contatos' },
            { label: 'Auditoria', path: '/ferramentas/auditoria' },
            { label: 'Estoque', path: '/ferramentas/estoque' },
            { label: 'Servicos proteticos', path: '/ferramentas/proteticos' },
        ],
    },
    {
        icon: 'fa-chart-bar',
        label: 'Relatorios',
        path: '/relatorios',
        children: [
            { label: 'Atendimentos', path: '/relatorios/atendimentos' },
            { label: 'Financeiro', path: '/relatorios/financeiro' },
            { label: 'Mensal Detalhado', path: '/relatorios/detalhado' },
        ],
    },
    {
        icon: 'fa-sliders',
        label: 'Personalizar',
        path: '/personalizar',
        children: [
            { label: 'Dados da clinica', path: '/personalizar/clinica' },
            { label: 'Dentistas', path: '/personalizar/dentistas' },
            { label: 'Usuarios e permissoes', path: '/personalizar/usuarios' },
            { label: 'Horarios', path: '/personalizar/horarios' },
        ],
    },
    { icon: 'fa-gift', label: 'Indicacao premiada', path: '/indicacao' },
]

export default function Sidebar() {
    const location = useLocation()
    const [openMenus, setOpenMenus] = useState({ '/crm': true, '/painel': true, '/agenda': true })

    const activeParents = useMemo(() => {
        const next = {}
        NAV_ITEMS.forEach((item) => {
            if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
                next[item.path] = true
            }
        })
        return next
    }, [location.pathname])

    const toggleMenu = (path) => {
        setOpenMenus((prev) => ({ ...prev, [path]: !prev[path] }))
    }

    const isActive = (path) => {
        if (path === '/agenda') {
            return location.pathname === '/agenda'
        }
        return location.pathname === path || location.pathname.startsWith(`${path}/`)
    }
    const isSubActive = (path) => location.pathname === path

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <i className="fa-solid fa-tooth" />
                </div>
                <div>
                    <div className="sidebar-logo-text">OdontoCRM</div>
                    <div className="sidebar-logo-sub">Gestao odontologica</div>
                </div>
            </div>

            <div className="sidebar-search">
                <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 12 }} />
                <span>Localizar paciente</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.6 }}>ctrl+K</span>
            </div>

            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const hasChildren = item.children && item.children.length > 0
                    const active = isActive(item.path)
                    const isOpen = openMenus[item.path] || activeParents[item.path]

                    return (
                        <div key={item.path}>
                            {hasChildren ? (
                                <div className={`nav-item${active ? ' active' : ''}${isOpen ? ' open' : ''}`} onClick={() => toggleMenu(item.path)}>
                                    <span className="nav-item-icon">
                                        <i className={`fa-solid ${item.icon}`} />
                                    </span>
                                    <span className="nav-item-text">{item.label}</span>
                                    <i className="fa-solid fa-chevron-right nav-item-arrow" />
                                </div>
                            ) : (
                                <Link to={item.path} className={`nav-item${active ? ' active' : ''}`}>
                                    <span className="nav-item-icon">
                                        <i className={`fa-solid ${item.icon}`} />
                                    </span>
                                    <span className="nav-item-text">{item.label}</span>
                                </Link>
                            )}

                            {hasChildren && (
                                <div className={`nav-subitems${isOpen ? ' open' : ''}`}>
                                    {item.children.map((sub) => (
                                        <Link key={sub.path} to={sub.path} className={`nav-subitem${isSubActive(sub.path) ? ' active' : ''}`}>
                                            <i className="fa-solid fa-circle" style={{ fontSize: 5 }} />
                                            {sub.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </nav>

            <div className="sidebar-footer">
                <button className="sidebar-chat-btn" onClick={() => window.dispatchEvent(new CustomEvent('toggle-chat'))}>
                    <i className="fa-solid fa-comment-dots" />
                    <span>Chat interno</span>
                </button>
            </div>
        </aside>
    )
}
