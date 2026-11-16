export function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}

export const envInt = (name: string, fallback: number) => Number.parseInt(process.env[name] ?? String(fallback), 10);
