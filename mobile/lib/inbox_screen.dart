import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';
import 'course_screen.dart';
import 'extensions_screen.dart';

class InboxScreen extends StatefulWidget {
  final LmsApi api;
  const InboxScreen({super.key, required this.api});
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  late Future<dynamic> future;
  int page = 1;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = widget.api.get('/notifications?page=$page');
  }

  Future<void> mark(String path, String method) async {
    setState(() => busy = true);
    try {
      await widget.api.send(method, path);
      if (mounted) setState(load);
    } catch (e) {
      if (mounted) notify(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Your inbox'),
      actions: [
        IconButton(
          tooltip: 'Mark all as read',
          onPressed: busy
              ? null
              : () => mark('/notifications/read-all', 'POST'),
          icon: const Icon(Icons.done_all),
        ),
      ],
    ),
    body: FutureBuilder<dynamic>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return ErrorView(snapshot.error!, () => setState(load));
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data, items = records(data['items']);
        return RefreshIndicator(
          onRefresh: () async {
            setState(load);
            try {
              await future;
            } catch (_) {}
          },
          child: ListView(
            padding: const EdgeInsets.all(22),
            children: [
              Text(
                '${data['unread']} unread · ${data['total']} current notifications',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              const Text(
                'School updates, new materials, and assignment or quiz deadlines. Reminders cover the next 7 days; submitted work clears its reminders. Read states are shared with student web.',
              ),
              const SizedBox(height: 20),
              if (items.isEmpty)
                const EmptyView(
                  'You’re all caught up',
                  'Your school and course updates will appear here.',
                ),
              ...items.map(
                (n) => Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Tag(n['read'] == true ? 'Read' : 'Unread'),
                        const SizedBox(height: 12),
                        Text(
                          n['title'],
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(n['body']),
                        const SizedBox(height: 12),
                        Text(
                          date(n['createdAt'], time: true),
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                        if (n['read'] != true)
                          TextButton(
                            onPressed: busy
                                ? null
                                : () => mark(
                                    '/notifications/${n['_id']}/read',
                                    'PATCH',
                                  ),
                            child: const Text('Mark as read'),
                          ),
                        if (n['courseId'] != null)
                          FilledButton.tonal(
                            onPressed: () async {
                              if (n['extensionAssignmentId'] != null) {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ExtensionsScreen(
                                      api: widget.api,
                                      assignmentId: n['extensionAssignmentId'],
                                    ),
                                  ),
                                );
                                if (mounted) setState(load);
                                return;
                              }
                              final tab =
                                  {
                                    'materials': 0,
                                    'assignments': 1,
                                    'announcements': 2,
                                    'quizzes': 3,
                                    'progress': 4,
                                  }[n['tab']] ??
                                  0;
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CourseScreen(
                                    api: widget.api,
                                    courseId: n['courseId'],
                                    initialTab: tab,
                                  ),
                                ),
                              );
                              if (mounted) setState(load);
                            },
                            child: Text(
                              n['extensionAssignmentId'] != null
                                  ? 'View extension request'
                                  : 'Open course',
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (data['pages'] > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: page > 1
                          ? () => setState(() {
                              page--;
                              load();
                            })
                          : null,
                      child: const Text('Previous'),
                    ),
                    Text('$page / ${data['pages']}'),
                    TextButton(
                      onPressed: page < data['pages']
                          ? () => setState(() {
                              page++;
                              load();
                            })
                          : null,
                      child: const Text('Next'),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    ),
  );
}
