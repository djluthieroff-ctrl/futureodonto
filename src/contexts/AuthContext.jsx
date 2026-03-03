import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'
import { registrarAuditoria, syncUsuarioSistema } from '../lib/auditoria'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Buscar sessão atual
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session)
                setUser(session?.user ?? null)
                if (session?.user) {
                    syncUsuarioSistema(session.user)
                }
            })
            .catch(err => {
                console.error('Erro ao buscar sessão:', err)
            })
            .finally(() => {
                setLoading(false)
            })

        // Escutar mudanças de autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
            if (session?.user) {
                syncUsuarioSistema(session.user)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setSession(data?.session ?? null)
        setUser(data?.user ?? null)
        setLoading(false)
        if (data?.user) {
            await syncUsuarioSistema(data.user)
            await registrarAuditoria({
                acao: 'Login no sistema',
                modulo: 'Auth',
                detalhes: `Usuario autenticado: ${data.user.email}`,
                user: data.user,
            })
        }
        return data
    }

    const signUp = async (email, password, metadata = {}) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: metadata }
        })
        if (error) throw error
        if (data?.user) {
            await syncUsuarioSistema(data.user)
            await registrarAuditoria({
                acao: 'Conta criada',
                modulo: 'Auth',
                detalhes: `Novo usuario: ${email}`,
                user: data.user,
            })
        }
        return data
    }

    const signOut = async () => {
        const userEmail = user?.email || 'usuario'
        if (user) {
            await registrarAuditoria({
                acao: 'Logout do sistema',
                modulo: 'Auth',
                detalhes: `Usuario encerrou sessao: ${userEmail}`,
                user,
            })
        }
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    const resetPassword = async (email) => {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`
        })
        if (error) throw error
        return data
    }

    const value = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
