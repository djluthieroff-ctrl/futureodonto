import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import ChatInterno from '../Chat/ChatInterno'
import ModalNovoPacienteSimples from '../Pacientes/ModalNovoPacienteSimples'

export default function Layout() {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="main-content">
                <Header />
                <div className="page-content">
                    <Outlet />
                </div>
            </div>
            <ChatInterno />
            <ModalNovoPacienteSimples />
        </div>
    )
}
