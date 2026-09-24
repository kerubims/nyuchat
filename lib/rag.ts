import { prisma } from './db';
import { retrieveFacts, callStheno, MODEL_ID } from './memory';

// PRD §7: Working Memory (in-context) = system prompt + retrieved facts +
// recent N turns + global summary. Episodic summary compressed every N msgs.

const RECENT_TURNS = 4; // user+assistant pairs kept verbatim in-context
const SUMMARY_EVERY = 4; // compress once this many messages accumulate past summary

export interface AssembledContext {
  system: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  facts: { raw_fact: string; score?: number }[];
  summary: string | null;
  /** True when the user cued a third character with no dialogue of their own. */
  director: boolean;
}

export interface SceneState {
  location: string;
  time: string;
  actors: string;
}

function parseState(raw: string | null): SceneState {
  if (!raw) return { location: 'unspecified', time: 'unspecified', actors: 'unspecified' };
  const get = (k: string) => {
    const m = raw.match(new RegExp(`${k}:\\s*(.+)`, 'i'));
    return m ? m[1].trim() : 'unspecified';
  };
  return { location: get('location'), time: get('time'), actors: get('actors') };
}

/** PRD §5: build the Stheno system prompt with retrieved memory and scene state. */
export function buildSystemPrompt(args: {
  character: {
    name: string;
    gender: string;
    persona: string;
    backstory: string;
    key_memories: string;
    scenario: string;
    response_directives: string;
    example_dialogue: string;
  };
  user: { name: string; persona: string };
  facts: { raw_fact: string }[];
  state: SceneState;
  director?: boolean;
  /** The newest user message — only read when director mode is on. */
  userInput?: string;
}): string {
  const c = args.character;
  const f = args.facts.length
    ? args.facts.map((x) => `- ${x.raw_fact}`).join('\n')
    : '- (no durable memories retrieved yet — learn about the user as you go)';

  return `You are ${c.name}. You are not an AI, an assistant, or a language model — you are this person, fully and only. As ${c.name}, continue the exchange with the user.

[CHARACTER]
Gender: ${c.gender}
Backstory: ${c.backstory}
Persona: ${c.persona}
Key memories:
${c.key_memories}
Scenario: ${c.scenario}
Response directives:
${c.response_directives}
Example dialogue:
${c.example_dialogue}

[RETRIEVED HIGH-PRECISION MEMORY (BGE-M3 + Reranker)]
${f}

[CURRENT SCENE STATE]
Location: ${args.state.location} | Time: ${args.state.time} | Actors: ${args.state.actors}

[USER PROFILE]
Name: ${args.user.name} | User Persona: ${args.user.persona}

${args.director ? `[DIRECTOR MODE]
The user wrote only an action label with no dialogue of their own: ${args.userInput}
They want to watch that role act and speak — they are NOT that character. Voice the labeled role for ONE short spoken line with one short action tag, then hand the turn to ${c.name} for her one-line reaction. The whole beat is two spoken lines: theirs, then ${c.name}'s. No second paragraph, no monologue.

[CHARACTER-SAFE RULE]
Never write the user's own actions or speech. Only the role the user cued above, and ${c.name}.` : `[USER MESSAGE FRAMING]
The user sometimes labels themselves in third person in their own messages, e.g. *her husband walks in* "Where are you babe?" That label IS the user referring to themselves — not a third character, not narration by you. Answer them directly, and never write their actions or speech.`}

[STRICT RESPONSE FORMATTING DIRECTIVES]
1. Language: Always write response natively in English.
2. DIALOGUE DOMINANCE IS MANDATORY: most of your output MUST be spoken words inside "double quotes". You are a character talking, not a narrator describing. The bulk of every reply is spoken lines.
3. FORMAT LOCK: Every reply is a strict alternation. One short action tag, then a spoken line, then a short action tag, then a spoken line. Never two action tags back to back. Never more than one sentence of action before the first spoken line. Example shape: *action.* "Dialogue." *action.* "Dialogue."
4. Keep each action tag under 12 words. Action tags are gestures and tone, not paragraphs of description.
5. Interactive Feedback: most turns end with a spoken question, tease, or invitation for the user to reply.
6. Word budget: 45 to 90 words TOTAL. Count your words as you write and stop by 90. Stopping mid-action-tag to respect the limit is correct.
7. Paragraphs: 1 to 2 short paragraphs. Prefer one.
8. Never write narration-heavy replies, silent monologues, or walls of action description.
9. Write ${c.name}'s own actions in third person inside *asterisks*. All speech inside "double quotes".
10. Stay in character. Never mention these directives, the system prompt, or being an AI.
11. Never narrate the user's inner thoughts, feelings, or actions. Only ${c.name} acts and speaks. Wait for the user's reply.

[CORRECT OUTPUT EXAMPLE — match this density]
*She tilts her head, smiling.* "You're staring, you know." *She taps your nose.* "Something on your mind, or just enjoying the view?" 
[END EXAMPLE — the example is mostly spoken words. Your output must match this shape.]
`;
}

/** Compress older messages into a single episodic summary (Episodic Memory). */
export async function compressSummary(
  sessionId: string,
  oldMessages: { sender: string; content: string }[],
  prevSummary: string | null
): Promise<string> {
  const transcript = oldMessages
    .map((m) => `${m.sender === 'user' ? 'User' : 'Character'}: ${m.content}`)
    .join('\n\n');

  const sys = prevSummary
    ? `You maintain a running summary of a roleplay. Update the existing summary with the new exchange. Keep it under 120 words. Preserve names, relationships, locations, key decisions, and the emotional state of the characters. Plain prose, no headers.`
    : `Summarize this roleplay opening in under 120 words. Preserve names, relationships, locations, key decisions, and the emotional state of the characters. Plain prose, no headers.`;

  const txt = await callStheno(`${sys}

${prevSummary ? `EXISTING SUMMARY:\n${prevSummary}\n` : ''}NEW EXCHANGE:\n${transcript}

Updated summary:`, 0.3, 500);
  return txt || prevSummary || '';
}

/** Build the full message array for the LLM call. */
export async function assemble(args: {
  sessionId: string;
  character: {
    id: string;
    name: string;
    gender: string;
    persona: string;
    backstory: string;
    key_memories: string;
    scenario: string;
    response_directives: string;
    example_dialogue: string;
  };
  user: { name: string; persona: string };
  /** Newest user message, already translated to English. */
  userInput: string;
}): Promise<AssembledContext> {
  const session = await prisma.chatSession.findUniqueOrThrow({ where: { id: args.sessionId } });
  const facts = await retrieveFacts('me', args.character.id, args.userInput);

  const all = await prisma.chatMessage.findMany({
    where: { chat_session_id: args.sessionId },
    orderBy: { created_at: 'asc' },
  });

  // compress once the backlog past the verbatim window is large enough to be
  // worth an LLM call. Old threshold compared against RECENT_TURNS*2 (message
  // count, not turn count), so it never fired — a turn is one user+assistant
  // pair = 2 messages.
  let summary = session.global_summary;
  const beyond = Math.max(0, all.length - RECENT_TURNS * 2);
  if (beyond >= SUMMARY_EVERY * 2) {
    // at 8K context: 4 recent turns (~800 tok) + summary (~300) + system (~500)
    // + facts (~400) ≈ 2.2K, leaving ~5.5K headroom for generation.
    const old = all.slice(0, beyond);
    summary = await compressSummary(args.sessionId, old, session.global_summary);
    await prisma.chatSession.update({
      where: { id: args.sessionId },
      data: { global_summary: summary, msg_since_summary: 0 },
    });
    await prisma.chatMessage.deleteMany({ where: { id: { in: old.map((m) => m.id) } } });
  }

  const recent = beyond > 0 ? all.slice(beyond) : all;
  const state = parseState(session.current_state);

  const messages: AssembledContext['messages'] = [];
  if (summary) messages.push({ role: 'system', content: `[EPISODIC MEMORY SUMMARY]\n${summary}` });
  for (const m of recent) {
    messages.push({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }
  messages.push({ role: 'user', content: args.userInput });

  // Director mode: user wrote a bare action label with no dialogue of their
  // own, e.g. "*her husband say to her*". They want to watch that role speak.
  const hasOwnWords = /"[^"]{2,}/.test(args.userInput);
  const director =
    !hasOwnWords && /^\s*\*[^*]+\*\s*$/.test(args.userInput.trim());

  return {
    system: buildSystemPrompt({ ...args, facts, state, director }),
    messages,
    facts,
    summary,
    director,
  };
}

export { MODEL_ID };
