/**
 * What GRIT reads from the health app, and why. Health Connect asks apps to
 * explain every permission; Apple asks for the same in review. Shown on the
 * health settings screen before the system prompt.
 */
export const HEALTH_REASONS: { label: string; reason: string }[] = [
  { label: 'Workouts, steps and distance', reason: 'So they count toward your goals and challenges.' },
  { label: 'Heart rate during workouts', reason: "To work out calories from your heart rate, which beats a general estimate." },
  { label: 'Sleep, heart rate variability, resting heart rate, breathing rate and sleeping temperature', reason: "So your coach and the progression rules know how you're recovering." },
  { label: 'VO2max', reason: 'To show your fitness trend.' },
  { label: 'Weight', reason: 'For your weight trend and calorie targets.' },
  { label: 'Past data', reason: 'To import the last two months when you first connect.' },
];

export const CYCLE_REASON =
  "Period days and flow, only if you turn this on. They're kept for you alone: never in your feed, challenges or coach chats, and turning it off deletes them.";
