import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:classroom_mobile/api.dart';
import 'package:classroom_mobile/auth_screen.dart';
import 'package:classroom_mobile/home_screen.dart';
import 'package:classroom_mobile/course_screen.dart';
import 'package:classroom_mobile/submission_screen.dart';
import 'package:classroom_mobile/profile_screen.dart';
import 'package:classroom_mobile/widgets.dart';
import 'package:classroom_mobile/theme.dart';

// Fixtures contain only seeded demonstration records read from the real API.
class FixtureApi extends LmsApi {
  final Json fixture;
  FixtureApi(this.fixture) {
    user = Map<String, dynamic>.from(fixture['user']);
  }
  @override
  Future<dynamic> get(String path) async {
    if (path == '/dashboard') return fixture['dashboard'];
    if (path.startsWith('/courses?')) return fixture['catalog'];
    if (path.startsWith('/courses/')) return fixture['course'];
    throw ApiError('Unexpected test endpoint: $path');
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Json fixture;
  setUpAll(() async {
    final icons = FontLoader('MaterialIcons');
    icons.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    fixture = Map<String, dynamic>.from(
      jsonDecode(await File('test/fixtures/demo.json').readAsString()),
    );
    final systemFont = File('C:/Windows/Fonts/segoeui.ttf');
    if (await systemFont.exists()) {
      final loader = FontLoader('Roboto');
      loader.addFont(
        Future.value(ByteData.sublistView(await systemFont.readAsBytes())),
      );
      await loader.load();
    }
  });
  Future<void> render(WidgetTester tester, Widget screen, String name) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: classroomTheme(),
          home: screen,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final output = File('../docs/screenshots/flutter-$name.png');
      await output.parent.create(recursive: true);
      await output.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  testWidgets('Flutter student login renders at phone size', (tester) async {
    final api = FixtureApi(fixture);
    await render(tester, AuthScreen(api: api), 'login');
    expect(find.text('Sign in'), findsWidgets);
    api.dispose();
  });
  testWidgets(
    'Flutter student dashboard and bottom navigation render without overflow',
    (tester) async {
      final api = FixtureApi(fixture);
      await render(tester, HomeScreen(api: api), 'dashboard');
      expect(find.text('Home'), findsOneWidget);
      await tester.tap(find.text('Courses').last);
      await tester.pumpAndSettle();
      expect(find.text('Explore'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Assignments').last);
      await tester.pumpAndSettle();
      expect(find.text('Assignments & grades'), findsOneWidget);
      expect(tester.takeException(), isNull);
      api.dispose();
    },
  );
  testWidgets('Flutter course materials render without overflow', (
    tester,
  ) async {
    final api = FixtureApi(fixture);
    await render(
      tester,
      CourseScreen(api: api, courseId: fixture['course']['_id']),
      'materials',
    );
    expect(find.text('Getting started with React'), findsOneWidget);
    api.dispose();
  });
  testWidgets('Flutter assignment instructions and submission form render', (
    tester,
  ) async {
    final api = FixtureApi(fixture);
    final assignment = records(
      fixture['course']['assignments'],
    ).firstWhere((a) => a['title'] == 'Build your first REST API');
    await render(
      tester,
      SubmissionScreen(api: api, assignment: assignment),
      'assignment',
    );
    expect(find.text('Your response'), findsOneWidget);
    api.dispose();
  });
  testWidgets('Flutter grade and instructor feedback render', (tester) async {
    final api = FixtureApi(fixture);
    final submission = records(
      fixture['course']['submissions'],
    ).firstWhere((s) => s['grade'] != null);
    final assignment = records(
      fixture['course']['assignments'],
    ).firstWhere((a) => a['_id'] == submission['assignmentId']);
    await render(
      tester,
      SubmissionScreen(
        api: api,
        assignment: assignment,
        submission: submission,
      ),
      'grades',
    );
    expect(find.text('92 / 100'), findsOneWidget);
    api.dispose();
  });
  testWidgets('Flutter student profile renders without overflow', (
    tester,
  ) async {
    final api = FixtureApi(fixture);
    await render(
      tester,
      Scaffold(
        appBar: AppBar(title: const Text('Classroom')),
        body: ProfileScreen(api: api),
      ),
      'profile',
    );
    expect(find.text('STUDENT ACCOUNT'), findsOneWidget);
    api.dispose();
  });
  testWidgets('Flutter course view fits a narrow phone with larger text', (
    tester,
  ) async {
    final api = FixtureApi(fixture);
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(1.3)),
          child: child!,
        ),
        home: CourseScreen(
          api: api,
          courseId: fixture['course']['_id'],
          initialTab: 1,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    api.dispose();
  });
}
