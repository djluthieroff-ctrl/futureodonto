
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const oldUrl = 'https://nattzmznfwknejnwjdrd.supabase.co'
const oldKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdHR6bXpuZndrbmVqbndqZHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDQ2NjIsImV4cCI6MjA4NzE4MDY2Mn0.fGAVN3823nXVPUuS2ISJzf9BGFJny2fviwLWgP4i6LU'

const newUrl = process.env.VITE_SUPABASE_URL
const newKey = process.env.VITE_SUPABASE_ANON_KEY

const oldSupabase = createClient(oldUrl, oldKey)
const newSupabase = createClient(newUrl, newKey)

async function migrateLeads() {
    console.log('Iniciando migração de leads...')

    // Buscar todos os usuários do projeto antigo (para encontrar onde estão os leads)
    // Como não podemos listar usuários facilmente sem admin key, vamos tentar buscar leads sem filtro de user_id
    // Se o RLS estiver habilitado e for por user_id, o anon key só verá o que for permitido.
    // Mas no script consolidated_schema.sql, as políticas são "USING (true)", então devemos ver tudo.

    const { data: leads, error: fetchError } = await oldSupabase
        .from('leads')
        .select('*')

    if (fetchError) {
        console.error('Erro ao buscar leads do projeto antigo:', fetchError)
        return
    }

    if (!leads || leads.length === 0) {
        console.log('Nenhum lead encontrado com a chave atual. Tentando buscar de outras tabelas ou sem RLS...')
        // Tentar buscar de patients caso tenham sido convertidos
        const { data: patients } = await oldSupabase.from('patients').select('*')
        console.log(`Encontrados ${patients?.length || 0} pacientes.`)
        return
    }

    console.log(`Encontrados ${leads.length} leads no projeto antigo.`)

    const mappedLeads = leads.map(l => ({
        name: l.name || 'Sem nome',
        phone: l.phone,
        email: l.email,
        source: l.source || l.channel || 'Importado',
        message: l.message,
        type: l.type || 'rede_social',
        etapa: l.status === 'new' ? 'lead' : (l.status === 'scheduled' ? 'consulta_agendada' : 'lead'),
        data_desejada: l.visit_date || l.scheduled_at,
        created_at: l.created_at
    }))

    // Inserir no novo projeto
    const { data: inserted, error: insertError } = await newSupabase
        .from('leads')
        .insert(mappedLeads)
        .select()

    if (insertError) {
        console.error('Erro ao inserir leads no novo projeto:', insertError)
        return
    }

    console.log(`Migração concluída com sucesso! ${inserted.length} leads importados.`)
}

migrateLeads()
