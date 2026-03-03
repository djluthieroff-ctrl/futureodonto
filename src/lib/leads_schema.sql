-- SQL para tabela leads e configurações de agendamento online

-- 1. Tabela de Leads (Redes Sociais e Agendamento Online)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT, -- 'Instagram', 'Facebook', 'Google Ads', 'Agendamento Online', etc.
    message TEXT,
    type TEXT DEFAULT 'rede_social', -- 'agendamento_online' ou 'rede_social'
    status TEXT DEFAULT 'novo', -- 'novo', 'contatado', 'agendado', 'perdido'
    data_desejada DATE,
    motivo TEXT,
    convertido_em_paciente BOOLEAN DEFAULT FALSE,
    paciente_id UUID REFERENCES public.patients(id)
);

-- 2. Tabela de Configurações de Agendamento Online
CREATE TABLE IF NOT EXISTS public.config_agendamento_online (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habilitado BOOLEAN DEFAULT FALSE,
    link TEXT,
    mensagem TEXT DEFAULT 'Agende sua consulta online',
    horarios JSONB DEFAULT '[]'::jsonb,
    dias JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_agendamento_online ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS (Permissivas para autenticados como no script anterior)
CREATE POLICY "authenticated_all_leads_v2" ON public.leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_all_config_agendamento" ON public.config_agendamento_online
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Política para inserção pública (para formulários externos)
CREATE POLICY "public_insert_leads" ON public.leads
    FOR INSERT TO anon WITH CHECK (true);
