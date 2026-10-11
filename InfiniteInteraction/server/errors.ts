export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function requireCondition(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export function publicError(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  console.error('application_error', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: '服务暂时不可用，请保留当前修改后重试。', code: 'INTERNAL_ERROR' }, { status: 500 });
}
