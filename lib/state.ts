import { prisma } from './db';
import { callStheno, callSthenoJson } from './memory';

// PRD §7: scene tracker — Location / Time / Actors updated after each turn so
// the system prompt's [CURRENT SCENE STATE] reflects reality instead of the
// initial "unspecified" seed written by /api/sessions.

/** Extract the current scene state from the latest exchange and persist it. */
export async function updateSceneState(
  sessionId: string,
  prev: string | null,
  userInput: string,
  assistantReply: string
): Promise<void> {
  const prompt = `Given the scene state and the latest roleplay exchange, output ONLY JSON:
{"location":"<concise place>","time":"<time of day/period>","actors":"<comma-separated names present>"}
Rules: keep each field max 6 words. Update location/time ONLY when the story moved (new place, time skip); otherwise keep the previous value. Actors = characters actually present in the latest exchange.

CURRENT STATE:
${prev ?? 'Location: unspecified | Time: unspecified | Actors: unspecified'}

LATEST EXCHANGE:
User: ${userInput.slice(0, 400)}
Character: ${assistantReply.slice(0, 300)}`;

  const parsed = await callSthenoJson<{ location?: string; time?: string; actors?: string }>(prompt);
  if (!parsed) return; // extraction failed — keep previous state, never corrupt
  const merged = `Location: ${parsed.location || 'unspecified'} | Time: ${parsed.time || 'unspecified'} | Actors: ${parsed.actors || 'unspecified'}`;
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { current_state: merged },
  });
}

/** Generate a short session title from the first exchange. Returns null on failure. */
export async function generateTitle(
  characterName: string,
  firstUserMsg: string,
  firstReply: string
): Promise<string | null> {
  const prompt = `Write a 3-6 word evocative title for this roleplay scene between ${characterName} and the user. No quotes, no period. Examples: "Summer Night Reunion", "Stormbound Confessions". Reply with the title only.

Opening exchange:
User: ${firstUserMsg.slice(0, 200)}
${characterName}: ${firstReply.slice(0, 200)}

Title:`;
  const txt = await callStheno(prompt, 0.4, 30).catch(() => '');
  if (!txt) return null;
  const m = txt.match(/"([^"]{3,60})"/);
  const title = (m ? m[1] : txt.trim().split('\n')[0]).replace(/[".;]/g, '').trim();
  return title ? title.slice(0, 60) : null;
}
