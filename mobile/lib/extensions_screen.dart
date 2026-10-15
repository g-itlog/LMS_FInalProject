import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';

class ExtensionsScreen extends StatefulWidget {
  final LmsApi api;
  final String assignmentId;
  const ExtensionsScreen({
    super.key,
    required this.api,
    required this.assignmentId,
  });
  @override
  State<ExtensionsScreen> createState() => _ExtensionsScreenState();
}

class _ExtensionsScreenState extends State<ExtensionsScreen> {
  late Future<dynamic> future;
  int page = 1;
  String status = 'all';
  @override
  void initState() {
    super.initState();
    load();
  }

  void load() {
    future = widget.api.get(
      '/assignments/${widget.assignmentId}/extensions?page=$page&status=$status',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Deadline extension')),
    body: FutureBuilder<dynamic>(
      future: future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return ErrorView(snapshot.error!, () => setState(load));
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data,
            a = Map<String, dynamic>.from(data['assignment']),
            rows = records(data['items']);
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
                a['title'],
                style: const TextStyle(fontFamily: 'Lora', fontSize: 27),
              ),
              const SizedBox(height: 16),
              Text('Your current deadline: ${date(a['dueDate'], time: true)}'),
              if (a['hasIndividualExtension'] == true)
                Text(
                  'Class deadline: ${date(a['originalDueDate'], time: true)} · Individual extension active.',
                ),
              const SizedBox(height: 12),
              const Text(
                'Pending requests do not change deadlines. Only instructor approval can extend your deadline. Graded work stays locked.',
              ),
              const SizedBox(height: 20),
              if (data['canRequest'] == true)
                ExtensionRequestForm(
                  key: ValueKey(a['dueDate']),
                  api: widget.api,
                  assignment: a,
                  onSaved: () => setState(() {
                    page = 1;
                    status = 'all';
                    load();
                  }),
                )
              else
                AppCard(
                  child: Text(
                    data['pending'] > 0
                        ? 'You already have a pending request. Your instructor will review it.'
                        : 'Graded work cannot be reopened. You can read your request history below.',
                  ),
                ),
              const SizedBox(height: 25),
              const Text(
                'Your request history',
                style: TextStyle(fontFamily: 'Lora', fontSize: 22),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(
                  labelText: 'Filter extension status',
                ),
                items: const [
                  DropdownMenuItem(value: 'all', child: Text('All requests')),
                  DropdownMenuItem(value: 'pending', child: Text('Pending')),
                  DropdownMenuItem(value: 'approved', child: Text('Approved')),
                  DropdownMenuItem(value: 'rejected', child: Text('Rejected')),
                ],
                onChanged: (value) => setState(() {
                  status = value!;
                  page = 1;
                  load();
                }),
              ),
              const SizedBox(height: 18),
              if (rows.isEmpty) const Text('No extension requests found.'),
              ...rows.map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Tag(
                          r['status'].toString().toUpperCase(),
                          color: r['status'] == 'approved'
                              ? const Color(0xFF37634D)
                              : r['status'] == 'rejected'
                              ? const Color(0xFF9A3F31)
                              : const Color(0xFF80501F),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Original class deadline: ${date(r['originalDueDate'], time: true)}',
                        ),
                        Text(
                          'Your deadline at request: ${date(r['previousDueDate'], time: true)}',
                        ),
                        Text(
                          'Requested deadline: ${date(r['requestedDueDate'], time: true)}',
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Your reason',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(r['reason']),
                        const SizedBox(height: 12),
                        Text(
                          'Requested ${date(r['createdAt'], time: true)}',
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                        if (r['status'] != 'pending') ...[
                          const SizedBox(height: 16),
                          Text(
                            r['status'] == 'approved'
                                ? 'Approved for ${r['scope'] == 'class' ? 'the whole class' : 'you only'}.'
                                : 'Rejected. This decision did not change your deadline.',
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Instructor comment',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            (r['comment'] ?? '').isEmpty
                                ? 'No comment provided.'
                                : r['comment'],
                          ),
                          Text(
                            'Reviewed ${date(r['reviewedAt'], time: true)}',
                            style: const TextStyle(color: muted, fontSize: 11),
                          ),
                        ],
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

class ExtensionRequestForm extends StatefulWidget {
  final LmsApi api;
  final Json assignment;
  final VoidCallback onSaved;
  const ExtensionRequestForm({
    super.key,
    required this.api,
    required this.assignment,
    required this.onSaved,
  });
  @override
  State<ExtensionRequestForm> createState() => _ExtensionRequestFormState();
}

class _ExtensionRequestFormState extends State<ExtensionRequestForm> {
  final form = GlobalKey<FormState>(), reason = TextEditingController();
  DateTime? requested;
  bool busy = false;
  String? error;
  @override
  void dispose() {
    reason.dispose();
    super.dispose();
  }

  Future<void> chooseDate() async {
    final now = DateTime.now(),
        current = DateTime.parse(widget.assignment['dueDate']).toLocal(),
        last = DateTime.now().add(const Duration(days: 365));
    if (current.isAfter(last)) {
      notify(
        context,
        'No later date is available within the 365-day request limit.',
        error: true,
      );
      return;
    }
    final proposed = (current.isAfter(now) ? current : now).add(
      const Duration(days: 1),
    );
    final selected = await showDatePicker(
      context: context,
      initialDate: requested ?? (proposed.isAfter(last) ? last : proposed),
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: last,
    );
    if (selected == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(requested ?? current),
    );
    if (time == null || !mounted) return;
    setState(() {
      requested = DateTime(
        selected.year,
        selected.month,
        selected.day,
        time.hour,
        time.minute,
      );
      error = null;
    });
  }

  Future<void> send() async {
    if (busy || !form.currentState!.validate()) return;
    if (requested == null ||
        !requested!.isAfter(DateTime.now()) ||
        !requested!.isAfter(DateTime.parse(widget.assignment['dueDate']))) {
      setState(
        () => error = 'Choose a future date later than your current deadline.',
      );
      return;
    }
    if (requested!.isAfter(DateTime.now().add(const Duration(days: 365)))) {
      setState(() => error = 'Choose a date within the next 365 days.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api
          .send('POST', '/assignments/${widget.assignment['_id']}/extensions', {
            'reason': reason.text.trim(),
            'requestedDueDate': requested!.toUtc().toIso8601String(),
          });
      if (mounted) {
        notify(context, 'Extension request sent to your instructor.');
        widget.onSaved();
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AppCard(
    child: Form(
      key: form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Request Deadline Extension',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 18),
          ),
          const SizedBox(height: 18),
          TextFormField(
            controller: reason,
            enabled: !busy,
            maxLines: 4,
            maxLength: 2000,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            decoration: const InputDecoration(
              labelText: 'Reason for extension',
              errorMaxLines: 3,
            ),
            validator: (v) => (v ?? '').trim().length < 10
                ? 'Enter a reason with at least 10 characters.'
                : null,
            onChanged: (_) => setState(() => error = null),
          ),
          OutlinedButton.icon(
            onPressed: busy ? null : chooseDate,
            icon: const Icon(Icons.event_outlined),
            label: Text(
              requested == null
                  ? 'Choose requested deadline'
                  : date(requested!.toIso8601String(), time: true),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Your current deadline stays in force until approval.',
            style: TextStyle(fontSize: 12, color: muted),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                error!,
                style: const TextStyle(color: Color(0xFF9A3F31)),
              ),
            ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: busy ? null : send,
            child: Text(busy ? 'Sending…' : 'Send extension request'),
          ),
        ],
      ),
    ),
  );
}
