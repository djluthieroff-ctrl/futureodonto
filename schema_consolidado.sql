-- =====================================================
-- SCRIPT DE CONSOLIDAÇÃO DO BANCO DE DADOS (DENTISTCRM)
-- Este script resolve as inconsistências que causam Bad Request (400)
-- Execute no SQL Editor do Supabase
-- =====================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de PACIENTES (Base para várias outras)
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    cpf TEXT,
    birth_date DATE,
    gender TEXT,
    city TEXT,
    status TEXT DEFAULT 'ativo',
    notes TEXT,
    last_contact TIMESTAMPTZ DEFAULT NOW(),
    source TEXT
);

-- 3. Tabela de DENTISTAS
CREATE TABLE IF NOT EXISTS public.dentistas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    nome TEXT NOT NULL,
    especialidade TEXT,
    cro TEXT,
    cor TEXT DEFAULT '#818CF8',
    ativo BOOLEAN DEFAULT TRUE
);

-- 4. Tabela de CADEIRAS/CONSULTÓRIOS
CREATE TABLE IF NOT EXISTS public.cadeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    ativa BOOLEAN DEFAULT TRUE
);

-- 5. Tabela de AGENDAMENTOS
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paciente_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    dentista_id UUID REFERENCES public.dentistas(id),
    cadeira_id UUID REFERENCES public.cadeiras(id),
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    motivo TEXT,
    situacao TEXT DEFAULT 'agendado', -- agendado, confirmado, atendido, faltou, desmarcou, cancelado
    observacoes TEXT
);

-- 6. Tabela de TRATAMENTOS
CREATE TABLE IF NOT EXISTS public.tratamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paciente_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    dentista_id UUID REFERENCES public.dentistas(id),
    descricao TEXT,
    status TEXT DEFAULT 'orcamento', -- orcamento, em_andamento, concluido, cancelado
    valor_total DECIMAL(10,2) DEFAULT 0
);

-- 7. Tabela de FINANCEIRO (RECEITAS)
CREATE TABLE IF NOT EXISTS public.financeiro_receitas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paciente_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    descricao TEXT NOT NULL,
    valor_total DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT,
    status TEXT DEFAULT 'pendente', -- pendente, pago, atrasado
    num_parcelas INTEGER DEFAULT 1
);

-- 8. Tabela de FINANCEIRO (DESPESAS)
CREATE TABLE IF NOT EXISTS public.financeiro_despesas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    descricao TEXT NOT NULL,
    categoria TEXT,
    fornecedor TEXT,
    valor_total DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    forma_pagamento TEXT,
    status TEXT DEFAULT 'pendente' -- pendente, pago, atrasado
);

-- 9. Tabela de FINANCEIRO (PARCELAS)
CREATE TABLE IF NOT EXISTS public.financeiro_parcelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receita_id UUID REFERENCES public.financeiro_receitas(id) ON DELETE CASCADE,
    valor DECIMAL(10,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    status TEXT DEFAULT 'pendente'
);

-- 10. Tabela de LEADS (Ajustada para usar 'etapa' em vez de 'status' para bater com o código)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT,
    message TEXT,
    type TEXT DEFAULT 'rede_social', -- agendamento_online, rede_social
    etapa TEXT DEFAULT 'lead', -- lead, consulta_agendada, atendido, faltou_desmarcou, orcamento_perdido
    data_desejada DATE,
    convertido_em_paciente BOOLEAN DEFAULT FALSE,
    paciente_id UUID REFERENCES public.patients(id)
);

-- SE A COLUNA status JÁ EXISTIR E etapa NÃO, VAMOS RENOMEAR (Caso o usuário já tenha a tabela)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='status') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='etapa') THEN
        ALTER TABLE public.leads RENAME COLUMN status TO etapa;
    END IF;
END $$;

-- 11. Configurações de Agendamento Online
CREATE TABLE IF NOT EXISTS public.config_agendamento_online (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habilitado BOOLEAN DEFAULT FALSE,
    link TEXT,
    mensagem TEXT DEFAULT 'Agende sua consulta online',
    horarios JSONB DEFAULT '[]'::jsonb,
    dias JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Habilitar RLS em tudo
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_agendamento_online ENABLE ROW LEVEL SECURITY;

-- 13. Políticas Super Permissivas (Como solicitado no fix anterior)
-- (Removendo existentes primeiro para evitar erro de duplicata)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Criar novas políticas
CREATE POLICY "auth_all_patients" ON public.patients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_dentistas" ON public.dentistas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cadeiras" ON public.cadeiras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_agendamentos" ON public.agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_tratamentos" ON public.tratamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_financeiro_receitas" ON public.financeiro_receitas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_financeiro_despesas" ON public.financeiro_despesas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_financeiro_parcelas" ON public.financeiro_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_config" ON public.config_agendamento_online FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Política para inserção pública de leads (formulário site)
CREATE POLICY "public_insert_leads" ON public.leads FOR INSERT TO anon WITH CHECK (true);
