import 'dotenv/config';
import OpenAI from 'openai';
import pino from 'pino';
import { generateMatchDraft } from './editorial-agent';

const logger = pino({ name: 'ovalia-worker' });

if (!process.env.OPENAI_API_KEY) {
  logger.info('Worker listo. Agregá OPENAI_API_KEY para habilitar borradores editoriales.');
} else {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  logger.info({ capability: generateMatchDraft.name, client: client.constructor.name }, 'Agente editorial listo');
}
