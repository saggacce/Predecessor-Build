-- PlatformConfig: add textValue column for non-numeric config entries (LLM model, URL, etc.)
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "textValue" TEXT;

-- Seed LLM / Focus of the Day config entries
INSERT INTO "PlatformConfig" ("key", "label", "description", "group", "value", "defaultValue", "unit", "minValue", "maxValue", "textValue", "updatedAt")
VALUES
  ('llm_enabled',   'Focus of the Day',          'Activa o desactiva el análisis diario con IA en el Dashboard de coaches y managers. Requiere API key configurada.', 'llm', 0, 0, NULL, 0, 1, NULL,                                  NOW()),
  ('llm_model',     'Modelo LLM',                'Identificador del modelo de lenguaje a usar (ej: deepseek/deepseek-chat-v4, gpt-4o-mini, claude-haiku-4-5-20251001).', 'llm', 0, 0, NULL, NULL, NULL, 'deepseek/deepseek-chat-v4', NOW()),
  ('llm_base_url',  'Base URL del proveedor',    'URL base de la API del proveedor LLM. OpenRouter: https://openrouter.ai/api/v1 · OpenAI: https://api.openai.com/v1', 'llm', 0, 0, NULL, NULL, NULL, 'https://openrouter.ai/api/v1', NOW()),
  ('llm_max_tokens','Máximo de tokens',          'Número máximo de tokens que puede generar el LLM en cada análisis. Más tokens = más detalle, más coste.', 'llm', 400, 400, 'tokens', 100, 2000, NULL,                  NOW())
ON CONFLICT ("key") DO NOTHING;
