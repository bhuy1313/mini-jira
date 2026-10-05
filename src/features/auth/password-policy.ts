export const PASSWORD_POLICY_MESSAGE =
  "Password must be 8–128 characters and include at least one uppercase letter, one lowercase letter, and one digit.";

export function hasValidPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value)
  );
}
