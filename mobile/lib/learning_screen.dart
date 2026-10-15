import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';

class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Text(
      text,
      style: const TextStyle(
        fontFamily: 'Lora',
        fontSize: 22,
        fontWeight: FontWeight.w500,
      ),
    ),
  );
}

/// Student-only views. All scoring, attempt limits and review rules come from the API.
class QuizList extends StatefulWidget {
  final LmsApi api;
  final String courseId;
  const QuizList({super.key, required this.api, required this.courseId});
  @override
  State<QuizList> createState() => _QuizListState();
}

class _QuizListState extends State<QuizList> {
  late Future<dynamic> future;
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = widget.api.get('/courses/${widget.courseId}/quizzes');
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return ErrorView(snapshot.error!, () => setState(load));
      }
      if (!snapshot.hasData) {
        return const Center(child: CircularProgressIndicator());
      }
      final items = records(snapshot.data['items']);
      if (items.isEmpty) {
        return const EmptyView(
          'Your next challenge awaits',
          'Published quizzes will appear here.',
        );
      }
      return Column(
        children: items
            .map(
              (q) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        q['title'],
                        style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${q['questionCount']} questions · ${q['maxScore']} points',
                      ),
                      Text(
                        'Attempts used: ${q['attemptCount']} / ${q['maxAttempts']}',
                      ),
                      if (q['bestScore'] != null)
                        Text(
                          'Best score: ${q['bestScore']} / ${q['maxScore']}',
                        ),
                      Text(
                        q['closesAt'] != null
                            ? 'Closes ${date(q['closesAt'], time: true)}'
                            : 'No closing date',
                      ),
                      if (q['archivedAt'] != null || q['published'] != true)
                        const Tag('Closed — history available'),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  QuizScreen(api: widget.api, quizId: q['_id']),
                            ),
                          );
                          if (mounted) setState(load);
                        },
                        child: const Text('Open quiz'),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      );
    },
  );
}

class QuizScreen extends StatefulWidget {
  final LmsApi api;
  final String quizId;
  const QuizScreen({super.key, required this.api, required this.quizId});
  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  late Future<List<dynamic>> future;
  final Map<int, int> answers = {};
  bool taking = false, busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = Future.wait([
      widget.api.get('/quizzes/${widget.quizId}'),
      widget.api.get('/quizzes/${widget.quizId}/attempts'),
    ]);
  }

  Future<void> submit(Json quiz) async {
    final questions = records(quiz['questions']);
    if (answers.length != questions.length) {
      notify(context, 'Answer every question before submitting.', error: true);
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit this attempt?'),
        content: const Text(
          'Each submitted attempt is final. You cannot change these answers afterward.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep reviewing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Submit answers'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await widget.api.send('POST', '/quizzes/${widget.quizId}/attempts', {
        'revision': quiz['revision'],
        'answers': List.generate(questions.length, (i) => answers[i]),
      });
      if (mounted) {
        setState(() {
          taking = false;
          answers.clear();
          load();
        });
        notify(context, 'Quiz submitted and scored.');
      }
    } catch (e) {
      if (mounted) notify(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Your quiz')),
    body: FutureBuilder<List<dynamic>>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return ErrorView(snapshot.error!, () => setState(load));
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final q = Map<String, dynamic>.from(snapshot.data![0]),
            attempts = records(snapshot.data![1]['items']),
            questions = records(q['questions']);
        final policy = q['reviewPolicy'] == 'immediate'
            ? 'Immediately after submission'
            : q['reviewPolicy'] == 'after-close'
            ? 'After closing date'
            : 'Scores only';
        return ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Text(
              q['title'],
              style: const TextStyle(fontFamily: 'Lora', fontSize: 28),
            ),
            const SizedBox(height: 16),
            Text(q['instructions'] ?? ''),
            Text(
              '${q['maxScore']} points · ${q['maxAttempts']} permitted attempts',
            ),
            Text(
              q['closesAt'] != null
                  ? 'Closes ${date(q['closesAt'], time: true)}'
                  : 'No deadline',
            ),
            const SizedBox(height: 12),
            Text(
              'Answer review: $policy. Your best score appears in course progress.',
            ),
            const SizedBox(height: 20),
            if (!taking)
              FilledButton(
                onPressed: q['canAttempt'] == true
                    ? () => setState(() => taking = true)
                    : null,
                child: Text(
                  q['canAttempt'] == true
                      ? 'Start attempt ${q['attemptCount'] + 1}'
                      : 'No attempts available',
                ),
              ),
            if (taking) ...[
              ...List.generate(questions.length, (i) {
                final question = questions[i];
                final options = List<String>.from(question['options']);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${i + 1}. ${question['prompt']}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                        ),
                        Text('${question['points']} points'),
                        RadioGroup<int>(
                          groupValue: answers[i],
                          onChanged: (value) {
                            if (!busy && value != null) {
                              setState(() => answers[i] = value);
                            }
                          },
                          child: Column(
                            children: List.generate(
                              options.length,
                              (j) => RadioListTile<int>(
                                contentPadding: EdgeInsets.zero,
                                title: Text(options[j]),
                                value: j,
                                enabled: !busy,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
              FilledButton(
                onPressed: busy ? null : () => submit(q),
                child: Text(busy ? 'Submitting…' : 'Submit answers'),
              ),
              TextButton(
                onPressed: busy ? null : () => setState(() => taking = false),
                child: const Text('Cancel attempt'),
              ),
            ],
            const SizedBox(height: 24),
            const SectionLabel('Your attempts'),
            if (attempts.isEmpty) const Text('No attempts yet.'),
            ...attempts.map(
              (a) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Attempt ${a['attemptNumber']}: ${a['score']} / ${a['maxScore']}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(date(a['submittedAt'], time: true)),
                      if (a['reviewAllowed'] == true)
                        ExpansionTile(
                          tilePadding: EdgeInsets.zero,
                          title: const Text('Review answers'),
                          children: records(a['review']).map((r) {
                            final options = List<String>.from(r['options']);
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    r['prompt'],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    'Your answer: ${options[r['chosenIndex']]}',
                                  ),
                                  Text(
                                    'Correct answer: ${options[r['correctIndex']]}',
                                  ),
                                  Text(
                                    '${r['earned']} / ${r['points']} points',
                                  ),
                                  if ((r['explanation'] ?? '').isNotEmpty)
                                    Text(r['explanation']),
                                ],
                              ),
                            );
                          }).toList(),
                        )
                      else
                        const Text(
                          'Answer review is restricted by the instructor’s settings.',
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    ),
  );
}

class CourseProgressView extends StatefulWidget {
  final LmsApi api;
  final String courseId;
  const CourseProgressView({
    super.key,
    required this.api,
    required this.courseId,
  });
  @override
  State<CourseProgressView> createState() => _CourseProgressViewState();
}

class _CourseProgressViewState extends State<CourseProgressView> {
  late Future<dynamic> future;
  String busy = '';
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = widget.api.get('/courses/${widget.courseId}/progress');
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return ErrorView(snapshot.error!, () => setState(load));
      }
      if (!snapshot.hasData) {
        return const Center(child: CircularProgressIndicator());
      }
      final data = snapshot.data,
          s = Map<String, dynamic>.from(data['summary']);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionLabel('Learning progress'),
                Text(
                  '${s['progressPercent']}%',
                  style: const TextStyle(fontSize: 30, fontFamily: 'Lora'),
                ),
                LinearProgressIndicator(
                  value: (s['progressPercent'] as num) / 100,
                ),
                const SizedBox(height: 16),
                Text(
                  '${s['completedUnits']} / ${s['totalUnits']} units completed',
                ),
                const SizedBox(height: 12),
                const Text(
                  'Each current lecture, assignment, and published quiz is one unit. Lectures are student-confirmed; assignments count when submitted and quizzes when attempted. This measures participation, not a passing grade.',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const SectionLabel('Lecture completion'),
          const Text(
            'Read or watch your material, then mark it complete. You can undo a completion mark.',
          ),
          ...records(data['lectures']).map(
            (r) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r['title']),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: busy.isNotEmpty
                          ? null
                          : () async {
                              setState(() => busy = r['_id']);
                              try {
                                await widget.api.send(
                                  'PUT',
                                  '/materials/${r['_id']}/completion',
                                  {'completed': r['completed'] != true},
                                );
                                if (mounted) setState(load);
                              } catch (e) {
                                if (context.mounted) {
                                  notify(context, e.toString(), error: true);
                                }
                              } finally {
                                if (mounted) setState(() => busy = '');
                              }
                            },
                      child: Text(
                        busy == r['_id']
                            ? 'Saving…'
                            : r['completed'] == true
                            ? 'Mark incomplete'
                            : 'Mark complete',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          for (final type in ['assignments', 'quizzes']) ...[
            const SizedBox(height: 20),
            SectionLabel(type == 'assignments' ? 'Assignments' : 'Quizzes'),
            if (records(data[type]).isEmpty) const Text('No activities yet.'),
            ...records(data[type]).map(
              (r) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(r['title']),
                subtitle: r['bestScore'] != null
                    ? Text('Best: ${r['bestScore']}/${r['maxScore']}')
                    : null,
                trailing: Tag(r['completed'] == true ? 'Completed' : 'To do'),
              ),
            ),
          ],
        ],
      );
    },
  );
}
