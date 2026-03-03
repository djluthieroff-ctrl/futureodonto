-- Execute este script no SQL Editor do Supabase.
-- Objetivo: habilitar auditoria por usuario e listagem de colaboradores no sistema.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.usuarios_sistema (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nome TEXT,
    role TEXT DEFAULT 'usuario',
    ativo BOOLEAN DEFAULT TRUE,
    ultimo_acesso TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    user_email TEXT,
    user_nome TEXT,
    modulo TEXT NOT NULL,
    acao TEXT NOT NULL,
    detalhes TEXT
);

ALTER TABLE public.usuarios_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_usuarios_sistema" ON public.usuarios_sistema;
CREATE POLICY "auth_all_usuarios_sistema"
ON public.usuarios_sistema
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_auditoria_logs" ON public.auditoria_logs;
CREATE POLICY "auth_all_auditoria_logs"
ON public.auditoria_logs
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_auditoria_logs_created_at ON public.auditoria_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_user_email ON public.auditoria_logs(user_email);
