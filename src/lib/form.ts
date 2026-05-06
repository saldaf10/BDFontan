export function stringValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function intValue(formData: FormData, key: string): number | null {
  const value = stringValue(formData, key);
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function dateValue(formData: FormData, key: string): Date | null {
  const value = stringValue(formData, key);
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00`);
}

export function booleanValue(formData: FormData, key: string): boolean | null {
  const value = stringValue(formData, key);
  if (!value) {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}
