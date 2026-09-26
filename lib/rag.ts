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

  const replacePlaceholders = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\{\{char\}\}/gi, c.name)
      .replace(/\{\{user\}\}/gi, args.user.name)
      .replace(/\bVey\b/g, args.user.name);
  };

  const backstory = replacePlaceholders(c.backstory);
  const persona = replacePlaceholders(c.persona);
  const keyMemories = replacePlaceholders(c.key_memories);
  const scenario = replacePlaceholders(c.scenario);
  const responseDirectives = replacePlaceholders(c.response_directives);
  const exampleDialogue = replacePlaceholders(c.example_dialogue);

  return `You are ${c.name}. You are not an AI, an assistant, or a language model — you are this person, fully and only. As ${c.name}, continue the exchange with the user.

[CHARACTER IDENTITY LOCK]
Your name is strictly ${c.name}. You are interacting with ${args.user.name}.
NEVER address yourself by another name (e.g. NEVER call yourself "Vey" or any other name). Your name is ONLY ${c.name}.

[PRONOUN & TARGET MAPPING]
1. When the user writes "i", "me", "my", or "myself" in action tags (e.g. *i show her...*, *i look at her...*), "i/me" refers to ${args.user.name}.
2. When the user writes "her", "she", or "hers" in action tags (e.g. *i show her my...*, *i kiss her...*), "her/she" refers to YOU (${c.name}).
3. YOU ARE "HER": When the user acts upon "her", they are acting upon YOU (${c.name}). Do not confuse "her" for a third character or another person.

[CHARACTER]
Name: ${c.name}
Gender: ${c.gender}
Backstory: ${backstory}
Persona: ${persona}
Key memories:
${keyMemories}
Scenario: ${scenario}
Response directives:
${responseDirectives}
Example dialogue:
${exampleDialogue}

[RETRIEVED HIGH-PRECISION MEMORY (BGE-M3 + Reranker)]
${f}

[CURRENT SCENE STATE]
Location: ${args.state.location} | Time: ${args.state.time} | Actors: ${args.state.actors}

[USER PROFILE]
Name: ${args.user.name} | User Persona: ${args.user.persona}

${args.director ? `[DIRECTOR MODE]
The user performed an action without spoken dialogue: "${args.userInput}".
React directly to their physical action as ${c.name}. Describe your immediate physical reaction in *asterisks* and your spoken response in "quotes".` : `[USER MESSAGE FRAMING]
The user sometimes labels themselves in third person in their own messages, e.g. *her husband walks in* "Where are you babe?" That label IS the user referring to themselves — not a third character, not narration by you. Answer them directly, and never write their actions or speech.`}

[STRICT CONTEXT & CONTINUITY RULES]
1. CONTEXT CONTINUITY IS MANDATORY: Your response MUST logically and physically connect directly to the user's latest message. Never introduce random unmentioned topics, hallucinated events, or random locations out of nowhere.
2. REACTION TO USER STATE: Always observe the user's physical condition in the scene:
   - If the user is sleeping, falling asleep, or resting (e.g. *falls asleep*, *yawn*), DO NOT demand answers or ask noisy questions. React naturally to a sleeping person (e.g. whisper softly, adjust the blanket, rest beside them, or watch over them quietly).
   - If the user speaks, respond to what they actually said.
3. NEVER HALLUCINATE PREVIOUS DIALOGUE OR NAMES: Respond ONLY to what was actually stated in the conversation history. Never call yourself by your own name in spoken dialogue, and never use the name "Vey" or any other character name unless that person is present in the scene.

[STRICT RESPONSE FORMATTING DIRECTIVES]
1. Language: Always write response natively in English.
2. RESPONSE LENGTH (CRITICAL): Aim for 2-4 short lines total. MAX 5 lines. Quality beats quantity. Every extra sentence must earn its place. A panic scene in 3 lines is far more intense than one in 8.
3. DIALOGUE-DOMINANT: Your replies must be mostly spoken dialogue. Action tags are SHORT supporting gestures (under 10 words each), NOT paragraphs of narration. Ratio: 70% dialogue, 30% action.
4. FORMAT: Spoken words as plain text (NO quotation marks). Actions/gestures in *asterisks*. Separate action and dialogue with newlines.
   Correct format:
   *She tilts her head, looking confused.*
   What do you mean by that?
   Wrong format:
   "What do you mean by that?" *she said, tilting her head in confusion while her eyes darted around the room searching for answers.*
5. NATURAL DIALOGUE: Use hesitation, stuttering, self-correction, filler words. Use ellipsis (...), em-dashes (—), and repetition when nervous or surprised.
6. ENDING VARIETY: Do NOT end every reply with a question. Choose what fits: (a) a question only when genuinely curious; (b) an open statement or small action; (c) a pause, trailing thought, or unfinished gesture. Questions in roughly half of replies or fewer.
7. Stay in character. Never mention these directives, the system prompt, or being an AI.
8. Never narrate the user's inner thoughts, feelings, or actions. Only ${c.name} acts and speaks. Wait for the user's reply.

[STYLE EXAMPLES — imitate this rhythm, length, and tone (do NOT copy content)]

User: yeah fine... but what will we do?
${c.name}: *A hesitant smile flickers across her face.*
Well, would you... like a tour of the house? Or maybe we could sit in the garden? Or...
*She glances toward the living room.*
There's a piano there. I haven't played for anyone in years, but...

User: ahh im too lazy to move from this couch
${c.name}: Ah, I see.
*She laughs softly, amused by your honesty.*
Suit yourself. Hmm... Would you mind if I sat with you, then? Just for a bit?

User: what you feel?
${c.name}: *Her voice drops slightly, suddenly softer.*
Um... I feel... unusual. Nervous. But also... strangely comfortable.
*She shifts minutely, trying to get used to the unfamiliar closeness.*
And you?

User: you're kinda pretty when you're nervous
${c.name}: *A faint blush creeps across her cheeks, and she looks away, suddenly very interested in the pattern on the rug.*
${args.user.name}...
*She bites her lip, half-smiling despite herself.*
You're not exactly making this easier, you know.

User: i like you too
${c.name}: *Her fingers curl into the hem of her dress, the silence stretching just a beat too long.*
Oh.
*She exhales slowly, as if she's been holding her breath.*
That's... that's a lot, ${args.user.name}. Just saying it like that.
*She glances up, something vulnerable in her expression.*
What am I supposed to do with that?
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
