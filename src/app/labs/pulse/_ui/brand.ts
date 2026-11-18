/**
 * People's Pulse colours. The answer colours are the dataviz skill's
 * validated categorical palette in its fixed order (CVD-checked; labels are
 * always printed beside each mark, which the two sub-3:1 slots require).
 */
export const ANSWER_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
] as const;

export const answerColor = (index: number) =>
  ANSWER_COLORS[index % ANSWER_COLORS.length]!;

export const PULSE_RED = "#e5484d";
