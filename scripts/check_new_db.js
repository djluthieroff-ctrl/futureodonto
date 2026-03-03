
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const newUrl = process.env.VITE_SUPABASE_URL
const newKey = process.env.VITE_SUPABASE_ANON_KEY
const newSupabase = createClient(newUrl, newKey)

async function checkNewLeads() {
    const { count, error } = await newSupabase
        .from('leads')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Erro ao verificar leads:', error)
    } else {
        console.log(`O novo projeto tem ${count} leads na tabela 'leads'.`)
    }
}

checkNewLeads()
