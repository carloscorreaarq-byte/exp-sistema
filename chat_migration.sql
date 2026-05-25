-- ═══════════════════════════════════════════════════════════════════
--  EXP · CHAT — Migração Fase 1
--  Rodar UMA VEZ no Supabase SQL Editor
--  Ordem: tabelas → índices → RLS → Realtime → pg_cron
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. TABELA DE MENSAGENS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         text        NOT NULL DEFAULT 'general',
  sender_id       uuid        NOT NULL,          -- auth.users.id
  sender_name     text        NOT NULL,
  sender_iniciais text,
  sender_cor      text        DEFAULT '#1D6A4A',
  content         text        NOT NULL,
  reactions       jsonb       NOT NULL DEFAULT '{"like":[],"love":[]}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índice principal: buscar mensagens por canal + tempo (72h)
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
  ON chat_messages (channel, created_at DESC);


-- ── 2. CONTROLE DE LEITURA ───────────────────────────────────────────
-- Armazena o timestamp da última leitura por usuário × canal.
-- Para calcular não lidas: COUNT messages WHERE created_at > last_read_at
CREATE TABLE IF NOT EXISTS chat_read_status (
  user_id      uuid        NOT NULL,             -- auth.users.id
  channel      text        NOT NULL DEFAULT 'general',
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel)
);


-- ── 3. ROW LEVEL SECURITY ────────────────────────────────────────────
ALTER TABLE chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;

-- chat_messages: qualquer usuário autenticado pode ler
DROP POLICY IF EXISTS "chat_msg_select" ON chat_messages;
CREATE POLICY "chat_msg_select" ON chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- chat_messages: só pode inserir como si mesmo
DROP POLICY IF EXISTS "chat_msg_insert" ON chat_messages;
CREATE POLICY "chat_msg_insert" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- chat_messages: qualquer autenticado pode reagir (UPDATE reactions)
DROP POLICY IF EXISTS "chat_msg_update" ON chat_messages;
CREATE POLICY "chat_msg_update" ON chat_messages
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- chat_read_status: cada usuário gerencia apenas seu próprio registro
DROP POLICY IF EXISTS "chat_read_all" ON chat_read_status;
CREATE POLICY "chat_read_all" ON chat_read_status
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ── 4. REALTIME ──────────────────────────────────────────────────────
-- Necessário para que o widget receba mensagens em tempo real.
-- Garante que o payload de UPDATE inclua a linha anterior (para reactions).
ALTER TABLE chat_messages REPLICA IDENTITY FULL;

-- Adicionar à publication do Supabase Realtime
-- (Se der erro "publication does not exist", habilite Realtime no Dashboard
--  em Database → Replication → chat_messages)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;


-- ── 5. LIMPEZA AUTOMÁTICA DE 72H (pg_cron) ───────────────────────────
-- Ativar a extensão (cria o schema "cron" automaticamente)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover job anterior se existir (idempotente)
SELECT cron.unschedule('exp-chat-cleanup-72h')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'exp-chat-cleanup-72h');

SELECT cron.schedule(
  'exp-chat-cleanup-72h',           -- nome único do job
  '0 * * * *',                      -- toda hora, no minuto 0
  $$
    DELETE FROM chat_messages
    WHERE created_at < NOW() - INTERVAL '72 hours';
  $$
);

-- Para verificar o job:
-- SELECT * FROM cron.job;

-- Para remover o job (se precisar recriar):
-- SELECT cron.unschedule('exp-chat-cleanup-72h');


-- ═══════════════════════════════════════════════════════════════════
--  CHECKLIST PÓS-MIGRAÇÃO
--  [ ] Tabelas chat_messages e chat_read_status criadas
--  [ ] Realtime habilitado para chat_messages no Dashboard
--      Database → Replication → Supabase Realtime → chat_messages ✓
--  [ ] Extensão pg_cron habilitada (para limpeza automática 72h)
--  [ ] Testar: INSERT uma mensagem → confirmar que aparece em tempo real
-- ═══════════════════════════════════════════════════════════════════
