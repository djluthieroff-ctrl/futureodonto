import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncLeadsToAgenda() {
    console.log('Iniciando sincronização de leads para a agenda (ESM)...');

    // 1. Buscar leads que têm data de consulta
    const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .not('data_consulta', 'is', null);

    if (leadsError) {
        console.error('Erro ao buscar leads:', leadsError);
        return;
    }

    console.log(`Encontrados ${leads.length} leads para processar.`);

    // 2. Obter dentista e cadeira padrão
    const { data: dentista } = await supabase.from('dentistas').select('id').limit(1).single();
    const { data: cadeira } = await supabase.from('cadeiras').select('id').limit(1).single();

    if (!dentista || !cadeira) {
        console.error('Dentista ou Cadeira não encontrados. Verifique o banco.');
        return;
    }

    for (const lead of leads) {
        try {
            let pacienteId = lead.paciente_id;

            // 3. Garantir que o lead seja um paciente
            if (!pacienteId) {
                // Tenta buscar por nome (ignora telefone por enquanto para evitar duplicatas complicadas)
                const { data: existingPatient } = await supabase
                    .from('patients')
                    .select('id')
                    .eq('name', lead.name)
                    .maybeSingle();

                if (existingPatient) {
                    pacienteId = existingPatient.id;
                    console.log(`Paciente existente encontrado para ${lead.name}`);
                } else {
                    // Cria novo paciente
                    const { data: newPatient, error: pError } = await supabase
                        .from('patients')
                        .insert([{
                            name: lead.name,
                            phone: lead.phone,
                            email: lead.email,
                            status: 'ativo'
                        }])
                        .select()
                        .maybeSingle();

                    if (pError) {
                        console.error(`Erro ao criar paciente para ${lead.name}:`, pError);
                        continue;
                    }
                    pacienteId = newPatient.id;
                    console.log(`Novo paciente criado: ${lead.name}`);
                }

                // Atualiza o lead com o ID do paciente
                await supabase.from('leads').update({ paciente_id: pacienteId }).eq('id', lead.id);
            }

            // 4. Criar o agendamento
            const [year, month, day] = lead.data_consulta.split('-').map(Number);
            // Agendamentos em datas passadas são válidos para relatórios
            const dataInicio = new Date(Date.UTC(year, month - 1, day, 13, 0, 0)); // 10:00 Horário Local aprox (UTC-3 -> 13:00 UTC)
            const dataFim = new Date(Date.UTC(year, month - 1, day, 14, 0, 0));

            // Verifica se já existe um agendamento para este paciente NESTE DIA
            // (Para simplificar, permitimos o script rodar várias vezes se as datas forem diferentes)
            const { data: existingAg } = await supabase
                .from('agendamentos')
                .select('id')
                .eq('paciente_id', pacienteId)
                .gte('data_inicio', new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString())
                .lte('data_inicio', new Date(Date.UTC(year, month - 1, day, 23, 59, 59)).toISOString())
                .maybeSingle();

            if (!existingAg) {
                const situacao = lead.attended ? 'atendido' : 'agendado';

                const { error: agError } = await supabase
                    .from('agendamentos')
                    .insert([{
                        paciente_id: pacienteId,
                        dentista_id: dentista.id,
                        cadeira_id: cadeira.id,
                        data_inicio: dataInicio.toISOString(),
                        data_fim: dataFim.toISOString(),
                        motivo: 'Avaliação (Marketing)',
                        situacao: situacao,
                        tipo: lead.sale_status === 'sold' ? 'venda' : 'avaliação',
                        created_at: lead.created_at || new Date().toISOString()
                    }]);

                if (agError) {
                    console.error(`Erro ao criar agendamento para ${lead.name}:`, agError);
                } else {
                    console.log(`Agendamento criado: ${lead.name} em ${lead.data_consulta}`);
                }
            }

        } catch (err) {
            console.error(`Erro inesperado ao processar lead ${lead.name}:`, err);
        }
    }

    console.log('Sincronização concluída!');
}

syncLeadsToAgenda();
