
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const oldUrl = 'https://nattzmznfwknejnwjdrd.supabase.co'
const oldKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hdHR6bXpuZndrbmVqbndqZHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDQ2NjIsImV4cCI6MjA4NzE4MDY2Mn0.fGAVN3823nXVPUuS2ISJzf9BGFJny2fviwLWgP4i6LU'

const oldSupabase = createClient(oldUrl, oldKey)

async function checkTables() {
    console.log('Verificando tabelas no projeto antigo...')

    // Tentar listar tabelas via RPC ou apenas tentar buscar de várias comuns
    const tables = ['leads', 'patients', 'agendamentos', 'appointments', 'old_patients']

    for (const table of tables) {
        const { data, error, count } = await oldSupabase
            .from(table)
            .select('*', { count: 'exact', head: true })

        if (error) {
            console.log(`Tabela ${table}: Não encontrada ou erro (${error.message})`)
        } else {
            console.log(`Tabela ${table}: Encontrada com ${count} registros.`)
            if (count > 0) {
                const { data: samples } = await oldSupabase.from(table).select('*').limit(1)
                console.log(`Amostra de ${table}:`, JSON.stringify(samples[0], null, 2))
            }
        }
    }
}

checkTables()
