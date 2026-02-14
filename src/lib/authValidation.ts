const LOGIN_REGEX = /^[A-Za-z0-9._-]{3,40}$/;

export type AuthFieldErrors = Partial<{
  login: string;
  password: string;
  name: string;
}>;

type PasswordRules = {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
};

export function evaluateStrongPassword(password: string): PasswordRules {
  const value = String(password || "");
  return {
    length: value.length >= 12,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value)
  };
}

function isStrongPassword(password: string) {
  const rules = evaluateStrongPassword(password);
  return Object.values(rules).every(Boolean);
}

export function validateLoginInput(input: {
  login: string;
  password: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const login = String(input.login || "").trim();
  const password = String(input.password || "");

  if (!login) {
    errors.login = "Login is required";
  } else if (!LOGIN_REGEX.test(login)) {
    errors.login = "Login must be 3-40 chars: letters, numbers, dot, underscore or hyphen";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 8 || password.length > 128) {
    errors.password = "Password must be between 8 and 128 characters";
  }

  return errors;
}

export function validateRegisterInput(input: {
  login: string;
  password: string;
  name: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = validateLoginInput(input);
  if (errors.password) {
    return errors;
  }

  if (!isStrongPassword(input.password)) {
    errors.password =
      "Password must be at least 12 characters and include upper/lowercase letters, a number, and a symbol";
  }

  const name = String(input.name || "").trim();
  if (name.length > 120) {
    errors.name = "Display name must be 120 characters or less";
  }

  return errors;
}

