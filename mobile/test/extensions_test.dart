import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/extensions_screen.dart';
import 'package:classroom_mobile/submission_screen.dart';
import 'package:classroom_mobile/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final original = DateTime.now()
          .subtract(const Duration(days: 1))
          .toUtc()
          .toIso8601String(),
      extended = DateTime.now()
          .add(const Duration(days: 4))
          .toUtc()
          .toIso8601String();
  Json assignment() => {
    '_id': 'a1',
    'title': 'Extension mobile assignment',
    'dueDate': original,
    'instructions': 'Complete and submit your response.',
    'maxPoints': 100,
    'allowLate': false,
  };
  Json history(String status, {String comment = ''}) => {
    '_id': 'r1',
    'reason': 'I need additional time to finish my research carefully.',
    'status': status,
    'scope': 'student',
    'originalDueDate': original,
    'previousDueDate': original,
    'requestedDueDate': extended,
    'createdAt': DateTime.now().toUtc().toIso8601String(),
    'reviewedAt': DateTime.now().toUtc().toIso8601String(),
    'comment': comment,
  };
  Finder input(String label) => find.byWidgetPredicate(
    (widget) => widget is TextField && widget.decoration?.labelText == label,
  );
  Future<void> render(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(320, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(theme: knowhereTheme(), home: child));
    await tester.pumpAndSettle();
  }

  Future<void> tap(WidgetTester tester, String text) async {
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text(text));
    await tester.pumpAndSettle();
    await tester.tap(find.text(text));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'extension form validates reason/date and posts a UTC deadline before showing pending history',
    (tester) async {
      bool pending = false;
      final requests = <http.Request>[];
      final api = LmsApi(
        client: MockClient((request) async {
          requests.add(request);
          if (request.method == 'POST') {
            final body = jsonDecode(request.body);
            expect(
              body['reason'],
              'I need extra time to finish this response carefully.',
            );
            expect(
              DateTime.parse(body['requestedDueDate']).isAfter(DateTime.now()),
              true,
            );
            pending = true;
            return http.Response('{}', 201);
          }
          return http.Response(
            jsonEncode({
              'assignment': assignment(),
              'canRequest': !pending,
              'pending': pending ? 1 : 0,
              'items': pending ? [history('pending')] : [],
              'page': 1,
              'pages': 1,
              'total': pending ? 1 : 0,
            }),
            200,
          );
        }),
      );
      addTearDown(api.dispose);
      await render(tester, ExtensionsScreen(api: api, assignmentId: 'a1'));
      await tester.enterText(input('Reason for extension'), 'hi');
      await tester.pumpAndSettle();
      expect(
        find.text('Enter a reason with at least 10 characters.'),
        findsOneWidget,
      );
      await tap(tester, 'Send extension request');
      expect(requests.where((r) => r.method == 'POST'), isEmpty);
      await tester.enterText(
        input('Reason for extension'),
        'I need extra time to finish this response carefully.',
      );
      await tap(tester, 'Send extension request');
      expect(
        find.text('Choose a future date later than your current deadline.'),
        findsOneWidget,
      );
      await tap(tester, 'Choose requested deadline');
      await tap(tester, 'OK');
      await tap(tester, 'OK');
      await tap(tester, 'Send extension request');
      expect(pending, true);
      expect(find.text('Request Deadline Extension'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'student reads rejected request and comment while the original deadline stays visible',
    (tester) async {
      final api = LmsApi(
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              'assignment': assignment(),
              'canRequest': false,
              'pending': 0,
              'items': [
                history(
                  'rejected',
                  comment: 'Please keep the original deadline.',
                ),
              ],
              'page': 1,
              'pages': 1,
              'total': 1,
            }),
            200,
          ),
        ),
      );
      addTearDown(api.dispose);
      await render(tester, ExtensionsScreen(api: api, assignmentId: 'a1'));
      await tester.scrollUntilVisible(
        find.text('Please keep the original deadline.'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.text('Rejected. This decision did not change your deadline.'),
        findsOneWidget,
      );
      expect(find.text('Please keep the original deadline.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'returning from extension history refreshes an approved personal deadline and unlocks the submission form',
    (tester) async {
      final api = LmsApi(
        client: MockClient(
          (request) async => http.Response(
            jsonEncode({
              'assignment': {
                ...assignment(),
                'dueDate': extended,
                'originalDueDate': original,
                'hasIndividualExtension': true,
              },
              'canRequest': false,
              'pending': 0,
              'items': [history('approved', comment: 'Approved for you only.')],
              'page': 1,
              'pages': 1,
              'total': 1,
            }),
            200,
          ),
        ),
      );
      addTearDown(api.dispose);
      await render(
        tester,
        SubmissionScreen(api: api, assignment: assignment()),
      );
      expect(find.text('Submit assignment'), findsNothing);
      await tap(tester, 'Request Deadline Extension');
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Submit assignment'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Submit assignment'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
