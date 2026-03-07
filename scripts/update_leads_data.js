/* global process */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados no .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateLeads() {
    console.log('Iniciando atualização de dados dos leads (versão corrigida)...')

    const backupPath = path.join(__dirname, '../backup primeiro sistema/backup_crm_2026-03-03.json')
    const backupRaw = fs.readFileSync(backupPath, 'utf8')
    const backupData = JSON.parse(backupRaw)
    const oldLeads = backupData.data.leads

    console.log(`Encontrados ${oldLeads.length} leads no backup.`)

    const { data: newLeads, error: fetchError } = await supabase
        .from('leads')
        .select('id, name')

    if (fetchError) {
        console.error('Erro ao buscar leads do novo sistema:', fetchError)
        return
    }

    console.log(`Encontrados ${newLeads.length} leads no novo sistema.`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const newLead of newLeads) {
        const oldLead = oldLeads.find(ol => ol.name.toLowerCase().trim() === newLead.name.toLowerCase().trim())

        if (oldLead) {
            console.log(`Atualizando lead: ${newLead.name}`)

            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    scheduled_at: oldLead.scheduledAt || null,
                    data_consulta: oldLead.visitDate ? oldLead.visitDate.split('T')[0] : null,
                    attended: oldLead.attended === true,
                    sale_status: oldLead.saleStatus || null,
                    sale_value: oldLead.saleValue || 0
                })
                .eq('id', newLead.id)

            if (updateError) {
                console.error(`Erro ao atualizar lead ${newLead.name}:`, updateError)
                errorCount++
            } else {
                successCount++
            }
        } else {
            skipCount++
        }
    }

    console.log('\n--- Resumo da Atualização ---')
    console.log(`Sucessos: ${successCount}`)
    console.log(`Pulados (não encontrados): ${skipCount}`)
    console.log(`Erros: ${errorCount}`)
    console.log('----------------------------')
}

updateLeads()
