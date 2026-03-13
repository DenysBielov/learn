export function parseStudyRoute(pathname: string): { materialId?: number; quizId?: number; deckId?: number } | null {
  const materialMatch = pathname.match(/^\/materials\/(\d+)/);
  if (materialMatch) return { materialId: Number(materialMatch[1]) };
  const quizMatch = pathname.match(/^\/quizzes\/(\d+)/);
  if (quizMatch) return { quizId: Number(quizMatch[1]) };
  const deckMatch = pathname.match(/^\/decks\/(\d+)/);
  if (deckMatch) return { deckId: Number(deckMatch[1]) };
  return null;
}

export function getStepUrl(step: { stepType: string; materialId: number | null; quizId: number | null }): string {
  if (step.stepType === "material" && step.materialId) return `/materials/${step.materialId}`;
  if (step.stepType === "quiz" && step.quizId) return `/quizzes/${step.quizId}`;
  return "#";
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/[#*_~`>\[\]()!|-]/g, "")
    .replace(/\n+/g, " ")
    .trim();
}
