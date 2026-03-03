-- =====================================================
-- SCRIPT PARA CORRIGIR POLÍTICAS RLS DO ODONTOCRM
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- (Supabase Dashboard → SQL Editor → New Query → Cole e Execute)
-- =====================================================

-- 1. Primeiro, remover TODAS as políticas existentes que podem estar bloqueando
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 2. Criar políticas permissivas para TODAS as tabelas do sistema
-- Política: Usuários autenticados podem fazer TUDO (SELECT, INSERT, UPDATE, DELETE)

-- PATIENTS
CREATE POLICY "authenticated_all_patients" ON public.patients
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AGENDAMENTOS
CREATE POLICY "authenticated_all_agendamentos" ON public.agendamentos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DENTISTAS
CREATE POLICY "authenticated_all_dentistas" ON public.dentistas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CADEIRAS
CREATE POLICY "authenticated_all_cadeiras" ON public.cadeiras
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TRATAMENTOS
CREATE POLICY "authenticated_all_tratamentos" ON public.tratamentos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PROCEDIMENTOS
CREATE POLICY "authenticated_all_procedimentos" ON public.procedimentos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LEADS
CREATE POLICY "authenticated_all_leads" ON public.leads
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FINANCEIRO_RECEITAS
CREATE POLICY "authenticated_all_financeiro_receitas" ON public.financeiro_receitas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FINANCEIRO_DESPESAS
CREATE POLICY "authenticated_all_financeiro_despesas" ON public.financeiro_despesas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FINANCEIRO_PARCELAS
CREATE POLICY "authenticated_all_financeiro_parcelas" ON public.financeiro_parcelas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RETORNOS
CREATE POLICY "authenticated_all_retornos" ON public.retornos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ALERTAS_RETORNO
CREATE POLICY "authenticated_all_alertas_retorno" ON public.alertas_retorno
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LISTA_ESPERA
CREATE POLICY "authenticated_all_lista_espera" ON public.lista_espera
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ESTOQUE
CREATE POLICY "authenticated_all_estoque" ON public.estoque
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SERVICOS_PROTETICOS
CREATE POLICY "authenticated_all_servicos_proteticos" ON public.servicos_proteticos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CAMPAIGNS
CREATE POLICY "authenticated_all_campaigns" ON public.campaigns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MESSAGES
CREATE POLICY "authenticated_all_messages" ON public.messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INDICACOES
CREATE POLICY "authenticated_all_indicacoes" ON public.indicacoes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CHAT_CANAIS
CREATE POLICY "authenticated_all_chat_canais" ON public.chat_canais
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CHAT_MENSAGENS
CREATE POLICY "authenticated_all_chat_mensagens" ON public.chat_mensagens
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- USUARIOS_SISTEMA
CREATE POLICY "authenticated_all_usuarios_sistema" ON public.usuarios_sistema
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PACIENTE_ANOTACOES
CREATE POLICY "authenticated_all_paciente_anotacoes" ON public.paciente_anotacoes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Garantir que RLS está HABILITADO em todas as tabelas
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retornos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_retorno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lista_espera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos_proteticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paciente_anotacoes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PRONTO! Agora usuários autenticados podem fazer tudo.
-- Usuários não autenticados (anon) não podem fazer nada.
-- =====================================================
