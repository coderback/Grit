/**
 * The public demo never calls an AI model. These replies were written by hand
 * for the demo, and the coach screen labels them as saved samples.
 */
export const DEMO_REPLY_LABEL = 'Saved sample reply. No AI model is called in this demo.';

export const DEMO_NUDGE =
  'Saved sample: you still have room in today\'s calories and your water streak is alive. A protein-heavy dinner would close the gap nicely.';

const REPLIES: { match: RegExp; reply: string }[] = [
  {
    match: /protein|muscle|macro/i,
    reply: 'Salmon with rice at dinner would add about 33 g of protein, and a yoghurt before bed would add 15 g more.',
  },
  {
    match: /dinner|eat|meal|food|hungry|calorie/i,
    reply: 'You have room for a proper dinner. Aim for a palm of protein, a fist of carbs and plenty of veg, then log it so tomorrow\'s plan stays accurate.',
  },
  {
    match: /run|workout|train|gym|exercise|tired|sore/i,
    reply: 'You lifted today and ran yesterday, so an easy walk or some stretching fits better tonight than another hard session.',
  },
  {
    match: /habit|streak|motivat|skip|miss/i,
    reply: 'One missed day will not undo your water streak. Keep the next step small: finish one glass now, then check it off.',
  },
];

const FALLBACK = 'This demo only has a few saved replies. Try asking about dinner, protein, training or your streak.';

export function demoReplyFor(message: string) {
  return REPLIES.find((r) => r.match.test(message))?.reply ?? FALLBACK;
}
