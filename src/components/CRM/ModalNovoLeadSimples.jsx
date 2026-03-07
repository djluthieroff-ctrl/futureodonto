import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

export default function ModalNovoLeadSimples() {
    const [isOpen, setIsOpen] = useState(false)
    const [form, setForm] = useState({ name: '', phone: '', email: '', source: 'Manual' })
    const [saving, setSaving] = useState(false)
    const toast = useToast()

    useEffect(() => {
        const handleOpen = () => setIsOpen(true)
        window.addEventListener('open-modal-lead-simples', handleOpen)
        return () => window.removeEventListener('open-modal-lead-simples', handleOpen)
    }, [])

    const handleSave = async () => {
        if (!form.name) return toast.warning('O nome é obrigatório.')
        setSaving(true)

        try {
            const { error } = await supabase.from('leads').insert([{
                ...form,
                etapa: 'lead',
                type: 'rede_social', // Padrao para cadastro manual
                created_at: new Date().toISOString()
            }])

            if (error) throw error

            toast.success('Lead cadastrado com sucesso!')
            setIsOpen(false)
            setForm({ name: '', phone: '', email: '', source: 'Manual' })
            // Opcional: disparar evento para atualizar listas se necessario
            window.dispatchEvent(new CustomEvent('lead-added'))
        } catch (err) {
            console.error('Erro ao salvar lead:', err)
            toast.error('Erro ao cadastrar lead.')
        } finally {
            setSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsOpen(false)}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <div className="modal-title">NOVO LEAD (AVALIAÇÃO)</div>
                    <button className="modal-close" onClick={() => setIsOpen(false)}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="modal-body">
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Use esta opção para pessoas que ainda não são pacientes e virão para uma avaliação.
                    </p>

                    <div className="form-group">
                        <label className="form-label">Nome Completo *</label>
                        <input
                            className="form-control"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nome do interessado"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Telefone / WhatsApp</label>
                        <input
                            className="form-control"
                            value={form.phone}
                            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="(00) 00000-0000"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">E-mail</label>
                        <input
                            className="form-control"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="exemplo@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Origem do contato</label>
                        <select
                            className="form-control"
                            value={form.source}
                            onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                        >
                            <option value="Manual">Manual / Balcão</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Facebook">Facebook</option>
                            <option value="Google">Google / Site</option>
                            <option value="Indicacao">Indicação</option>
                        </select>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Salvando...' : 'Criar Lead'}
                    </button>
                </div>
            </div>
        </div>
    )
}
