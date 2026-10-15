import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'api.dart';

const accent = Color(0xFF244C59);
const ink = Color(0xFF203D49);
const muted = Color(0xFF5F6E70);
const paper = Color(0xFFF7F5EF);
const sheet = Color(0xFFFFFEFB);
const line = Color(0xFFDEDED4);

class BrandWordmark extends StatelessWidget {
  final double fontSize;
  const BrandWordmark({super.key, this.fontSize = 24});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Knowhere to Grow',
    excludeSemantics: true,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Knowhere',
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            letterSpacing: -.8,
            height: 1.05,
          ),
        ),
        Text(
          'to Grow',
          style: TextStyle(
            fontFamily: 'Lora',
            fontSize: fontSize * .72,
            fontWeight: FontWeight.w500,
            letterSpacing: -.3,
            height: 1.3,
          ),
        ),
      ],
    ),
  );
}

Color courseColor(dynamic value) => switch (value) {
  'blue' => const Color(0xFFDCE7EB),
  'teal' => const Color(0xFFDEE7D8),
  'orange' => const Color(0xFFF0DFCE),
  'pink' => const Color(0xFFEDDBD5),
  _ => const Color(0xFFE9DFC4),
};
String date(dynamic value, {bool time = false}) {
  if (value == null) return '—';
  final parsed = DateTime.tryParse(value.toString());
  return parsed == null
      ? '—'
      : DateFormat(
          time ? 'MMM d, y · h:mm a' : 'MMM d, y',
        ).format(parsed.toLocal());
}

List<Json> records(dynamic value) =>
    (value as List? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
void notify(BuildContext context, String text, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(text),
      backgroundColor: error ? const Color(0xFF9A3F31) : ink,
      behavior: SnackBarBehavior.floating,
    ),
  );
}

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color,
  });
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: color ?? sheet,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: const Color(0xFFDEDED4)),
    ),
    child: child,
  );
}

class Tag extends StatelessWidget {
  final String text;
  final Color color;
  const Tag(this.text, {super.key, this.color = accent});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .1),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      text,
      style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
    ),
  );
}

class Heading extends StatelessWidget {
  final String title, subtitle;
  const Heading(this.title, this.subtitle, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontFamily: 'Lora',
            fontSize: 30,
            fontWeight: FontWeight.w500,
            letterSpacing: -.8,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          style: const TextStyle(color: muted, height: 1.7, fontSize: 13),
        ),
      ],
    ),
  );
}

class EmptyView extends StatelessWidget {
  final String title, subtitle;
  const EmptyView(this.title, this.subtitle, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 45, horizontal: 20),
    child: Center(
      child: Column(
        children: [
          const Icon(Icons.auto_stories_outlined, color: accent, size: 42),
          const SizedBox(height: 20),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, height: 1.6, fontSize: 12),
          ),
        ],
      ),
    ),
  );
}

class ErrorView extends StatelessWidget {
  final Object error;
  final VoidCallback retry;
  const ErrorView(this.error, this.retry, {super.key});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, color: muted, size: 42),
          const SizedBox(height: 15),
          Text(
            error.toString(),
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, height: 1.7),
          ),
          const SizedBox(height: 20),
          FilledButton(onPressed: retry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

class DownloadButton extends StatefulWidget {
  final LmsApi api;
  final Json file;
  const DownloadButton({super.key, required this.api, required this.file});
  @override
  State<DownloadButton> createState() => _DownloadButtonState();
}

class _DownloadButtonState extends State<DownloadButton> {
  bool busy = false;
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: busy
        ? null
        : () async {
            setState(() => busy = true);
            try {
              final message = await widget.api.download(widget.file);
              if (context.mounted) notify(context, message);
            } catch (e) {
              if (context.mounted) notify(context, e.toString(), error: true);
            } finally {
              if (mounted) setState(() => busy = false);
            }
          },
    icon: busy
        ? const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : const Icon(Icons.download_outlined, size: 18),
    label: Text(
      busy ? 'Downloading…' : widget.file['name'],
      overflow: TextOverflow.ellipsis,
    ),
  );
}
