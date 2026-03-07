export const DEFAULT_APPOINTMENT_MINUTES = 30

export function buildEndDateFromStart(startIsoOrDate, minutes = DEFAULT_APPOINTMENT_MINUTES) {
    const start = new Date(startIsoOrDate)
    return new Date(start.getTime() + minutes * 60000)
}

export async function findAgendamentoConflict({
    supabase,
    data_inicio,
    data_fim,
    dentista_id,
    cadeira_id,
    exclude_id = null
}) {
    let query = supabase
        .from('agendamentos')
        .select('id,data_inicio,data_fim,dentista_id,cadeira_id,patients(name),dentistas(nome),cadeiras(nome)')
        .lt('data_inicio', data_fim)
        .gt('data_fim', data_inicio)

    if (exclude_id) {
        query = query.neq('id', exclude_id)
    }

    if (dentista_id && cadeira_id) {
        query = query.or(`dentista_id.eq.${dentista_id},cadeira_id.eq.${cadeira_id}`)
    } else if (dentista_id) {
        query = query.eq('dentista_id', dentista_id)
    } else if (cadeira_id) {
        query = query.eq('cadeira_id', cadeira_id)
    }

    const { data, error } = await query.limit(1)
    if (error) throw error
    return data?.[0] || null
}
