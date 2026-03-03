import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

export default function ModalNovoPacienteSimples() {
    const [isOpen, setIsOpen] = useState(false)
    const [form, setForm] = useState({ name: '', birth_date: '', phone: '', email: '', cpf: '' })
    const [saving, setSaving] = useState(false)
    const toast = useToast()

    useEffect(() => {
        const handleOpen = () => setIsOpen(true)
        window.addEventListener('open-modal-paciente-simples', handleOpen)
        return () => window.removeEventListener('open-modal-paciente-simples', handleOpen)
    }, [])

    const handleSave = async (openWhatsApp = false) => {
        if (!form.name) return toast.warning('O nome é obrigatório.')
        setSaving(true)

        try {
            const dataToSave = {
                ...form,
                birth_date: form.birth_date || null,
                last_contact: new Date().toISOString()
            }

            const { data, error } = await supabase.from('patients').insert([dataToSave]).select()

            if (error) {
                console.error('Erro ao salvar paciente:', error)
                if (error.code === '23505') {
                    toast.error('Já existe um paciente cadastrado com este telefone.')
                } else {
                    toast.error('Erro ao cadastrar paciente: ' + (error.message || 'Verifique os dados.'))
                }
                setSaving(false)
                return
            }

            const novoPaciente = data?.[0]
            setSaving(false)
            setIsOpen(false)
            setForm({ name: '', birth_date: '', phone: '', email: '', cpf: '' })
            window.dispatchEvent(new CustomEvent('patient-added'))
            toast.success('Paciente cadastrado com sucesso!')

            if (openWhatsApp && novoPaciente?.phone) {
                const phone = novoPaciente.phone.replace(/\D/g, '')
                window.open(`https://wa.me/55${phone}`, '_blank')
            }
        } catch (err) {
            console.error('Erro crítico no cadastro rápido:', err)
            toast.error('Erro inesperado ao salvar.')
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsOpen(false)}>
            <div className="modal modal-sm" style={{ paddingBottom: 0 }}>
                <div className="modal-header" style={{ marginBottom: 0 }}>
                    <div className="modal-title">NOVO PACIENTE</div>
                    <button className="modal-close" onClick={() => setIsOpen(false)}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="modal-body" style={{ textAlign: 'center', paddingTop: 10 }}>
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                        <div style={{
                            width: 100,
                            height: 100,
                            background: '#F3F4F6',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto'
                        }}>
                            <i className="fa-solid fa-user" style={{ fontSize: 40, color: '#D1D5DB' }} />
                        </div>
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            background: 'white',
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            cursor: 'pointer'
                        }}>
                            <i className="fa-solid fa-camera" style={{ fontSize: 14, color: '#6B7280' }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">Nome *</label>
                        <input
                            className="form-control"
                            style={{ borderColor: 'var(--primary-light)' }}
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nome completo"
                            autoFocus
                        />
                    </div>

                    <div className="form-grid form-grid-2">
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label className="form-label">Nascimento</label>
                            <input
                                type="date"
                                className="form-control"
                                value={form.birth_date}
                                onChange={e => setForm(p => ({ ...p, birth_date: e.target.value }))}
                            />
                        </div>
                        <div className="form-group" style={{ textAlign: 'left' }}>
                            <label className="form-label">Telefone</label>
                            <input
                                className="form-control"
                                value={form.phone}
                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label">E-mail</label>
                        <input
                            className="form-control"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="exemplo@email.com"
                        />
                    </div>

                    <div className="form-group" style={{ textAlign: 'left', marginBottom: 24 }}>
                        <label className="form-label">CPF</label>
                        <input
                            className="form-control"
                            value={form.cpf}
                            onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))}
                            placeholder="000.000.000-00"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                        <button className="btn btn-outline" style={{ fontSize: 12, color: '#25D366', borderColor: '#25D366' }} onClick={() => handleSave(true)} disabled={saving}>
                            <i className="fa-brands fa-whatsapp" /> Salvar e Zap
                        </button>
                        <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={saving} onClick={() => handleSave(false)}>
                            {saving ? 'Gravando...' : 'Salvar apenas'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
