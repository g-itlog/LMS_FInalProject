import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/auth_screen.dart';
import 'package:classroom_mobile/auth_validation.dart';
import 'package:classroom_mobile/theme.dart';

Finder input(String label) => find.byWidgetPredicate(
  (widget) => widget is TextField && widget.decoration?.labelText == label,
);

Future<void> enter(WidgetTester tester, String label, String value) async {
  await tester.ensureVisible(input(label));
  await tester.enterText(input(label), value);
  await tester.pumpAndSettle();
}

Future<void> tapText(WidgetTester tester, String text) async {
  await tester.ensureVisible(find.text(text));
  await tester.tap(find.text(text));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('name and email rules match the web form and API limits', () {
    expect(validateAuthName('  '), 'Enter your full name.');
    expect(validateAuthName('A'), isNotNull);
    expect(validateAuthName('A' * 81), isNotNull);
    expect(validateAuthName(' Ana Cruz '), isNull);
    expect(validateAuthEmail(''), 'Enter your email address.');
    for (final email in [
      'ana',
      'ana@',
      'ana@example',
      'ana..cruz@example.edu',
      'ana@example..edu',
      'ana @example.edu',
      '${'a' * 150}@example.edu',
    ]) {
      expect(validateAuthEmail(email), isNotNull, reason: email);
    }
    expect(validateAuthEmail(' ANA.CRUZ+class@EXAMPLE.EDU '), isNull);
  });

  test('registration checks every password rule and the UTF-8 boundary', () {
    for (final password in [
      'Short1',
      'lowercase42',
      'UPPERCASE42',
      'NoNumbersHere',
      'A1${'a' * 71}',
      'Aa1${'é' * 35}',
      'Aa1${'😀' * 18}',
    ]) {
      expect(
        validateAuthPassword(password, register: true),
        isNotNull,
        reason: password,
      );
    }
    expect(validateAuthPassword('Aa1${'a' * 69}', register: true), isNull);
    expect(validateAuthPassword('Aa1${'é' * 34}', register: true), isNull);
    expect(
      passwordRequirements('Learning42').every((rule) => rule.met),
      isTrue,
    );
  });

  test('login requires a password without enforcing registration strength', () {
    expect(validateAuthPassword(''), 'Enter your password.');
    expect(validateAuthPassword('x'), isNull);
    expect(validateAuthPassword('x' * 200), isNull);
    expect(validateAuthPassword('x' * 201), isNotNull);
  });

  testWidgets(
    'login validates while typing and keeps credential checks on submit',
    (tester) async {
      final calls = <http.Request>[];
      final api = LmsApi(
        client: MockClient((request) async {
          calls.add(request);
          return http.Response(
            '{"message":"Email or password is incorrect."}',
            401,
          );
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: knowhereTheme(),
          home: AuthScreen(api: api),
        ),
      );
      expect(find.text('Enter your email address.'), findsNothing);
      await enter(tester, 'Email address', 'student@');
      expect(find.textContaining('Enter a valid email'), findsOneWidget);
      expect(find.text('Enter your password.'), findsNothing);
      expect(calls, isEmpty);
      await tapText(tester, 'Sign in');
      expect(calls, isEmpty);
      expect(
        tester.widget<TextField>(input('Email address')).focusNode!.hasFocus,
        isTrue,
      );
      await enter(tester, 'Email address', 'student@example.edu');
      expect(find.textContaining('Enter a valid email'), findsNothing);
      await enter(tester, 'Password', 'x');
      expect(find.text('Enter your password.'), findsNothing);
      expect(find.byTooltip('Show password'), findsOneWidget);
      await tester.tap(find.byTooltip('Show password'));
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(input('Password')).obscureText, isFalse);
      await tapText(tester, 'Sign in');
      expect(calls, hasLength(1));
      expect(calls.single.url.path, '/api/mobile/auth/login');
      expect(find.text('Email or password is incorrect.'), findsOneWidget);
      await enter(tester, 'Password', 'Learning42');
      expect(find.text('Email or password is incorrect.'), findsNothing);
      expect(calls, hasLength(1));
    },
  );

  testWidgets(
    'student registration has a live checklist and blocks invalid requests on a small phone',
    (tester) async {
      tester.view.physicalSize = const Size(320, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final calls = <http.Request>[];
      final api = LmsApi(
        client: MockClient((request) async {
          calls.add(request);
          return http.Response(
            jsonEncode({
              'user': {
                '_id': 'student1',
                'name': 'Ana Cruz',
                'role': 'student',
              },
              'token': 'test-token',
            }),
            201,
          );
        }),
      );
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: knowhereTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.3)),
            child: child!,
          ),
          home: AuthScreen(api: api),
        ),
      );
      await tapText(tester, 'New here? Create a student account');
      expect(find.text('Enter your email address.'), findsNothing);
      expect(find.text('Enter your password.'), findsNothing);
      expect(find.text('Instructor'), findsNothing);
      await enter(tester, 'Full name', ' ');
      expect(find.text('Enter your full name.'), findsOneWidget);
      await enter(tester, 'Full name', 'Ana Cruz');
      expect(find.text('Enter your full name.'), findsNothing);
      await enter(tester, 'Email address', 'ana@example.edu');
      await enter(tester, 'Password', 'learning');
      expect(find.text('Include an uppercase letter.'), findsOneWidget);
      expect(find.byIcon(Icons.check), findsNWidgets(2));
      await enter(tester, 'Password', 'Aa1${'é' * 35}');
      expect(find.textContaining('exceeds 72 bytes'), findsOneWidget);
      await tapText(tester, 'Create student account');
      expect(calls, isEmpty);
      expect(
        tester.widget<TextField>(input('Password')).focusNode!.hasFocus,
        isTrue,
      );
      await enter(tester, 'Password', 'Learning42');
      expect(find.textContaining('exceeds 72 bytes'), findsNothing);
      expect(find.byIcon(Icons.check), findsNWidgets(4));
      expect(tester.takeException(), isNull);
      await tapText(tester, 'Create student account');
      expect(calls, hasLength(1));
      expect(calls.single.url.path, '/api/mobile/auth/register');
      expect(jsonDecode(calls.single.body)['role'], 'student');
      expect(api.user!['role'], 'student');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'switching auth modes resets values, visibility, and validation',
    (tester) async {
      final api = LmsApi();
      addTearDown(api.dispose);
      await tester.pumpWidget(
        MaterialApp(
          theme: knowhereTheme(),
          home: AuthScreen(api: api),
        ),
      );
      await enter(tester, 'Email address', 'broken');
      await enter(tester, 'Password', 'x');
      await tester.tap(find.byTooltip('Show password'));
      await tester.pumpAndSettle();
      await tapText(tester, 'New here? Create a student account');
      expect(
        tester.widget<TextField>(input('Email address')).controller!.text,
        isEmpty,
      );
      expect(
        tester.widget<TextField>(input('Password')).controller!.text,
        isEmpty,
      );
      expect(tester.widget<TextField>(input('Password')).obscureText, isTrue);
      expect(find.textContaining('Enter a valid email'), findsNothing);
      expect(find.text('Enter your password.'), findsNothing);
      await enter(tester, 'Password', 'weak');
      expect(
        find.text('Use 8–72 characters for your password.'),
        findsOneWidget,
      );
      await tapText(tester, 'Already have an account? Sign in');
      expect(find.text('Use 8–72 characters for your password.'), findsNothing);
      expect(
        tester.widget<TextField>(input('Password')).controller!.text,
        isEmpty,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
