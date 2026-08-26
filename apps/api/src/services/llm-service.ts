import OpenAI from 'openai';
import { Response } from 'express';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { getConfigMap, getTextConfigMap } from './config-service.js';
import type { Insight } from './analyst-service.js';

const SYSTEM_PROMPT = `Eres un analista táctico especializado en el videojuego Predecessor, un MOBA (Multiplayer Online Battle Arena) competitivo.

CONTEXTO DEL JUEGO:
- Objetivos principales: Fangtooth (spawn ~6min, reaparece), Orb Prime (objetivo mayor), Shaper, Mini Prime
- Fases: Early game (0-10min), Mid game (10-20min), Late game (20+min)
- Roles: Carry, Jungle, Midlane, Offlane, Support
- Métricas clave: WR (win rate), KDA, GPM (gold/min), DPM (daño/min), Vision Control Score, Throw Rate (% de partidas donde pierden ventaja), Early Death Rate

TAREA:
Recibes un JSON con insights pre-calculados por un motor de reglas. Cada insight tiene severidad (critical/high/medium/low) y evidencia cuantitativa.

Genera EXACTAMENTE 3 recomendaciones prescriptivas y accionables para el coach.

REGLAS ESTRICTAS:
1. Usa ÚNICAMENTE los datos del JSON. Nunca inventes estadísticas.
2. Tono imperativo: empieza con "Fuerza", "Prioriza", "Evita", "Trabaja", "Reduce", etc.
3. Máximo 2 líneas por recomendación.
4. Ordena de mayor a menor severidad.
5. Sé específico: incluye el número o porcentaje de la evidencia.
6. Si no hay suficientes insights, genera solo las recomendaciones que tengan respaldo en los datos.

FORMATO DE RESPUESTA (sin numeración, solo texto):
• [Recomendación 1]
• [Recomendación 2]
• [Recomendación 3]`;

export async function getLlmConfig(): Promise<{ enabled: boolean; model: string; baseUrl: string; apiKey: string; maxTokens: number }> {
  const [numMap, textMap] = await Promise.all([getConfigMap(db), getTextConfigMap(db)]);
  return {
    enabled: (numMap.get('llm_enabled') ?? 0) === 1,
    model: textMap.get('llm_model') ?? process.env.LLM_MODEL ?? 'deepseek/deepseek-chat-v4',
    baseUrl: textMap.get('llm_base_url') ?? process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey: textMap.get('llm_api_key') ?? process.env.OPENROUTER_API_KEY ?? '',
    maxTokens: Math.round(numMap.get('llm_max_tokens') ?? 400),
  };
}

export async function isLlmEnabled(): Promise<boolean> {
  const cfg = await getLlmConfig();
  return cfg.enabled && !!cfg.apiKey;
}

export async function streamLlmSummary(
  teamId: string,
  teamName: string,
  insights: Insight[],
  res: Response
): Promise<void> {
  const cfg = await getLlmConfig();

  if (!cfg.enabled) {
    res.write(`data: ${JSON.stringify({ error: 'LLM_DISABLED' })}\n\n`);
    res.end();
    return;
  }

  if (!cfg.apiKey) {
    res.write(`data: ${JSON.stringify({ error: 'LLM_NO_KEY' })}\n\n`);
    res.end();
    return;
  }

  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });

  const topInsights = insights
    .filter((i) => i.severity !== 'positive')
    .slice(0, 5)
    .map((i) => ({
      severity: i.severity,
      category: i.category,
      title: i.title,
      evidence: i.evidence,
      recommendation: i.recommendation,
    }));

  const userMessage = JSON.stringify({ team: teamName, insights: topInsights });

  let fullOutput = '';
  let promptTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const stream = await client.chat.completions.create({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      stream: true,
      max_tokens: cfg.maxTokens,
      temperature: 0.4,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        fullOutput += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    const saved = await db.llmAnalysis.create({
      data: {
        teamId,
        model: cfg.model,
        insightsJson: topInsights,
        outputText: fullOutput,
        promptTokens,
        outputTokens,
      },
    });

    logger.info({ teamId, analysisId: saved.id, model: cfg.model, promptTokens, outputTokens }, 'llm analysis saved');
  } catch (err) {
    logger.error({ err, teamId }, 'llm stream failed');
    if (!res.headersSent) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Analysis unavailable' })}\n\n`);
    res.end();
  }
}

export async function saveLlmFeedback(
  analysisId: string,
  feedback: 'positive' | 'negative',
  correction?: string
): Promise<void> {
  await db.llmAnalysis.update({
    where: { id: analysisId },
    data: { feedback, correction: correction ?? null },
  });
  logger.info({ analysisId, feedback }, 'llm feedback saved');
}
