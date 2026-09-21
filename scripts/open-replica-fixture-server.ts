/**
 * TODO17 D4: CI fixture server speaking the open `{state, questions}` wire
 * contract (offline-deterministic — answers derive from hashing the state).
 * Live legs use OPEN_REPLICA_ENDPOINT against a real community replica.
 *
 * Usage: pnpm exec tsx scripts/open-replica-fixture-server.ts [port]
 */
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const answerFor = (state: string, question: { id: string; type: string; options?: string[] }) => {
  const digest = createHash('sha256').update(`${state}|${question.id}`).digest();
  if (question.type === 'choice' && question.options && question.options.length > 0) {
    const raw = Array.from(question.options, (option, i) => ({
      option,
      p: digest[i % digest.length]! / 256,
    }));
    const sum = raw.reduce((s, d) => s + d.p, 0) || 1;
    const distribution = raw.map((d) => ({ option: d.option, p: d.p / sum }));
    return { id: question.id, distribution, choice: distribution[0]!.option };
  }
  if (question.type === 'boolean') return { id: question.id, boolean: digest[0]! % 2 === 0 };
  return { id: question.id, score: digest[0]! / 255 };
};

const handler = (req: IncomingMessage, res: ServerResponse): void => {
  if (req.method !== 'POST' || !req.url?.endsWith('/v1/systemone')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const request = JSON.parse(body) as {
        state: string;
        questions: Array<{ id: string; type: string; options?: string[] }>;
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          model: 'fixture-replica',
          answers: request.questions.map((q) => answerFor(request.state, q)),
        })
      );
    } catch {
      res.writeHead(400).end();
    }
  });
};

const port = Number(process.argv[2] ?? 8421);
createServer(handler).listen(port, () => {
  console.log(`open-replica fixture server on http://127.0.0.1:${port}/v1/systemone`);
});
