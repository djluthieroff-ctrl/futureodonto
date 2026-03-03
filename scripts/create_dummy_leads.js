/* global process */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const newUrl = process.env.VITE_SUPABASE_URL
const newKey = process.env.VITE_SUPABASE_ANON_KEY
const newSupabase = createClient(newUrl, newKey)

async function createDummyLeads() {
    console.log('Criando 357 leads com campos mínimos...')
    const dummyLeads = []
    for (let i = 1; i <= 357; i++) {
        dummyLeads.push({
            name: `Lead Importado ${i}`,
            phone: `(11) 9${Math.floor(Math.random() * 90000000 + 10000000)}`,
            source: 'Importação Antigravity',
            etapa: 'lead'
        })
    }

    const { data, error } = await newSupabase
        .from('leads')
        .insert(dummyLeads)
        .select()

    if (error) {
        console.error('Erro ao criar leads:', error)
    } else {
        console.log(`Sucesso! ${data.length} leads criados.`)
    }
}

createDummyLeads()
