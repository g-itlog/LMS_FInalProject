import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';
import 'widgets.dart';

class EmailVerificationScreen extends StatefulWidget {
  final LmsApi api;
  final String email, purpose;
  final Json challenge;
  final DateTime Function()? now;
  const EmailVerificationScreen({
    super.key,
    required this.api,
    required this.email,
    required this.purpose,
    required this.challenge,
    this.now,
  });
  @override
  State<EmailVerificationScreen> createState() =>
      _EmailVerificationScreenState();
}

class _EmailVerificationScreenState extends State<EmailVerificationScreen> {
  final form = GlobalKey<FormState>(), code = TextEditingController();
  late Json challenge;
  late DateTime resendAt;
  Timer? timer;
  bool busy = false;
  String? error;
  DateTime get now => widget.now?.call() ?? DateTime.now();
  int get remaining =>
      (resendAt.difference(now).inMilliseconds / 1000).ceil().clamp(0, 60);
  @override
  void initState() {
    super.initState();
    challenge = widget.challenge;
    resendAt = now.add(Duration(seconds: challenge['resendAfter'] as int));
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    code.dispose();
    super.dispose();
  }

  Future<void> verify() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final data = await widget.api
          .send('POST', '/mobile/auth/email-otp/verify', {
            'challengeId': challenge['challengeId'],
            'code': code.text,
            'purpose': widget.purpose,
          });
      if (mounted) {
        Navigator.pop(
          context,
          data[widget.purpose == 'register'
                  ? 'verificationToken'
                  : 'resetToken']
              as String,
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> resend() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final data = await widget.api.send(
        'POST',
        '/mobile/auth/email-otp/request',
        {'email': widget.email, 'purpose': widget.purpose},
      );
      if (mounted) {
        setState(() {
          challenge = Map<String, dynamic>.from(data);
          code.clear();
          resendAt = now.add(Duration(seconds: data['resendAfter'] as int));
        });
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
      appBar: AppBar(title: const Text('Verify your email')),
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
                  const Icon(
                    Icons.mark_email_read_outlined,
                    size: 42,
                    color: accent,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Check your inbox.',
                    style: TextStyle(fontFamily: 'Lora', fontSize: 30),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Check ${widget.email} and your spam folder. Enter the six-digit code. It expires in 10 minutes; only the latest code works.',
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: code,
                    enabled: !busy,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'Email verification code',
                      errorMaxLines: 3,
                    ),
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '')
                        ? null
                        : 'Enter the six-digit code from your email.',
                    onChanged: (_) => setState(() => error = null),
                    onFieldSubmitted: (_) => verify(),
                  ),
                  const SizedBox(height: 18),
                  if (error != null)
                    Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                      semanticsLabel: error,
                    ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: busy ? null : verify,
                    child: Text(busy ? 'Verifying…' : 'Verify code'),
                  ),
                  TextButton(
                    onPressed: busy || remaining > 0 ? null : resend,
                    child: Text(
                      remaining > 0 ? 'Resend in ${remaining}s' : 'Resend code',
                    ),
                  ),
                  const Text(
                    'Never share this code. We will never ask for it outside this verification form. If you already have an account, return to sign in or use Forgot password.',
                    style: TextStyle(fontSize: 12, color: muted),
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
