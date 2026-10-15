import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'api.dart';
import 'widgets.dart';
import 'submission_screen.dart';

class CourseScreen extends StatefulWidget {
  final LmsApi api;
  final String courseId;
  final int initialTab;
  const CourseScreen({
    super.key,
    required this.api,
    required this.courseId,
    this.initialTab = 0,
  });
  @override
  State<CourseScreen> createState() => _CourseScreenState();
}

class _CourseScreenState extends State<CourseScreen> {
  late Future<Json> future;
  late int tab;
  bool joining = false;
  @override
  void initState() {
    super.initState();
    tab = widget.initialTab;
    load();
  }

  void load() {
    future = widget.api
        .get('/courses/${widget.courseId}')
        .then((v) => Map<String, dynamic>.from(v));
  }

  Future<void> refresh() async {
    setState(load);
    try {
      await future;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text(
        'Your classroom',
        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    ),
    body: FutureBuilder<Json>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) return ErrorView(snapshot.error!, refresh);
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final course = snapshot.data!;
        return RefreshIndicator(
          onRefresh: refresh,
          child: ListView(
            padding: const EdgeInsets.all(22),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              AppCard(
                color: courseColor(course['color']),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Tag(course['code']),
                    const SizedBox(height: 17),
                    Text(
                      course['title'],
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -.5,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      course['description'],
                      style: const TextStyle(
                        color: muted,
                        height: 1.7,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      '${course['instructorName']} · ${course['studentCount']} students',
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              if (course['enrolled'] != true)
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Your next chapter is here.',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Join to access learning materials, assignments, and course updates.',
                        style: TextStyle(
                          color: muted,
                          height: 1.7,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: joining
                            ? null
                            : () async {
                                setState(() => joining = true);
                                try {
                                  await widget.api.send(
                                    'POST',
                                    '/courses/${widget.courseId}/enroll',
                                  );
                                  if (context.mounted) {
                                    notify(
                                      context,
                                      'Welcome to your new classroom!',
                                    );
                                    refresh();
                                  }
                                } catch (e) {
                                  if (context.mounted) {
                                    notify(context, e.toString(), error: true);
                                  }
                                } finally {
                                  if (mounted) setState(() => joining = false);
                                }
                              },
                        child: Text(joining ? 'Joining…' : 'Join course'),
                      ),
                    ],
                  ),
                )
              else ...[
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(
                        value: 0,
                        label: Text(
                          'Materials',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                      ButtonSegment(
                        value: 1,
                        label: Text(
                          'Assignments',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                      ButtonSegment(
                        value: 2,
                        label: Text('Updates', style: TextStyle(fontSize: 11)),
                      ),
                    ],
                    selected: {tab},
                    onSelectionChanged: (v) => setState(() => tab = v.first),
                  ),
                ),
                const SizedBox(height: 23),
                ...content(course),
              ],
            ],
          ),
        );
      },
    ),
  );
  List<Widget> content(Json course) {
    final type = ['materials', 'assignments', 'announcements'][tab];
    final items = records(course[type]);
    if (items.isEmpty) {
      return [
        const AppCard(
          child: EmptyView(
            'A fresh page',
            'Your instructor will add content here soon.',
          ),
        ),
      ];
    }
    return items
        .map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 17),
            child: AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        tab == 0
                            ? Icons.description_outlined
                            : tab == 1
                            ? Icons.assignment_outlined
                            : Icons.campaign_outlined,
                        color: purple,
                        size: 23,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          item['title'],
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (item['pinned'] == true)
                        const Icon(
                          Icons.push_pin_outlined,
                          size: 17,
                          color: purple,
                        ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  if (tab == 0) ...[
                    if ((item['description'] ?? '').isNotEmpty)
                      Text(
                        item['description'],
                        style: const TextStyle(
                          color: muted,
                          height: 1.7,
                          fontSize: 12,
                        ),
                      ),
                    const SizedBox(height: 15),
                    if (item['file'] != null)
                      DownloadButton(
                        api: widget.api,
                        file: Map<String, dynamic>.from(item['file']),
                      ),
                    if ((item['url'] ?? '').isNotEmpty)
                      TextButton.icon(
                        onPressed: () async {
                          try {
                            final uri = Uri.parse(item['url']);
                            if (!['http', 'https'].contains(uri.scheme) ||
                                !await launchUrl(
                                  uri,
                                  mode: LaunchMode.externalApplication,
                                )) {
                              throw ApiError('Unable to open this link.');
                            }
                          } catch (e) {
                            if (mounted) {
                              notify(context, e.toString(), error: true);
                            }
                          }
                        },
                        icon: const Icon(Icons.open_in_new, size: 17),
                        label: const Text('Open resource'),
                      ),
                  ],
                  if (tab == 1) ...[
                    Text(
                      'Due ${date(item['dueDate'], time: true)}',
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                    const SizedBox(height: 8),
                    Tag('${item['maxPoints']} points'),
                    const SizedBox(height: 15),
                    Text(
                      item['instructions'],
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: muted,
                        height: 1.7,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 18),
                    FilledButton.tonalIcon(
                      onPressed: () async {
                        final submission = records(course['submissions'])
                            .where((s) => s['assignmentId'] == item['_id'])
                            .firstOrNull;
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => SubmissionScreen(
                              api: widget.api,
                              assignment: item,
                              submission: submission,
                            ),
                          ),
                        );
                        if (mounted) refresh();
                      },
                      icon: const Icon(Icons.arrow_forward, size: 17),
                      label: const Text('View assignment'),
                    ),
                  ],
                  if (tab == 2) ...[
                    Text(
                      date(item['createdAt'], time: true),
                      style: const TextStyle(color: muted, fontSize: 10),
                    ),
                    const SizedBox(height: 15),
                    Text(
                      item['body'],
                      style: const TextStyle(
                        color: muted,
                        height: 1.8,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        )
        .toList();
  }
}
