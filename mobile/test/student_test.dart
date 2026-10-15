import 'dart:convert';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/auth_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'mobile login uses student endpoint and sends bearer credentials on API requests',
    () async {
      final calls = <http.Request>[];
      final client = MockClient((request) async {
        calls.add(request);
        if (request.url.path.endsWith('/login')) {
          return http.Response(
            jsonEncode({
              'user': {'_id': 'student1', 'name': 'Student', 'role': 'student'},
              'token': 'test-token',
            }),
            200,
          );
        }
        return http.Response(jsonEncode({'courses': []}), 200);
      });
      final api = LmsApi(client: client);
      await api.authenticate({
        'email': 'student@example.test',
        'password': 'Password2026!',
      });
      await api.get('/dashboard');
      expect(calls.first.url.path, '/api/mobile/auth/login');
      expect(calls.last.headers['Authorization'], 'Bearer test-token');
      expect(api.user!['role'], 'student');
      expect(await api.storage.read(key: 'lms_token'), 'test-token');
      api.dispose();
    },
  );
  test('instructor response is rejected without storing a token', () async {
    final api = LmsApi(
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({
            'user': {'role': 'instructor'},
            'token': 'forbidden',
          }),
          200,
        ),
      ),
    );
    await expectLater(
      api.authenticate({
        'email': 'instructor@example.test',
        'password': 'Password2026!',
      }),
      throwsA(isA<ApiError>()),
    );
    expect(api.user, isNull);
    expect(await api.storage.read(key: 'lms_token'), isNull);
    api.dispose();
  });
  test('expired sessions clear secure storage', () async {
    FlutterSecureStorage.setMockInitialValues({'lms_token': 'expired-token'});
    final api = LmsApi(
      client: MockClient(
        (_) async => http.Response(jsonEncode({'message': 'Expired'}), 401),
      ),
    );
    await expectLater(api.restore(), throwsA(isA<ApiError>()));
    expect(api.user, isNull);
    expect(await api.storage.read(key: 'lms_token'), isNull);
    api.dispose();
  });
  test(
    'browser file attachments upload from bytes without a device path',
    () async {
      String? uploaded;
      final api = LmsApi(
        client: MockClient((request) async {
          uploaded = request.body;
          expect(
            request.headers['content-type'],
            contains('multipart/form-data'),
          );
          return http.Response('{"message":"Assignment submitted."}', 201);
        }),
      );
      final bytes = Uint8List.fromList(
        utf8.encode('Student browser attachment'),
      );
      await api.submit(
        'test-assignment',
        'My response',
        PlatformFile(name: 'answer.txt', size: bytes.length, bytes: bytes),
      );
      expect(uploaded, contains('answer.txt'));
      expect(uploaded, contains('Student browser attachment'));
      expect(uploaded, contains('My response'));
      api.dispose();
    },
  );
  test('oversized attachments fail before any upload request', () async {
    bool called = false;
    final api = LmsApi(
      client: MockClient((_) async {
        called = true;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.submit(
        'test-assignment',
        '',
        PlatformFile(
          name: 'large.zip',
          size: 21 * 1024 * 1024,
          bytes: Uint8List(0),
        ),
      ),
      throwsA(isA<ApiError>()),
    );
    expect(called, false);
    api.dispose();
  });
  testWidgets(
    'student login validates input and registration exposes no instructor role',
    (tester) async {
      final api = LmsApi();
      await tester.pumpWidget(MaterialApp(home: AuthScreen(api: api)));
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('Enter a valid email address.'), findsOneWidget);
      expect(find.text('Enter your password.'), findsOneWidget);
      await tester.ensureVisible(
        find.text('New here? Create a student account'),
      );
      await tester.tap(find.text('New here? Create a student account'));
      await tester.pumpAndSettle();
      expect(find.text('Create student account'), findsOneWidget);
      expect(find.text('Instructor'), findsNothing);
      api.dispose();
    },
  );
}
