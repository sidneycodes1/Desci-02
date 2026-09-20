export interface SupabaseCookieValue {
  name: string;
  value: string;
}

export interface SupabaseCookieMutation extends SupabaseCookieValue {
  options?: Record<string, unknown>;
}

export interface SupabaseCookieAdapter {
  getAll(): SupabaseCookieValue[];
  setAll(cookies: SupabaseCookieMutation[]): void;
}
