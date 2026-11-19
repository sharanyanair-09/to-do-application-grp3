const EMAIL_PATTERN =
  /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i;

export function isValidEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || email !== email.trim()) {
    return false;
  }

  const atIndex = email.indexOf('@');
  return atIndex > 0 && atIndex <= 64 && EMAIL_PATTERN.test(email);
}
