/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type }])
        if (duration > 0) {
            setTimeout(() => removeToast(id), duration)
        }
        return id
    }, [removeToast])

    const toast = {
        success: (msg, duration) => addToast(msg, 'success', duration),
        error: (msg, duration) => addToast(msg, 'error', duration ?? 6000),
        info: (msg, duration) => addToast(msg, 'info', duration),
        warning: (msg, duration) => addToast(msg, 'warning', duration),
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
    return ctx
}

const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
}

const colors = {
    success: { bg: '#F0FDF4', border: '#86EFAC', icon: '#16A34A', text: '#166534' },
    error: { bg: '#FEF2F2', border: '#FCA5A5', icon: '#DC2626', text: '#7F1D1D' },
    warning: { bg: '#FFFBEB', border: '#FCD34D', icon: '#D97706', text: '#78350F' },
    info: { bg: '#EFF6FF', border: '#93C5FD', icon: '#2563EB', text: '#1E3A5F' },
}

function ToastItem({ toast, onRemove }) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true))
    }, [])

    const c = colors[toast.type] || colors.info

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: '12px 14px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                minWidth: 280,
                maxWidth: 380,
                transform: visible ? 'translateX(0)' : 'translateX(110%)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.3s cubic-bezier(.16,1,.3,1), opacity 0.3s ease',
                cursor: 'default',
            }}
        >
            <i className={`fa-solid ${icons[toast.type]}`} style={{ color: c.icon, fontSize: 16, marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: c.text, fontWeight: 500, lineHeight: 1.4 }}>
                {toast.message}
            </div>
            <button
                onClick={() => onRemove(toast.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.icon, padding: 0, lineHeight: 1, flexShrink: 0, opacity: 0.7 }}
            >
                <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
            </button>
        </div>
    )
}

function ToastContainer({ toasts, onRemove }) {
    if (toasts.length === 0) return null
    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
        }}>
            {toasts.map(t => (
                <div key={t.id} style={{ pointerEvents: 'auto' }}>
                    <ToastItem toast={t} onRemove={onRemove} />
                </div>
            ))}
        </div>
    )
}
