import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/learning_screen.dart';
import 'package:classroom_mobile/inbox_screen.dart';
import 'package:classroom_mobile/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  Future<void> render(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(320, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: knowhereTheme(), home: child));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'student quiz sends revision and selected answers then displays permitted score review',
    (tester) async {
      bool submitted = false;
      final api = LmsApi(
        client: MockClient((request) async {
          if (request.method == 'POST') {
            expect(request.url.path, '/api/quizzes/q1/attempts');
            expect(jsonDecode(request.body), {
              'revision': 3,
              'answers': [1],
            });
            submitted = true;
            return http.Response('{}', 201);
          }
          if (request.url.path.endsWith('/attempts')) {
            return http.Response(
              jsonEncode({
                'items': submitted
                    ? [
                        {
                          '_id': 'a1',
                          'attemptNumber': 1,
                          'score': 4,
                          'maxScore': 4,
                          'submittedAt': '2026-10-16T01:00:00Z',
                          'reviewAllowed': true,
                          'review': [
                            {
                              'prompt': 'Which is a correct answer?',
                              'options': ['Incorrect', 'Correct'],
                              'chosenIndex': 1,
                              'correctIndex': 1,
                              'earned': 4,
                              'points': 4,
                              'explanation': 'The second option is correct.',
                            },
                          ],
                        },
                      ]
                    : [],
              }),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              '_id': 'q1',
              'title': 'A student quiz',
              'instructions': 'Choose one option.',
              'revision': 3,
              'maxAttempts': 1,
              'attemptCount': submitted ? 1 : 0,
              'canAttempt': !submitted,
              'maxScore': 4,
              'closesAt': null,
              'reviewPolicy': 'immediate',
              'questions': [
                {
                  'prompt': 'Which is a correct answer?',
                  'options': ['Incorrect', 'Correct'],
                  'points': 4,
                },
              ],
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(tester, QuizScreen(api: api, quizId: 'q1'));
      await tester.tap(find.text('Start attempt 1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Correct'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Submit answers'));
      await tester.tap(find.text('Submit answers'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, 'Submit answers').last,
      );
      await tester.pumpAndSettle();
      expect(submitted, true);
      expect(find.text('Attempt 1: 4 / 4'), findsOneWidget);
      await tester.ensureVisible(find.text('Review answers'));
      await tester.tap(find.text('Review answers'));
      await tester.pumpAndSettle();
      expect(find.text('Correct answer: Correct'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('restricted quiz review never invents or displays answer keys', (
    tester,
  ) async {
    final api = LmsApi(
      client: MockClient(
        (request) async => http.Response(
          jsonEncode(
            request.url.path.endsWith('/attempts')
                ? {
                    'items': [
                      {
                        '_id': 'a1',
                        'attemptNumber': 1,
                        'score': 0,
                        'maxScore': 4,
                        'submittedAt': '2026-10-16T01:00:00Z',
                        'reviewAllowed': false,
                      },
                    ],
                  }
                : {
                    '_id': 'q1',
                    'title': 'Restricted quiz',
                    'instructions': 'Choose one.',
                    'revision': 1,
                    'maxAttempts': 1,
                    'attemptCount': 1,
                    'canAttempt': false,
                    'maxScore': 4,
                    'reviewPolicy': 'never',
                    'questions': [],
                  },
          ),
          200,
        ),
      ),
    );
    addTearDown(api.dispose);
    await render(tester, QuizScreen(api: api, quizId: 'q1'));
    expect(find.text('Attempt 1: 0 / 4'), findsOneWidget);
    expect(find.text('Review answers'), findsNothing);
    expect(find.textContaining('restricted by the instructor'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'lecture completion uses shared API and updates course progress on a narrow phone',
    (tester) async {
      bool complete = false;
      final api = LmsApi(
        client: MockClient((request) async {
          if (request.method == 'PUT') {
            expect(request.url.path, '/api/materials/m1/completion');
            complete = jsonDecode(request.body)['completed'];
            return http.Response('{}', 200);
          }
          return http.Response(
            jsonEncode({
              'summary': {
                'progressPercent': complete ? 100 : 0,
                'completedUnits': complete ? 1 : 0,
                'totalUnits': 1,
              },
              'lectures': [
                {
                  '_id': 'm1',
                  'title': 'Read the first lecture',
                  'completed': complete,
                },
              ],
              'assignments': [],
              'quizzes': [],
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(
        tester,
        Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: CourseProgressView(api: api, courseId: 'c1'),
          ),
        ),
      );
      await tester.ensureVisible(find.text('Mark complete'));
      await tester.tap(find.text('Mark complete'));
      await tester.pumpAndSettle();
      expect(complete, true);
      expect(find.text('100%'), findsOneWidget);
      await tester.tap(find.text('Mark incomplete'));
      await tester.pumpAndSettle();
      expect(complete, false);
      expect(find.text('0%'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'student inbox marks notifications read, refreshes, and handles API retry',
    (tester) async {
      bool read = false, failed = true;
      final api = LmsApi(
        client: MockClient((request) async {
          if (request.method == 'PATCH') {
            expect(request.url.path, '/api/notifications/n1/read');
            read = true;
            return http.Response('{}', 200);
          }
          if (failed) {
            failed = false;
            return http.Response(
              jsonEncode({'message': 'Inbox temporarily unavailable'}),
              503,
            );
          }
          return http.Response(
            jsonEncode({
              'items': [
                {
                  '_id': 'n1',
                  'title': 'School calendar',
                  'body': 'Read the updated school calendar.',
                  'createdAt': '2026-10-16T01:00:00Z',
                  'read': read,
                },
              ],
              'total': 1,
              'unread': read ? 0 : 1,
              'page': 1,
              'pages': 1,
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(tester, InboxScreen(api: api));
      expect(find.text('Inbox temporarily unavailable'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mark as read'));
      await tester.pumpAndSettle();
      expect(read, true);
      expect(find.text('Read'), findsOneWidget);
      expect(find.textContaining('0 unread'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
