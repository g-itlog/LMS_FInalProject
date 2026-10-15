import 'dart:convert';

// Keep these rules consistent with the React forms and Express schemas.
final _emailPattern = RegExp(
  r"^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$",
);

class PasswordRequirement {
  final String label;
  final bool met;
  final String message;
  const PasswordRequirement(this.label, this.met, this.message);
}

List<PasswordRequirement> passwordRequirements(String password) => [
  PasswordRequirement(
    '8–72 characters',
    password.length >= 8 &&
        password.length <= 72 &&
        utf8.encode(password).length <= 72,
    'Use 8–72 characters for your password.',
  ),
  PasswordRequirement(
    'One uppercase letter',
    RegExp(r'[A-Z]').hasMatch(password),
    'Include an uppercase letter.',
  ),
  PasswordRequirement(
    'One lowercase letter',
    RegExp(r'[a-z]').hasMatch(password),
    'Include a lowercase letter.',
  ),
  PasswordRequirement(
    'One number',
    RegExp(r'[0-9]').hasMatch(password),
    'Include a number.',
  ),
];

String? validateAuthName(String? value) {
  final name = (value ?? '').trim();
  if (name.isEmpty) return 'Enter your full name.';
  if (name.length < 2 || name.length > 80) {
    return 'Use 2–80 characters for your name.';
  }
  return null;
}

String? validateAuthEmail(String? value) {
  final email = (value ?? '').trim();
  if (email.isEmpty) return 'Enter your email address.';
  if (email.length > 160 || !_emailPattern.hasMatch(email)) {
    return 'Enter a valid email address, such as you@school.edu.';
  }
  return null;
}

String? validateAuthPassword(String? value, {bool register = false}) {
  final password = value ?? '';
  if (password.isEmpty) return 'Enter your password.';
  if (!register) {
    return password.length > 200 ? 'Use at most 200 characters.' : null;
  }
  if (utf8.encode(password).length > 72) {
    return 'Your password exceeds 72 bytes. Emoji and accented letters use more space; try a shorter password.';
  }
  for (final rule in passwordRequirements(password)) {
    if (!rule.met) return rule.message;
  }
  return null;
}
