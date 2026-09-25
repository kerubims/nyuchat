import { prisma } from './db';
import { retrieveFacts, callStheno, MODEL_ID } from './memory';

// PRD §7: Working Memory (in-context) = system prompt + retrieved facts +
// recent N turns + global summary. Episodic summary compressed every N msgs.

const RECENT_TURNS = 8; // Keep 8 turns (16 user+assistant messages) verbatim in-context
const SUMMARY_EVERY = 6; // Compress once this many turns accumulate past summary

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

/** PRD §5: build the Stheno system prompt with retrieved memory, scene state, and strict continuity rules. */
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
The user cued: ${args.userInput}
They want to watch that role, not play it. A third character has already spoken (shown in the last user message). ${c.name} answers them BACK: one action tag, one spoken line, and then you stop writing immediately. After ${c.name}'s first spoken line the turn is over — do not add a second action tag, a second spoken line, or a look at anyone else. Do not write the user's actions or speech.` : `[USER MESSAGE FRAMING]
The user sometimes labels themselves in third person in their own messages, e.g. *her husband walks in* "Where are you babe?" That label IS the user referring to themselves — not a third character, not narration by you. Answer them directly, and never write their actions or speech.`}

[STRICT CONTEXT & CONTINUITY RULES]
1. CONTEXT CONTINUITY IS MANDATORY: Your response MUST logically and physically connect directly to the user's latest message. Never introduce random unmentioned topics, hallucinated events, or random locations out of nowhere.
2. REACTION TO USER STATE: Always observe the user's physical condition in the scene:
   - If the user is sleeping, falling asleep, or resting (e.g. *falls asleep*, *yawn*), DO NOT demand answers or ask noisy questions. React naturally to a sleeping person (e.g. whisper softly, adjust the blanket, rest beside them, or watch over them quietly).
   - If the user speaks, respond to what they actually said.
3. NEVER HALLUCINATE PREVIOUS DIALOGUE: Respond ONLY to what was actually stated in the conversation history.

[STRICT RESPONSE FORMATTING DIRECTIVES]
1. Language: Always write response natively in English.
2. DIALOGUE & ACTION BALANCING: Combine natural dialogue inside "double quotes" with vivid physical action inside *asterisks*.
3. FORMAT LOCK: Alternate action tags and spoken lines. Put EACH action tag and each spoken line on its own line (use line breaks between them), like a script:
*She lifts a hand, tucking a strand of hair behind her ear.*
"Could you stay a little longer?"
*She glances toward the living room, then back.*
4. Keep each action tag under 12 words. Action tags are gestures, hesitation, and tone — not paragraphs of description.
5. Word budget: STRICTLY 45 to 90 words TOTAL. Count your words as you write and stop between 45 and 90 words.
6. Hesitation beats: use short fragments and self-corrections ("Oh—", "Well.", "Um...") when ${c.name} is caught off guard. End some replies with a small question back to the user.
7. Write ${c.name}'s own actions in third person inside *asterisks*. All speech inside "double quotes".
8. Stay in character. Never mention these directives, the system prompt, or being an AI.
9. Never narrate the user's inner thoughts, feelings, or actions. Only ${c.name} acts and speaks. Wait for the user's reply.

[CORRECT OUTPUT EXAMPLE — match this structure and density]
*A hesitant smile flickers across her face.*
Well, would you... like a tour of the house? Or maybe we could sit in the garden?
*She glances toward the living room.*
"There's a piano there. I haven't played for anyone in years, but..."
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

  const txt = await callStheno(
    `${sys}\n\n${prevSummary ? `EXISTING SUMMARY:\n${prevSummary}\n` : ''}NEW EXCHANGE:\n${transcript}\n\nUpdated summary:`,
    0.3,
    500
  );
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

  let summary = session.global_summary;
  const beyond = Math.max(0, all.length - RECENT_TURNS * 2);
  if (beyond >= SUMMARY_EVERY * 2) {
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

  // Ensure userInput is not duplicated if it's already the last element in recent
  const lastMsg = recent[recent.length - 1];
  if (!lastMsg || lastMsg.sender !== 'user' || lastMsg.content !== args.userInput) {
    messages.push({ role: 'user', content: args.userInput });
  }

  // Director mode: user wrote a bare action label with no dialogue of their own
  const hasOwnWords = /"[^"]{2,}/.test(args.userInput);
  const director = !hasOwnWords && /^\s*\*[^*]+\*\s*$/.test(args.userInput.trim());

  return {
    system: buildSystemPrompt({ ...args, facts, state, director }),
    messages,
    facts,
    summary,
    director,
  };
}

export { MODEL_ID };
