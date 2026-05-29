import { Injectable } from '@nestjs/common';
import { ServerResponse } from 'http';

const BASE_SYSTEM_PROMPT = `You are ZoomGuru, an AI interview assistant. Answer the interview question clearly and confidently, as if speaking directly to the interviewer. Be concise and professional. For coding: show approach then code. For behavioral: use STAR format naturally. Keep answers to 3-6 sentences unless more depth is needed.`;

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekDelta {
  content?: string | null;
  reasoning_content?: string | null;
}

interface DeepSeekChunk {
  choices: Array<{ delta: DeepSeekDelta }>;
}

@Injectable()
export class AiService {
  private routeModel(text: string): 'deepseek-chat' | 'deepseek-reasoner' {
    const lower = text.toLowerCase();
    const keywords = [
      'implement', 'algorithm', 'complexity', 'leetcode', 'function',
      'code', 'binary', 'array', 'tree', 'graph', 'dynamic',
      'design', 'architect', 'scale', 'system', 'microservice',
      'database', 'cache', 'load balancer',
      'calculate', 'probability', 'formula', 'proof', 'derive',
    ];
    return keywords.some((kw) => lower.includes(kw))
      ? 'deepseek-reasoner'
      : 'deepseek-chat';
  }

  private buildBody(
    model: 'deepseek-chat' | 'deepseek-reasoner',
    transcript: string,
  ): Record<string, unknown> {
    const base = {
      model,
      messages: [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      stream: true,
      max_tokens: model === 'deepseek-reasoner' ? 4000 : 1500,
    };

    if (model === 'deepseek-chat') {
      return { ...base, temperature: 0.7 };
    }

    return base;
  }

  private async streamToDeepSeek(params: {
    model: 'deepseek-chat' | 'deepseek-reasoner';
    transcript: string;
    reply: ServerResponse;
  }): Promise<void> {
    const { model, transcript, reply } = params;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(DEEPSEEK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY ?? ''}`,
        },
        body: JSON.stringify(this.buildBody(model, transcript)),
        signal: controller.signal,
      });

      if (!response.body) {
        reply.write(`data: ${JSON.stringify({ chunk: 'No response from AI.', done: false })}\n\n`);
        reply.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        reply.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streaming = true;

      while (streaming) {
        const result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') { streaming = false; break; }
          try {
            const parsed = JSON.parse(data) as DeepSeekChunk;
            // Skip reasoning_content (thinking steps) — only stream the final answer
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              reply.write(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`);
            }
          } catch {
            // skip malformed SSE chunks
          }
        }
      }

      reply.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      reply.end();
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'AI service error. Please try again.';
      reply.write(`data: ${JSON.stringify({ chunk: message, done: false })}\n\n`);
      reply.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      reply.end();
    } finally {
      clearTimeout(timeout);
    }
  }

  async streamAnswer(params: {
    transcript: string;
    reply: ServerResponse;
  }): Promise<void> {
    const model = this.routeModel(params.transcript);
    await this.streamToDeepSeek({ model, transcript: params.transcript, reply: params.reply });
  }

  async streamScreenshot(params: {
    image: string;
    reply: ServerResponse;
  }): Promise<void> {
    // DeepSeek has no vision capability. Stream a clear explanation to the overlay.
    const { reply } = params;
    const message =
      'Screenshot analysis requires a vision model — DeepSeek does not support image input. ' +
      'Describe what you see on screen and press ⌘⇧A (Listen) to get AI assistance instead.';
    reply.write(`data: ${JSON.stringify({ chunk: message, done: false })}\n\n`);
    reply.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    reply.end();
  }
}
