import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'widgets.dart';

class SubmissionScreen extends StatefulWidget {
  final LmsApi api;
  final Json assignment;
  final Json? submission;
  const SubmissionScreen({
    super.key,
    required this.api,
    required this.assignment,
    this.submission,
  });
  @override
  State<SubmissionScreen> createState() => _SubmissionScreenState();
}

class _SubmissionScreenState extends State<SubmissionScreen> {
  late TextEditingController text;
  PlatformFile? file;
  bool busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    text = TextEditingController(text: widget.submission?['text'] ?? '');
  }

  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  Future<void> pick() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        withData: kIsWeb,
        withReadStream: !kIsWeb,
        type: FileType.custom,
        allowedExtensions: [
          'pdf',
          'txt',
          'csv',
          'docx',
          'pptx',
          'xlsx',
          'zip',
          'png',
          'jpg',
          'jpeg',
          'mp4',
        ],
      );
      if (result != null && mounted) {
        if (result.files.single.size > 20 * 1024 * 1024) {
          throw ApiError('Maximum file size is 20 MB.');
        }
        setState(() => file = result.files.single);
      }
    } catch (e) {
      if (mounted) notify(context, e.toString(), error: true);
    }
  }

  Future<void> submit() async {
    if (text.text.trim().isEmpty &&
        file == null &&
        widget.submission?['file'] == null) {
      setState(() => error = 'Write a response or attach your work.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit your work?'),
        content: const Text(
          'Your instructor will be able to review your response and attachment.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.submit(widget.assignment['_id'], text.text.trim(), file);
      if (mounted) {
        notify(context, 'Your work has been submitted.');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.assignment;
    final s = widget.submission;
    final locked =
        s?['grade'] != null ||
        (a['allowLate'] != true &&
            DateTime.parse(a['dueDate']).isBefore(DateTime.now()));
    return PopScope(
      canPop: !busy,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Assignment', style: TextStyle(fontSize: 17)),
        ),
        body: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Text(
              a['title'],
              style: const TextStyle(
                fontFamily: 'Lora',
                fontSize: 29,
                fontWeight: FontWeight.w500,
                letterSpacing: -.6,
              ),
            ),
            const SizedBox(height: 15),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                Tag('${a['maxPoints']} points'),
                Tag(
                  a['allowLate'] == true
                      ? 'Late submissions accepted'
                      : 'Deadline enforced',
                ),
              ],
            ),
            const SizedBox(height: 15),
            Text(
              'Due ${date(a['dueDate'], time: true)}',
              style: const TextStyle(color: muted, fontSize: 12),
            ),
            const SizedBox(height: 24),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Instructions',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 13),
                  Text(
                    a['instructions'],
                    style: const TextStyle(
                      color: muted,
                      fontSize: 13,
                      height: 1.8,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (s != null) ...[
              AppCard(
                color: const Color(0xFFEBE6D6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'YOUR SUBMISSION',
                      style: TextStyle(
                        color: accent,
                        letterSpacing: 1.3,
                        fontSize: 9,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Submitted ${date(s['submittedAt'], time: true)}',
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                    if (s['late'] == true)
                      const Padding(
                        padding: EdgeInsets.only(top: 10),
                        child: Tag('Submitted late', color: Color(0xFF80501F)),
                      ),
                    if (s['file'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 13),
                        child: DownloadButton(
                          api: widget.api,
                          file: Map<String, dynamic>.from(s['file']),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
            if (s?['grade'] != null) ...[
              AppCard(
                color: const Color(0xFFE9EFE0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'YOUR GRADE',
                      style: TextStyle(
                        color: muted,
                        letterSpacing: 1.3,
                        fontSize: 9,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${s!['grade']} / ${a['maxPoints']}',
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF365D43),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Instructor feedback',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      s['feedback'] ?? '',
                      style: const TextStyle(
                        color: muted,
                        height: 1.8,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
            const Text(
              'Your response',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: text,
              enabled: !locked && !busy,
              maxLines: 7,
              maxLength: 10000,
              decoration: const InputDecoration(
                hintText: 'Write your response here…',
              ),
            ),
            if (!locked) ...[
              const SizedBox(height: 15),
              OutlinedButton.icon(
                onPressed: busy ? null : pick,
                icon: const Icon(Icons.attach_file, size: 19),
                label: Text(
                  file?.name ??
                      (s?['file'] != null
                          ? 'Replace attachment'
                          : 'Attach your work'),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (file != null)
                TextButton(
                  onPressed: busy ? null : () => setState(() => file = null),
                  child: const Text('Remove selected attachment'),
                ),
              const SizedBox(height: 9),
              const Text(
                'Maximum 20 MB. PDF, text, Office, ZIP, images, or MP4. Existing attachment is kept unless replaced.',
                style: TextStyle(color: muted, fontSize: 10, height: 1.7),
              ),
            ] else if (s?['grade'] == null)
              const Text(
                'The submission deadline has passed.',
                style: TextStyle(color: Color(0xFF9A3F31), fontSize: 12),
              ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 18),
                child: Text(
                  error!,
                  style: const TextStyle(
                    color: Color(0xFF9A3F31),
                    fontSize: 12,
                    height: 1.6,
                  ),
                ),
              ),
            const SizedBox(height: 25),
            if (!locked)
              FilledButton.icon(
                onPressed: busy ? null : submit,
                icon: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send_outlined, size: 18),
                label: Text(
                  busy
                      ? 'Submitting…'
                      : s != null
                      ? 'Update submission'
                      : 'Submit assignment',
                ),
              ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
