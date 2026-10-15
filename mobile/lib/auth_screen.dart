import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';

class AuthScreen extends StatefulWidget {
  final LmsApi api;
  const AuthScreen({super.key, required this.api});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool register = false, busy = false, show = false;
  String? error;
  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.authenticate({
        'name': name.text.trim(),
        'email': email.text.trim(),
        'password': password.text,
      }, register: register);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: purple,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.auto_stories_outlined,
                          color: Colors.white,
                          size: 27,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'classroom.',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 30,
                          letterSpacing: -1.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 38),
                  const Tag('YOUR STUDENT LEARNING SPACE'),
                  const SizedBox(height: 20),
                  Text(
                    register
                        ? 'Your next chapter\nstarts here.'
                        : 'Good to have\nyou back.',
                    style: const TextStyle(
                      fontSize: 36,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 15),
                  Text(
                    register
                        ? 'Create your student account and start learning.'
                        : 'Your courses, your progress, your possibilities.',
                    style: const TextStyle(
                      color: muted,
                      fontSize: 13,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 30),
                  if (register) ...[
                    TextFormField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Full name'),
                      textCapitalization: TextCapitalization.words,
                      autofillHints: const [AutofillHints.name],
                      maxLength: 80,
                      validator: (v) => (v?.trim().length ?? 0) < 2
                          ? 'Enter at least 2 characters.'
                          : null,
                    ),
                    const SizedBox(height: 17),
                  ],
                  TextFormField(
                    controller: email,
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                    ),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofillHints: const [AutofillHints.email],
                    maxLength: 160,
                    validator: (v) =>
                        !RegExp(
                          r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
                        ).hasMatch(v?.trim() ?? '')
                        ? 'Enter a valid email address.'
                        : null,
                  ),
                  const SizedBox(height: 17),
                  TextFormField(
                    controller: password,
                    obscureText: !show,
                    autocorrect: false,
                    enableSuggestions: false,
                    autofillHints: [
                      register
                          ? AutofillHints.newPassword
                          : AutofillHints.password,
                    ],
                    decoration: InputDecoration(
                      labelText: 'Password',
                      helperText: register
                          ? '8–72 characters, uppercase, lowercase, and a number.'
                          : null,
                      helperMaxLines: 2,
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => show = !show),
                        tooltip: show ? 'Hide password' : 'Show password',
                        icon: Icon(
                          show
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Enter your password.';
                      if (register &&
                          (v.length < 8 ||
                              v.length > 72 ||
                              !RegExp(r'[A-Z]').hasMatch(v) ||
                              !RegExp(r'[a-z]').hasMatch(v) ||
                              !RegExp(r'[0-9]').hasMatch(v))) {
                        return 'Use 8–72 characters with uppercase, lowercase, and a number.';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) => busy ? null : submit(),
                  ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 17),
                      child: Text(
                        error!,
                        style: const TextStyle(
                          color: Color(0xFFB85B72),
                          fontSize: 12,
                          height: 1.6,
                        ),
                      ),
                    ),
                  const SizedBox(height: 25),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: busy ? null : submit,
                      child: busy
                          ? const SizedBox(
                              width: 19,
                              height: 19,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  register
                                      ? 'Create student account'
                                      : 'Sign in',
                                ),
                                const Icon(Icons.arrow_forward, size: 19),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 15),
                  Center(
                    child: TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() {
                              register = !register;
                              error = null;
                              form.currentState?.reset();
                            }),
                      child: Text(
                        register
                            ? 'Already have an account? Sign in'
                            : 'New here? Create a student account',
                      ),
                    ),
                  ),
                  const SizedBox(height: 23),
                  const Center(
                    child: Text(
                      'Made for students. Connected to your classroom.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: muted, fontSize: 10),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
