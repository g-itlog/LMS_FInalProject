import 'package:flutter/material.dart';
import 'api.dart';
import 'auth_validation.dart';
import 'widgets.dart';
import 'email_verification_screen.dart';
import 'password_reset_screen.dart';

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
  final nameFocus = FocusNode();
  final emailFocus = FocusNode();
  final passwordFocus = FocusNode();
  bool register = false, busy = false, show = false;
  String? error;
  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    nameFocus.dispose();
    emailFocus.dispose();
    passwordFocus.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy) return;
    if (!form.currentState!.validate()) {
      if (register && validateAuthName(name.text) != null) {
        nameFocus.requestFocus();
      } else if (validateAuthEmail(email.text) != null) {
        emailFocus.requestFocus();
      } else {
        passwordFocus.requestFocus();
      }
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      String? verificationToken;
      if (register) {
        final data = await widget.api.send(
          'POST',
          '/mobile/auth/email-otp/request',
          {'email': email.text.trim(), 'purpose': 'register'},
        );
        if (!mounted) return;
        verificationToken = await Navigator.push<String>(
          context,
          MaterialPageRoute(
            builder: (_) => EmailVerificationScreen(
              api: widget.api,
              email: email.text.trim(),
              purpose: 'register',
              challenge: Map<String, dynamic>.from(data),
            ),
          ),
        );
        if (verificationToken == null) return;
      }
      await widget.api.authenticate({
        'name': name.text.trim(),
        'email': email.text.trim(),
        'password': password.text,
        'verificationToken': ?verificationToken,
      }, register: register);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void changed(String _) => setState(() => error = null);

  void switchMode() {
    FocusManager.instance.primaryFocus?.unfocus();
    form.currentState?.reset();
    name.clear();
    email.clear();
    password.clear();
    setState(() {
      register = !register;
      error = null;
      show = false;
    });
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
                          color: accent,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Icon(
                          Icons.auto_stories_outlined,
                          color: Colors.white,
                          size: 27,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Flexible(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: BrandWordmark(fontSize: 28),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 38),
                  const Tag('STUDENT ACCESS'),
                  const SizedBox(height: 20),
                  Text(
                    register ? 'Join your\nclassroom.' : 'Welcome\nback.',
                    style: const TextStyle(
                      fontFamily: 'Lora',
                      fontSize: 42,
                      height: 1.15,
                      fontWeight: FontWeight.w500,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 15),
                  if (!register)
                    Center(
                      child: TextButton(
                        onPressed: busy
                            ? null
                            : () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      PasswordResetScreen(api: widget.api),
                                ),
                              ),
                        child: const Text('Forgot password?'),
                      ),
                    ),
                  Text(
                    register
                        ? 'Create your student account. We’ll email a code to verify your address first.'
                        : 'Sign in for your courses, assignments, and feedback.',
                    style: const TextStyle(
                      color: muted,
                      fontSize: 13,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 30),
                  if (register) ...[
                    TextFormField(
                      key: const ValueKey('auth-name'),
                      controller: name,
                      focusNode: nameFocus,
                      enabled: !busy,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      decoration: const InputDecoration(
                        labelText: 'Full name',
                        errorMaxLines: 3,
                      ),
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => emailFocus.requestFocus(),
                      onChanged: changed,
                      autofillHints: const [AutofillHints.name],
                      maxLength: 80,
                      validator: validateAuthName,
                    ),
                    const SizedBox(height: 17),
                  ],
                  TextFormField(
                    key: ValueKey('auth-email-$register'),
                    controller: email,
                    focusNode: emailFocus,
                    enabled: !busy,
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      counterText: '',
                      errorMaxLines: 3,
                    ),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    onFieldSubmitted: (_) => passwordFocus.requestFocus(),
                    onChanged: changed,
                    autofillHints: const [AutofillHints.email],
                    maxLength: 160,
                    validator: validateAuthEmail,
                  ),
                  const SizedBox(height: 17),
                  TextFormField(
                    key: ValueKey('auth-password-$register'),
                    controller: password,
                    focusNode: passwordFocus,
                    enabled: !busy,
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    obscureText: !show,
                    autocorrect: false,
                    enableSuggestions: false,
                    textInputAction: TextInputAction.done,
                    onChanged: changed,
                    autofillHints: [
                      register
                          ? AutofillHints.newPassword
                          : AutofillHints.password,
                    ],
                    decoration: InputDecoration(
                      labelText: 'Password',
                      errorMaxLines: 5,
                      suffixIcon: IconButton(
                        onPressed: busy
                            ? null
                            : () => setState(() => show = !show),
                        tooltip: show ? 'Hide password' : 'Show password',
                        icon: Icon(
                          show
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                        ),
                      ),
                    ),
                    validator: (v) =>
                        validateAuthPassword(v, register: register),
                    onFieldSubmitted: (_) => busy ? null : submit(),
                  ),
                  if (register)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Wrap(
                        spacing: 16,
                        runSpacing: 8,
                        children: passwordRequirements(password.text)
                            .map(
                              (rule) => Semantics(
                                label:
                                    '${rule.met ? 'Met' : 'Required'}: ${rule.label}',
                                excludeSemantics: true,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      rule.met
                                          ? Icons.check
                                          : Icons.circle_outlined,
                                      size: 14,
                                      color: rule.met
                                          ? const Color(0xFF37634D)
                                          : muted,
                                    ),
                                    const SizedBox(width: 6),
                                    Flexible(
                                      child: Text(
                                        rule.label,
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: rule.met
                                              ? const Color(0xFF37634D)
                                              : muted,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 17),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          error!,
                          style: const TextStyle(
                            color: Color(0xFF9A3F31),
                            fontSize: 12,
                            height: 1.6,
                          ),
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
                                Expanded(
                                  child: Text(
                                    register
                                        ? 'Create student account'
                                        : 'Sign in',
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Icon(Icons.arrow_forward, size: 19),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 15),
                  Center(
                    child: TextButton(
                      onPressed: busy ? null : switchMode,
                      child: Text(
                        register
                            ? 'Already have an account? Sign in'
                            : 'New here? Create a student account',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  const SizedBox(height: 23),
                  const Center(
                    child: Text(
                      'KNOWHERE TO GROW / STUDENT ACCESS',
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
