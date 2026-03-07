import { supabase } from './supabase'

export async function syncUsuarioSistema(user) {
    if (!user?.id || !user?.email) return
    // Desativado temporariamente para evitar erros 400/403 no console
    // devido a falta de permissões RLS ou tabela inexistente em alguns ambientes.
    /*
    try {
        for (const current of tryPayloads) {
            const { error } = await supabase.from('usuarios_sistema').upsert(current)
            if (!error) return
        }
    } catch {}
    */
}

export async function registrarAuditoria({ acao, modulo, detalhes = null, user = null }) {
    if (!acao || !modulo) return

    let currentUser = user
    if (!currentUser) {
        const { data } = await supabase.auth.getUser()
        currentUser = data?.user || null
    }

    const nome =
        currentUser?.user_metadata?.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.email ||
        'Usuario'

    const payload = {
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || null,
        user_nome: nome,
        modulo,
        acao,
        detalhes,
    }

    try {
        await supabase.from('auditoria_logs').insert(payload)
        // Ignorar falha silenciosamente para não poluir console do usuário
    } catch {
        // Silenciar erros de rede ou permissão
    }
}



