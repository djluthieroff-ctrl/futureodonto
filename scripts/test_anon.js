
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const newUrl = process.env.VITE_SUPABASE_URL
const newKey = process.env.VITE_SUPABASE_ANON_KEY
const newSupabase = createClient(newUrl, newKey)

async function createLeadsViaAuth() {
    console.log('Tentando logar para criar leads...')
    const email = 'gustavogolec138@gmail.com'
    // Como não tenho a senha, vou tentar criar um usuário ou usar o anon se a política permitir.
    // Mas a política "public_insert_leads" deveria permitir anon.

    // Tentar criar um lead com campos ABSOLUTAMENTE mínimos para anon
    const { data, error } = await newSupabase
        .from('leads')
        .insert([{ name: 'Teste Anon' }])
        .select()

    if (error) {
        console.error('Erro no teste anon:', error)
    } else {
        console.log('Sucesso no teste anon!')
    }
}

createLeadsViaAuth()
