import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { format, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import '../../styles/chat.css'

const MEU_USUARIO = { nome: 'Administrador', iniciais: 'AL', cor: '#7C3AED' }

// Função auxiliar para formatar horário
function formatMsgTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    if (isToday(d)) return format(d, 'HH:mm')
    if (isYesterday(d)) return `Ontem ${format(d, 'HH:mm')}`
    return format(d, 'dd/MM HH:mm')
}

function formatDivider(ts) {
    const d = new Date(ts)
    if (isToday(d)) return 'Hoje'
    if (isYesterday(d)) return 'Ontem'
    return format(d, "dd 'de' MMMM", { locale: ptBR })
}

function shouldShowDivider(msgs, i) {
    if (i === 0) return true
    const curr = new Date(msgs[i].criado_em)
    const prev = new Date(msgs[i - 1].criado_em)
    return curr.toDateString() !== prev.toDateString()
}

export default function ChatInterno() {
    const [open, setOpen] = useState(false)
    const [canais, setCanais] = useState([])
    const [canalAtivo, setCanalAtivo] = useState(null)
    const [mensagens, setMensagens] = useState([])
    const [texto, setTexto] = useState('')
    const [unread, setUnread] = useState(0)
    const [sending, setSending] = useState(false)
    const bottomRef = useRef(null)
    const inputRef = useRef(null)
    const subRef = useRef(null)

    useEffect(() => {
        const handleToggle = () => setOpen(o => !o)
        window.addEventListener('toggle-chat', handleToggle)
        return () => window.removeEventListener('toggle-chat', handleToggle)
    }, [])

    useEffect(() => {
        if (open) {
            setUnread(0)
            setTimeout(() => scrollBottom(), 100)
            setTimeout(() => inputRef.current?.focus(), 150)
        }
    }, [open, canalAtivo])

    function scrollBottom(smooth = false) {
        bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    }

    const loadCanais = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('chat_canais').select('*').order('nome')
            if (error) throw error
            setCanais(data || [])
            if (data?.length > 0) setCanalAtivo(prev => prev || data[0])
        } catch (error) {
            console.error('Erro ao carregar canais:', error)
        }
    }, [])

    const loadMensagens = useCallback(async (canalId) => {
        try {
            const { data, error } = await supabase
                .from('chat_mensagens')
                .select('*')
                .eq('canal_id', canalId)
                .order('criado_em', { ascending: true })
                .limit(100)
            if (error) throw error
            setMensagens(data || [])
            setTimeout(() => scrollBottom(), 80)
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error)
        }
    }, [])

    const setupRealtime = useCallback((canalId) => {
        if (subRef.current) subRef.current.unsubscribe()
        subRef.current = supabase
            .channel(`chat_${canalId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_mensagens',
                filter: `canal_id=eq.${canalId}`
            }, (payload) => {
                setMensagens(prev => [...prev, payload.new])
                setTimeout(() => scrollBottom(true), 50)
                if (!open) setUnread(n => n + 1)
            })
            .subscribe()
    }, [open])

    useEffect(() => {
        loadCanais()
    }, [loadCanais])

    useEffect(() => {
        if (canalAtivo) {
            loadMensagens(canalAtivo.id)
            setupRealtime(canalAtivo.id)
        }
        return () => { if (subRef.current) subRef.current.unsubscribe() }
    }, [canalAtivo, loadMensagens, setupRealtime])

    async function enviarMensagem() {
        const txt = texto.trim()
        if (!txt || !canalAtivo) return
        setSending(true)
        setTexto('')
        await supabase.from('chat_mensagens').insert({
            canal_id: canalAtivo.id,
            usuario_nome: MEU_USUARIO.nome,
            usuario_iniciais: MEU_USUARIO.iniciais,
            usuario_cor: MEU_USUARIO.cor,
            conteudo: txt,
            tipo: 'texto',
        })
        setSending(false)
        inputRef.current?.focus()
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            enviarMensagem()
        }
    }

    const isMeu = (msg) => msg.usuario_nome === MEU_USUARIO.nome

    return (
        <>
            {/* Botão flutuante */}
            <button
                className="chat-fab"
                onClick={() => setOpen(o => !o)}
                id="chat-interno-btn"
                title="Chat Interno"
            >
                <i className={`fa-solid ${open ? 'fa-xmark' : 'fa-comment-dots'}`} />
                {unread > 0 && !open && (
                    <span className="chat-fab-badge">{unread}</span>
                )}
            </button>

            {/* Painel do Chat */}
            {open && (
                <div className="chat-panel">
                    {/* Header */}
                    <div className="chat-header">
                        <div className="chat-header-left">
                            <div className="chat-header-icon">
                                <i className="fa-solid fa-comment-dots" />
                            </div>
                            <div>
                                <div className="chat-header-title">Chat Interno</div>
                                <div className="chat-header-sub">Equipe da clínica</div>
                            </div>
                        </div>
                        <button className="chat-header-close" onClick={() => setOpen(false)}>
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>

                    <div className="chat-body">
                        {/* Sidebar de canais */}
                        <div className="chat-sidebar">
                            <div className="chat-sidebar-section">Canais</div>
                            {canais.map(c => (
                                <div
                                    key={c.id}
                                    className={`chat-canal${canalAtivo?.id === c.id ? ' active' : ''}`}
                                    onClick={() => setCanalAtivo(c)}
                                    id={`chat-canal-${c.nome}`}
                                >
                                    <i className={`fa-solid ${c.icone}`} style={{ color: canalAtivo?.id === c.id ? 'white' : c.cor, fontSize: 12, width: 16, textAlign: 'center' }} />
                                    <span># {c.nome}</span>
                                </div>
                            ))}
                        </div>

                        {/* Área de mensagens */}
                        <div className="chat-main">
                            {/* Título do canal */}
                            <div className="chat-canal-header">
                                <i className={`fa-solid ${canalAtivo?.icone}`} style={{ color: canalAtivo?.cor, marginRight: 6, fontSize: 13 }} />
                                <strong># {canalAtivo?.nome}</strong>
                                {canalAtivo?.descricao && (
                                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>— {canalAtivo.descricao}</span>
                                )}
                            </div>

                            {/* Mensagens */}
                            <div className="chat-messages" id="chat-messages-area">
                                {mensagens.length === 0 && (
                                    <div className="chat-empty">
                                        <i className="fa-solid fa-comment-slash" style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }} />
                                        <div>Nenhuma mensagem ainda.</div>
                                        <div style={{ fontSize: 12, marginTop: 4 }}>Seja o primeiro a falar em #{canalAtivo?.nome}!</div>
                                    </div>
                                )}
                                {mensagens.map((msg, i) => {
                                    const meu = isMeu(msg)
                                    const showDiv = shouldShowDivider(mensagens, i)
                                    const showAvatar = i === 0 || mensagens[i - 1].usuario_nome !== msg.usuario_nome || showDiv
                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDiv && (
                                                <div className="chat-date-divider">
                                                    <span>{formatDivider(msg.criado_em)}</span>
                                                </div>
                                            )}
                                            <div className={`chat-message${meu ? ' meu' : ''}`}>
                                                {!meu && showAvatar && (
                                                    <div
                                                        className="chat-avatar"
                                                        style={{ background: msg.usuario_cor }}
                                                    >
                                                        {msg.usuario_iniciais}
                                                    </div>
                                                )}
                                                {!meu && !showAvatar && <div className="chat-avatar-spacer" />}
                                                <div className="chat-bubble-group">
                                                    {showAvatar && !meu && (
                                                        <div className="chat-sender">
                                                            <strong>{msg.usuario_nome}</strong>
                                                            <span className="chat-time">{formatMsgTime(msg.criado_em)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`chat-bubble${meu ? ' meu' : ''}`}>
                                                        {msg.conteudo}
                                                        {meu && (
                                                            <span className="chat-time-inside">{formatMsgTime(msg.criado_em)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {/* Input */}
                            <div className="chat-input-area">
                                <textarea
                                    ref={inputRef}
                                    className="chat-input"
                                    placeholder={`Mensagem em #${canalAtivo?.nome}... (Enter para enviar)`}
                                    value={texto}
                                    onChange={e => setTexto(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    id="chat-message-input"
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={enviarMensagem}
                                    disabled={!texto.trim() || sending}
                                    id="chat-send-btn"
                                >
                                    <i className="fa-solid fa-paper-plane" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
