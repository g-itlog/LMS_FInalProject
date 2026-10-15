import 'package:flutter/material.dart';
import 'api.dart';
import 'auth_validation.dart';
import 'widgets.dart';
import 'email_verification_screen.dart';

class PasswordResetScreen extends StatefulWidget {
  final LmsApi api;
  const PasswordResetScreen({super.key, required this.api});
  @override
  State<PasswordResetScreen> createState() => _PasswordResetScreenState();
}

class _PasswordResetScreenState extends State<PasswordResetScreen> {
  final form = GlobalKey<FormState>(),
      email = TextEditingController(),
      password = TextEditingController(),
      confirm = TextEditingController();
  String? proof, error;
  bool busy = false, show = false, done = false;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    confirm.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (proof == null) {
        final response = await widget.api.send(
          'POST',
          '/mobile/auth/email-otp/request',
          {'email': email.text.trim(), 'purpose': 'reset'},
        );
        if (!mounted) return;
        final value = await Navigator.push<String>(
          context,
          MaterialPageRoute(
            builder: (_) => EmailVerificationScreen(
              api: widget.api,
              email: email.text.trim(),
              purpose: 'reset',
              challenge: Map<String, dynamic>.from(response),
            ),
          ),
        );
        if (mounted && value != null) {
          form.currentState?.reset();
          setState(() => proof = value);
        }
      } else {
        await widget.api.send('POST', '/mobile/auth/reset-password', {
          'resetToken': proof,
          'newPassword': password.text,
        });
        if (mounted) {
          setState(() {
            done = true;
            password.clear();
            confirm.clear();
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Scaffold(
      appBar: AppBar(title: const Text('Password recovery')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    done
                        ? 'You’re ready to return.'
                        : proof == null
                        ? 'Forgot your password?'
                        : 'Choose a new password.',
                    style: const TextStyle(fontFamily: 'Lora', fontSize: 30),
                  ),
                  const SizedBox(height: 20),
                  if (done) ...[
                    const Text(
                      'Your password was updated. All previous sessions have been signed out.',
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Back to sign in'),
                    ),
                  ] else ...[
                    if (proof == null) ...[
                      const Text(
                        'If an eligible student account exists, we’ll send a reset code to its email.',
                      ),
                      const SizedBox(height: 20),
                      TextFormField(
                        key: const ValueKey('reset-email'),
                        controller: email,
                        enabled: !busy,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                          errorMaxLines: 3,
                        ),
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        validator: validateAuthEmail,
                        onChanged: (_) => setState(() => error = null),
                      ),
                    ] else ...[
                      TextFormField(
                        key: const ValueKey('new-password'),
                        controller: password,
                        enabled: !busy,
                        obscureText: !show,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        autofillHints: const [AutofillHints.newPassword],
                        decoration: InputDecoration(
                          labelText: 'New password',
                          errorMaxLines: 3,
                          suffixIcon: IconButton(
                            tooltip: show ? 'Hide password' : 'Show password',
                            onPressed: () => setState(() => show = !show),
                            icon: Icon(
                              show
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                            ),
                          ),
                        ),
                        validator: (v) =>
                            validateAuthPassword(v, register: true),
                        onChanged: (_) => setState(() => error = null),
                      ),
                      const SizedBox(height: 12),
                      ...passwordRequirements(password.text).map(
                        (rule) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Text(
                            '${rule.met ? '✓' : '○'} ${rule.label}',
                            style: TextStyle(
                              color: rule.met ? const Color(0xFF37634D) : muted,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      TextFormField(
                        key: const ValueKey('confirm-password'),
                        controller: confirm,
                        enabled: !busy,
                        obscureText: !show,
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        autofillHints: const [AutofillHints.newPassword],
                        decoration: const InputDecoration(
                          labelText: 'Confirm new password',
                          errorMaxLines: 3,
                        ),
                        validator: (v) => v == null || v.isEmpty
                            ? 'Confirm your new password.'
                            : v != password.text
                            ? 'Passwords must match.'
                            : null,
                        onChanged: (_) => setState(() => error = null),
                      ),
                    ],
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        child: Text(
                          error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(
                        busy
                            ? 'Please wait…'
                            : proof == null
                            ? 'Send reset code'
                            : 'Update password',
                      ),
                    ),
                    if (proof != null)
                      TextButton(
                        onPressed: busy
                            ? null
                            : () => setState(() {
                                proof = null;
                                error = null;
                                password.clear();
                                confirm.clear();
                              }),
                        child: const Text('Request a new code'),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
