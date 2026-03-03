
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const oldUrl = 'https://nattzmznfwknejnwjdrd.supabase.co'
const oldKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdHR6bXpuZndrbmVqbndqZHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDQ2NjIsImV4cCI6MjA4NzE4MDY2Mn0.fGAVN3823nXVPUuS2ISJzf9BGFJny2fviwLWgP4i6LU'

const oldSupabase = createClient(oldUrl, oldKey)

async function findLeads() {
    console.log('Buscando leads em todos os usuários...')

    // Tentar buscar de unisoft_sync que parece ser onde os leads externos caem
    const { data: syncData, error: syncError, count } = await oldSupabase
        .from('unisoft_sync')
        .select('*', { count: 'exact' })

    if (syncError) {
        console.log('Erro ao buscar unisoft_sync:', syncError.message)
    } else {
        console.log(`unisoft_sync tem ${count} registros.`)
        if (count > 0) {
            console.log('Amostra unisoft_sync:', JSON.stringify(syncData.slice(0, 2), null, 2))
        }
    }

    // Tentar buscar leads novamente mas sem filtro nenhum (o anon key pode estar barrado pelo RLS se não estiver logado)
    // Mas as políticas que vi no supabase.js sugerem que ele usa currentUser.id.
    // Se não houver política para anon ver tudo, não veremos nada.
}

findLeads()
