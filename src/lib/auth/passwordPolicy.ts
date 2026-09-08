/**
 * **What Passport asks of a password, stated once.**
 *
 * The signup form, the reset form and the tests all read this, so the rules a
 * person is shown are by construction the rules that are enforced. A form that
 * lists requirements it does not check — or checks requirements it does not
 * list — is how somebody ends up guessing at a red border.
 *
 * Deliberately short. Long composition rules (a symbol, a digit, mixed case)
 * push people toward `Passw0rd!` and a sticky note; length is the property that
 * actually costs an attacker anything. Supabase's own minimum is 6, so this is
 * stricter than the server and the server can never surprise us by accepting
 * something we told the person was too weak.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** Shown under the field, before anybody gets anything wrong. */
export const PASSWORD_RULE = `At least ${MIN_PASSWORD_LENGTH} characters.`;

/** `undefined` when the password is fine, otherwise what to say about it. */
export function passwordProblem(password: string): string | undefined {
  if (password.length === 0) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

/**
 * Turn a Supabase auth error into something a person can act on.
 *
 * Supabase's messages are accurate and written for developers. "Invalid login
 * credentials" is true and tells somebody nothing about what to do next, which
 * is exactly the moment this product lost a real sign-in attempt.
 *
 * The wrong-password case deliberately does **not** say whether the account
 * exists. That would turn the login form into a way to test whether an email
 * address has a Passport account, which is somebody's private business.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. If you've forgotten your password, use the reset link below.";
  }
  if (m.includes("email not confirmed")) {
    return "Check your email for a confirmation link, then sign in.";
  }
  if (
    m.includes("user already registered") ||
    m.includes("already been registered")
  ) {
    return "There's already an account with that email. Try logging in instead.";
  }
  if (m.includes("password should be at least")) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  if (
    m.includes("same as the old password") ||
    m.includes("should be different")
  ) {
    return "That's the password you already had. Choose a different one.";
  }
  return message;
}
