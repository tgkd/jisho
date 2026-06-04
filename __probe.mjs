import { ChatClient, stream } from '@tanstack/ai-client';
import { createChatDevtoolsBridge } from '@tanstack/ai-client/devtools';

const factory = (events) => () => (async function* () {
  for (const e of events) yield e;
})();

async function probe(label, events) {
  const client = new ChatClient({
    connection: stream(factory(events)),
    devtoolsBridgeFactory: createChatDevtoolsBridge,
  });
  let resolved = false;
  const send = client.sendMessage('hi').then(() => { resolved = true; });
  const timeout = new Promise((r) => setTimeout(r, 3000));
  await Promise.race([send, timeout]);
  const msgs = client.getMessages();
  const assistant = [...msgs].reverse().find((m) => m.role === 'assistant');
  const text = assistant?.parts?.filter((p) => p.type === 'text').map((p) => p.content).join('') ?? null;
  console.log(`\n=== ${label} ===`);
  console.log('sendMessage resolved:', resolved);
  console.log('message count:', msgs.length, '| roles:', msgs.map((m) => m.role).join(','));
  console.log('assistant text:', JSON.stringify(text));
  try { client.unsubscribe?.(); } catch {}
}

const C = (id, delta, content) => ({ type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta, content });

await probe('P1: CONTENT only', [C('m1', 'Hello', 'Hello'), C('m1', ' world', 'Hello world')]);

await probe('P2: START+CONTENT+END (no RUN)', [
  { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
  C('m1', 'Hello', 'Hello'), C('m1', ' world', 'Hello world'),
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
]);

await probe('P3: full envelope (mirrors server)', [
  { type: 'RUN_STARTED', runId: 'r1', threadId: 't1' },
  { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
  C('m1', 'Hello', 'Hello'), C('m1', ' world', 'Hello world'),
  { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
  { type: 'RUN_FINISHED', runId: 'r1', threadId: 't1' },
]);

process.exit(0);
