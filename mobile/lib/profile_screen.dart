import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';

class ProfileScreen extends StatefulWidget {
  final LmsApi api;
  const ProfileScreen({super.key, required this.api});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final profileForm = GlobalKey<FormState>(),
      passwordForm = GlobalKey<FormState>();
  late TextEditingController name, bio, department;
  final current = TextEditingController(),
      password = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false, passwordBusy = false, logoutBusy = false;
  @override
  void initState() {
    super.initState();
    name = TextEditingController(text: widget.api.user!['name']);
    bio = TextEditingController(text: widget.api.user!['bio'] ?? '');
    department = TextEditingController(
      text: widget.api.user!['department'] ?? '',
    );
  }

  @override
  void dispose() {
    for (final c in [name, bio, department, current, password, confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!profileForm.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      await widget.api.updateProfile({
        'name': name.text.trim(),
        'bio': bio.text.trim(),
        'department': department.text.trim(),
      });
      if (mounted) notify(context, 'Profile updated.');
    } catch (e) {
      if (mounted) notify(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> changePassword() async {
    if (!passwordForm.currentState!.validate()) return;
    setState(() => passwordBusy = true);
    try {
      await widget.api.changePassword({
        'currentPassword': current.text,
        'newPassword': password.text,
      });
      current.clear();
      password.clear();
      confirm.clear();
      if (mounted) {
        notify(
          context,
          'Password changed. Other sessions have been signed out.',
        );
      }
    } catch (e) {
      if (mounted) notify(context, e.toString(), error: true);
    } finally {
      if (mounted) setState(() => passwordBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(22),
    children: [
      const Heading(
        'My profile',
        'A little about you. A space that feels like yours.',
      ),
      AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Tag('STUDENT ACCOUNT'),
            const SizedBox(height: 16),
            Text(
              widget.api.user!['email'],
              style: const TextStyle(fontSize: 13, color: muted),
            ),
            const SizedBox(height: 8),
            Text(
              'Member since ${date(widget.api.user!['createdAt'])}',
              style: const TextStyle(fontSize: 10, color: muted),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      AppCard(
        child: Form(
          key: profileForm,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Personal information',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 22),
              TextFormField(
                controller: name,
                maxLength: 80,
                decoration: const InputDecoration(labelText: 'Full name'),
                validator: (v) => (v?.trim().length ?? 0) < 2
                    ? 'Use at least 2 characters.'
                    : null,
              ),
              const SizedBox(height: 17),
              TextFormField(
                controller: department,
                maxLength: 100,
                decoration: const InputDecoration(
                  labelText: 'Department or program',
                ),
              ),
              const SizedBox(height: 17),
              TextFormField(
                controller: bio,
                maxLength: 600,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'About me'),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: busy ? null : save,
                child: Text(busy ? 'Saving…' : 'Save profile'),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 22),
      AppCard(
        child: Form(
          key: passwordForm,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Password & security',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              const Text(
                'Changing your password signs out your other devices.',
                style: TextStyle(fontSize: 11, color: muted, height: 1.6),
              ),
              const SizedBox(height: 22),
              TextFormField(
                controller: current,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Current password',
                ),
                validator: (v) => v == null || v.isEmpty
                    ? 'Enter your current password.'
                    : null,
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: password,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New password'),
                validator: (v) =>
                    v == null ||
                        v.length < 8 ||
                        v.length > 72 ||
                        !RegExp(r'[A-Z]').hasMatch(v) ||
                        !RegExp(r'[a-z]').hasMatch(v) ||
                        !RegExp(r'[0-9]').hasMatch(v)
                    ? 'Use 8–72 characters with uppercase, lowercase, and a number.'
                    : null,
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: confirm,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirm new password',
                ),
                validator: (v) =>
                    v != password.text ? 'Passwords do not match.' : null,
              ),
              const SizedBox(height: 23),
              OutlinedButton(
                onPressed: passwordBusy ? null : changePassword,
                child: Text(passwordBusy ? 'Updating…' : 'Update password'),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 27),
      OutlinedButton.icon(
        onPressed: logoutBusy
            ? null
            : () async {
                setState(() => logoutBusy = true);
                try {
                  await widget.api.logout();
                } catch (e) {
                  if (context.mounted) {
                    notify(context, e.toString(), error: true);
                  }
                } finally {
                  if (mounted) setState(() => logoutBusy = false);
                }
              },
        icon: const Icon(Icons.logout, size: 18),
        label: Text(logoutBusy ? 'Signing out…' : 'Sign out'),
      ),
      const SizedBox(height: 25),
      const Center(
        child: Text(
          'Classroom · Made for better learning.',
          style: TextStyle(fontSize: 10, color: muted),
        ),
      ),
    ],
  );
}
