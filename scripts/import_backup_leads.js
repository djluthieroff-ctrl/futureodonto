/* global process */
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env')
}

const backupPath = path.resolve(process.cwd(), 'backup primeiro sistema', 'backup_crm_2026-03-03.json')
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function normalizePhone(phone) {
  if (!phone) return ''
  return String(phone).trim()
}

async function run() {
  const raw = fs.readFileSync(backupPath, 'utf-8')
  const parsed = JSON.parse(raw)
  const oldLeads = parsed?.data?.leads

  if (!Array.isArray(oldLeads)) {
    throw new Error('Formato inesperado no backup: esperado data.leads como array.')
  }

  const cleaned = oldLeads
    .map((lead) => ({
      name: (lead?.name || '').trim(),
      phone: normalizePhone(lead?.phone)
    }))
    .filter((lead) => lead.name.length > 0)

  const dedupMap = new Map()
  for (const lead of cleaned) {
    const key = `${lead.name.toLowerCase()}|${lead.phone}`
    if (!dedupMap.has(key)) dedupMap.set(key, lead)
  }
  const uniqueLeads = [...dedupMap.values()]

  const payload = uniqueLeads.map((lead) => ({
    name: lead.name,
    phone: lead.phone
  }))

  let inserted = 0
  const batchSize = 50
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize)
    const { error } = await supabase.from('leads').insert(batch)
    if (error) throw error
    inserted += batch.length
  }

  console.log(`Backup lido: ${oldLeads.length} leads`)
  console.log(`Leads com nome: ${cleaned.length}`)
  console.log(`Leads unicos (nome+telefone): ${uniqueLeads.length}`)
  console.log(`Inseridos na secao 2: ${inserted}`)
}

run().catch((err) => {
  console.error('Falha na importacao:', err)
  process.exit(1)
})
