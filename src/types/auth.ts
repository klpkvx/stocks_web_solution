export type AuthUser = {
  id: string;
  login: string;
  role: "user" | "admin";
  name: string;
  email?: string;
};

export type AuthSessionResponse = {
  authenticated: boolean;
  user: AuthUser | null;
};

export type AuthResultResponse = {
  user: AuthUser;
};
