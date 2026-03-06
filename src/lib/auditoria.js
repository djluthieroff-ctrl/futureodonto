import { supabase } from './supabase'
import { ADMIN_EMAIL } from './authz'

export async function syncUsuarioSistema(user) {
    if (!user?.id || !user?.email) return

    const nome =
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email

    const payload = {
        id: user.id,
        email: user.email,
        nome,
        role: user.email?.toLowerCase() === ADMIN_EMAIL ? 'admin' : (user.user_metadata?.role || 'usuario'),
        ultimo_acesso: new Date().toISOString(),
        ativo: true,
    }

    // Desativado temporariamente para evitar erros 400/403 no console
    // devido a falta de permissões RLS ou tabela inexistente em alguns ambientes.
    /*
    try {
        for (const current of tryPayloads) {
            const { error } = await supabase.from('usuarios_sistema').upsert(current)
            if (!error) return
        }
    } catch (e) {}
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
        const { error } = await supabase.from('auditoria_logs').insert(payload)
        // Ignorar falha silenciosamente para não poluir console do usuário
    } catch (e) {
        // Silenciar erros de rede ou permissão
    }
}
