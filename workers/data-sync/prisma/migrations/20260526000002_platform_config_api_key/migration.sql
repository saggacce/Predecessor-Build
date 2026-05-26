-- Seed llm_api_key config entry (stored encrypted-at-rest via DB; never returned to frontend as plaintext)
INSERT INTO "PlatformConfig" ("key", "label", "description", "group", "value", "defaultValue", "unit", "minValue", "maxValue", "textValue", "updatedAt")
VALUES
  ('llm_api_key', 'API Key del proveedor LLM', 'Clave de autenticación para el proveedor LLM (OpenRouter, OpenAI, etc.). Se almacena en BD y nunca se devuelve al cliente en texto plano.', 'llm', 0, 0, NULL, NULL, NULL, NULL, NOW())
ON CONFLICT ("key") DO NOTHING;
