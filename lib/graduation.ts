export const PROGRAM_DURATION: Record<string, number> = {
  "BSc Computer Science": 4,
  "BSc Nursing": 4,
  "BBA": 4,
  "Diploma": 2,
  "MBA": 2,
};

export function calculateGraduationYear(student: any): number {
  if (student.graduationYear) return student.graduationYear;

  const duration = PROGRAM_DURATION[student.program] || 4;
  const currentYear = new Date().getFullYear();

  if (student.level && student.entryYear) {
    const remainingYears = duration - (student.level / 100);
    return currentYear + remainingYears;
  }

  if (student.entryYear) {
    return student.entryYear + duration;
  }

  return currentYear + 2;
}
