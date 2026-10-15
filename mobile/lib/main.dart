import 'package:flutter/material.dart';
import 'api.dart';
import 'auth_screen.dart';
import 'home_screen.dart';
import 'widgets.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ClassroomApp());
}

class ClassroomApp extends StatefulWidget {
  const ClassroomApp({super.key});
  @override
  State<ClassroomApp> createState() => _ClassroomAppState();
}

class _ClassroomAppState extends State<ClassroomApp> {
  final api = LmsApi();
  final navigator = GlobalKey<NavigatorState>();
  late Future<void> startup;
  @override
  void initState() {
    super.initState();
    startup = api.restore();
    api.addListener(changed);
  }

  void changed() {
    if (mounted) setState(() {});
    if (api.user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        navigator.currentState?.popUntil((route) => route.isFirst);
      });
    }
  }

  @override
  void dispose() {
    api.removeListener(changed);
    api.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    navigatorKey: navigator,
    title: 'Classroom',
    debugShowCheckedModeBanner: false,
    theme: classroomTheme(),
    home: FutureBuilder<void>(
      future: startup,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.hasError &&
            api.user == null &&
            snapshot.error is! ApiError) {
          return Scaffold(
            body: ErrorView(
              snapshot.error!,
              () => setState(() => startup = api.restore()),
            ),
          );
        }
        if (snapshot.hasError &&
            api.user == null &&
            (snapshot.error as ApiError?)?.status != 401) {
          return Scaffold(
            body: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ErrorView(
                  snapshot.error!,
                  () => setState(() => startup = api.restore()),
                ),
                TextButton(
                  onPressed: () async {
                    await api.clear();
                    if (mounted) setState(() => startup = Future.value());
                  },
                  child: const Text('Return to sign in'),
                ),
              ],
            ),
          );
        }
        return api.user == null
            ? AuthScreen(api: api)
            : HomeScreen(key: ValueKey(api.user!['_id']), api: api);
      },
    ),
  );
}
