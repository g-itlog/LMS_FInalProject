import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/email_verification_screen.dart';
import 'package:classroom_mobile/password_reset_screen.dart';
import 'package:classroom_mobile/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  Finder field(String label) => find.byWidgetPredicate(
    (w) => w is TextField && w.decoration?.labelText == label,
  );
  Future<void> enter(WidgetTester tester, String label, String value) async {
    await tester.ensureVisible(field(label));
    await tester.enterText(field(label), value);
    await tester.pumpAndSettle();
  }

  Future<void> tap(WidgetTester tester, String text) async {
    await tester.ensureVisible(find.text(text));
    await tester.tap(find.text(text));
    await tester.pumpAndSettle();
  }

  Future<void> render(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: knowhereTheme(), home: child));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'OTP validates six digits, shows server errors, and enforces resend cooldown on a narrow phone',
    (tester) async {
      final calls = <http.Request>[];
      var now = DateTime(2026, 10, 16);
      final api = LmsApi(
        client: MockClient((request) async {
          calls.add(request);
          if (request.url.path.endsWith('/verify')) {
            return http.Response(
              jsonEncode({'message': 'The code is invalid or expired.'}),
              400,
            );
          }
          return http.Response(
            jsonEncode({
              'challengeId': 'new-challenge',
              'resendAfter': 60,
              'expiresIn': 600,
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(
        tester,
        EmailVerificationScreen(
          api: api,
          email: 'student@example.edu',
          purpose: 'register',
          now: () => now,
          challenge: {
            'challengeId': 'old-challenge',
            'resendAfter': 60,
            'expiresIn': 600,
          },
        ),
      );
      await enter(tester, 'Email verification code', '12');
      await tap(tester, 'Verify code');
      expect(calls, isEmpty);
      expect(
        find.text('Enter the six-digit code from your email.'),
        findsOneWidget,
      );
      await enter(tester, 'Email verification code', '123456');
      await tap(tester, 'Verify code');
      expect(find.text('The code is invalid or expired.'), findsOneWidget);
      expect(calls.length, 1);
      expect(
        tester
            .widget<TextButton>(
              find.widgetWithText(TextButton, 'Resend in 60s'),
            )
            .onPressed,
        isNull,
      );
      now = now.add(const Duration(seconds: 61));
      await tester.pump(const Duration(seconds: 61));
      await tester.pumpAndSettle();
      await tap(tester, 'Resend code');
      expect(calls.last.url.path, '/api/mobile/auth/email-otp/request');
      expect(jsonDecode(calls.last.body)['purpose'], 'register');
      expect(
        tester
            .widget<TextField>(field('Email verification code'))
            .controller!
            .text,
        isEmpty,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'student password recovery verifies OTP before accepting a strong confirmed password',
    (tester) async {
      final calls = <http.Request>[];
      final api = LmsApi(
        client: MockClient((request) async {
          calls.add(request);
          if (request.url.path.endsWith('/request')) {
            return http.Response(
              jsonEncode({
                'challengeId': 'challenge',
                'resendAfter': 60,
                'expiresIn': 600,
              }),
              200,
            );
          }
          if (request.url.path.endsWith('/verify')) {
            expect(jsonDecode(request.body)['purpose'], 'reset');
            return http.Response(
              jsonEncode({'resetToken': 'verified-reset-token'}),
              200,
            );
          }
          expect(request.url.path, '/api/mobile/auth/reset-password');
          expect(jsonDecode(request.body), {
            'resetToken': 'verified-reset-token',
            'newPassword': 'Updated2026!',
          });
          return http.Response(
            jsonEncode({'message': 'Password updated.'}),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(tester, PasswordResetScreen(api: api));
      await enter(tester, 'Email address', 'student@example.edu');
      await tap(tester, 'Send reset code');
      expect(find.text('New password'), findsNothing);
      await enter(tester, 'Email verification code', '123456');
      await tap(tester, 'Verify code');
      expect(find.text('Choose a new password.'), findsOneWidget);
      await enter(tester, 'New password', 'weak');
      await enter(tester, 'Confirm new password', 'different');
      await tap(tester, 'Update password');
      expect(calls.length, 2);
      expect(find.text('Passwords must match.'), findsOneWidget);
      await enter(tester, 'New password', 'Updated2026!');
      await enter(tester, 'Confirm new password', 'Updated2026!');
      await tap(tester, 'Update password');
      expect(calls.length, 3);
      expect(find.text('You’re ready to return.'), findsOneWidget);
      expect(api.user, isNull);
      expect(tester.takeException(), isNull);
    },
  );
}
