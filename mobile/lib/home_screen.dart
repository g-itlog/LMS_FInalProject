import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';
import 'course_screen.dart';
import 'profile_screen.dart';
import 'inbox_screen.dart';

class HomeScreen extends StatefulWidget {
  final LmsApi api;
  const HomeScreen({super.key, required this.api});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int tab = 0, page = 1;
  String search = '', filter = 'all';
  bool catalog = false;
  late Future<Json> dashboard;
  late Future<Json> courses;
  @override
  void initState() {
    super.initState();
    refreshData();
  }

  void refreshData() {
    dashboard = widget.api
        .get('/dashboard')
        .then((v) => Map<String, dynamic>.from(v));
    dashboard.ignore();
    loadCourses();
  }

  void loadCourses() {
    courses = widget.api
        .get(
          '/courses?scope=${catalog ? 'catalog' : 'mine'}&search=${Uri.encodeQueryComponent(search)}&page=$page',
        )
        .then((v) => Map<String, dynamic>.from(v));
    courses.ignore();
  }

  Future<void> refresh() async {
    setState(refreshData);
    try {
      await dashboard;
      await courses;
    } catch (_) {
      /* FutureBuilder shows the actionable error. */
    }
  }

  Future<void> openCourse(String id, {int initialTab = 0}) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) =>
            CourseScreen(api: widget.api, courseId: id, initialTab: initialTab),
      ),
    );
    if (mounted) setState(refreshData);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(
        children: [
          const Icon(Icons.auto_stories_outlined, color: accent, size: 24),
          const SizedBox(width: 9),
          const Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: BrandWordmark(fontSize: 23),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Inbox',
          icon: const Icon(Icons.notifications_outlined),
          onPressed: () async {
            await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => InboxScreen(api: widget.api)),
            );
            if (mounted) setState(refreshData);
          },
        ),
        IconButton(
          onPressed: () => setState(() => tab = 4),
          tooltip: 'My profile',
          icon: CircleAvatar(
            radius: 17,
            backgroundColor: const Color(0xFFE5E9DF),
            child: Text(
              widget.api.user!['name'].toString().substring(0, 1).toUpperCase(),
              style: const TextStyle(
                color: accent,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
      ],
    ),
    body: tab == 4
        ? ProfileScreen(api: widget.api)
        : RefreshIndicator(
            onRefresh: refresh,
            child: tab == 1
                ? courseList()
                : FutureBuilder<Json>(
                    future: dashboard,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return ListView(
                          children: [ErrorView(snapshot.error!, refresh)],
                        );
                      }
                      if (!snapshot.hasData) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      final data = snapshot.data!;
                      return switch (tab) {
                        2 => assignmentList(data),
                        3 => announcementList(data),
                        _ => overview(data),
                      };
                    },
                  ),
          ),
    bottomNavigationBar: NavigationBar(
      height: 71,
      selectedIndex: tab,
      onDestinationSelected: (index) => setState(() {
        tab = index;
        search = '';
        page = 1;
        filter = 'all';
        if (index != 4) refreshData();
      }),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.grid_view_outlined),
          selectedIcon: Icon(Icons.grid_view_rounded, color: accent),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.auto_stories_outlined),
          label: 'Courses',
        ),
        NavigationDestination(
          icon: Icon(Icons.assignment_outlined),
          label: 'Assignments',
        ),
        NavigationDestination(
          icon: Icon(Icons.campaign_outlined),
          label: 'Updates',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          label: 'Profile',
        ),
      ],
    ),
  );

  Widget overview(Json data) {
    final allCourses = records(data['courses']);
    final assignments = records(data['assignments']);
    final submissions = records(data['submissions']);
    final upcoming =
        assignments
            .where(
              (a) =>
                  DateTime.parse(a['dueDate']).isAfter(DateTime.now()) &&
                  !submissions.any((s) => s['assignmentId'] == a['_id']),
            )
            .toList()
          ..sort(
            (a, b) => DateTime.parse(
              a['dueDate'],
            ).compareTo(DateTime.parse(b['dueDate'])),
          );
    final next = upcoming.firstOrNull;
    final graded = submissions.where((s) => s['grade'] != null).toList();
    num earned = 0, possible = 0;
    for (final s in graded) {
      earned += s['grade'] as num;
      final a = assignments
          .where((a) => a['_id'] == s['assignmentId'])
          .firstOrNull;
      possible += (a?['maxPoints'] as num?) ?? 0;
    }
    return ListView(
      padding: const EdgeInsets.all(22),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const Text(
          'STUDENT DESK',
          style: TextStyle(
            fontSize: 9,
            color: muted,
            letterSpacing: 1.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Heading(
          'Hello, ${widget.api.user!['name'].toString().split(' ').first}.',
          'Your coursework, deadlines, and feedback.',
        ),
        AppCard(
          color: ink,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.schedule_outlined,
                    color: Color(0xFFE4BD79),
                    size: 17,
                  ),
                  SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'NEXT ON YOUR SCHEDULE',
                      style: TextStyle(
                        fontSize: 9,
                        letterSpacing: 1.2,
                        color: Color(0xFFE4BD79),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 19),
              Text(
                next?['title'] ?? 'No upcoming deadlines.',
                style: TextStyle(
                  fontFamily: 'Lora',
                  fontSize: 26,
                  fontWeight: FontWeight.w400,
                  height: 1.35,
                  color: Color(0xFFF7F5EF),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                next != null
                    ? 'Due ${date(next['dueDate'], time: true)}'
                    : 'No upcoming assignments. Your course materials are ready when you are.',
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.7,
                  color: Color(0xFFCAD6D0),
                ),
              ),
              const SizedBox(height: 15),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFF0E5CD),
                    foregroundColor: ink,
                  ),
                  onPressed: () => next == null
                      ? setState(() => tab = 1)
                      : openCourse(next['courseId'], initialTab: 1),
                  icon: const Icon(Icons.arrow_forward, size: 17),
                  label: Text(
                    next == null ? 'Go to my courses' : 'View assignment',
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 17),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: metric(
                      Icons.auto_stories_outlined,
                      '${allCourses.length}',
                      'Enrolled courses',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: metric(
                      Icons.schedule_outlined,
                      '${upcoming.length}',
                      'Upcoming tasks',
                    ),
                  ),
                ],
              ),
              const Divider(height: 1),
              Row(
                children: [
                  Expanded(
                    child: metric(
                      Icons.task_alt_outlined,
                      '${submissions.length}',
                      'Work submitted',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: metric(
                      Icons.school_outlined,
                      possible > 0
                          ? '${(earned * 100 / possible).round()}%'
                          : '—',
                      'Assignment average',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        sectionTitle('Coming up next', () => setState(() => tab = 2)),
        const SizedBox(height: 14),
        if (upcoming.isEmpty)
          const AppCard(
            child: Text(
              'You have no upcoming assignments.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
          )
        else
          ...upcoming.take(3).map((a) => assignmentTile(a, submissions)),
        const SizedBox(height: 24),
        sectionTitle('My courses', () => setState(() => tab = 1)),
        const SizedBox(height: 14),
        if (allCourses.isEmpty)
          const AppCard(
            child: EmptyView(
              'Your next discovery awaits',
              'Browse the course catalog and join your first class.',
            ),
          )
        else
          ...allCourses
              .take(3)
              .map(
                (c) => Padding(
                  padding: const EdgeInsets.only(bottom: 13),
                  child: courseTile(c),
                ),
              ),
        const SizedBox(height: 15),
      ],
    );
  }

  Widget metric(IconData icon, String value, String label) => Padding(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: const TextStyle(
            fontFamily: 'Lora',
            fontSize: 28,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 5),
        Text(label, style: const TextStyle(fontSize: 11, color: muted)),
      ],
    ),
  );
  Widget sectionTitle(String title, VoidCallback viewAll) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Expanded(
        child: Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      TextButton(
        onPressed: viewAll,
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('View all', style: TextStyle(fontSize: 11)),
            SizedBox(width: 6),
            Icon(Icons.arrow_forward, size: 15),
          ],
        ),
      ),
    ],
  );
  Widget courseTile(Json course) => Material(
    color: sheet,
    borderRadius: BorderRadius.circular(8),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => openCourse(course['_id']),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: line),
          borderRadius: BorderRadius.circular(8),
        ),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 79,
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 19,
                ),
                decoration: BoxDecoration(
                  color: courseColor(course['color']),
                  border: const Border(right: BorderSide(color: line)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      course['code'],
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: ink,
                      ),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      course['code'].toString().replaceAll(
                        RegExp(r'[^0-9]'),
                        '',
                      ),
                      maxLines: 1,
                      style: const TextStyle(
                        fontFamily: 'Lora',
                        fontSize: 29,
                        color: Color(0xFF65736A),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(17),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        course['category'].toString().toUpperCase(),
                        style: const TextStyle(
                          fontSize: 8,
                          letterSpacing: .8,
                          color: muted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        course['title'],
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        course['instructorName'] ?? 'Your classroom',
                        style: const TextStyle(fontSize: 11, color: muted),
                      ),
                      const SizedBox(height: 14),
                      const Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Open classroom',
                              style: TextStyle(fontSize: 11, color: accent),
                            ),
                          ),
                          Icon(Icons.arrow_forward, size: 17, color: accent),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  Widget courseList() => ListView(
    padding: const EdgeInsets.all(22),
    physics: const AlwaysScrollableScrollPhysics(),
    children: [
      const Heading(
        'My courses',
        'Course materials and assignments, organized.',
      ),
      SegmentedButton<bool>(
        segments: const [
          ButtonSegment(
            value: false,
            label: Text('Enrolled', style: TextStyle(fontSize: 12)),
          ),
          ButtonSegment(
            value: true,
            label: Text('Explore', style: TextStyle(fontSize: 12)),
          ),
        ],
        selected: {catalog},
        onSelectionChanged: (v) => setState(() {
          catalog = v.first;
          page = 1;
          loadCourses();
        }),
      ),
      const SizedBox(height: 18),
      TextField(
        decoration: const InputDecoration(
          hintText: 'Search courses…',
          prefixIcon: Icon(Icons.search, size: 20),
        ),
        onChanged: (v) => search = v,
        onSubmitted: (_) => setState(() {
          page = 1;
          loadCourses();
        }),
        textInputAction: TextInputAction.search,
      ),
      const SizedBox(height: 18),
      FutureBuilder<Json>(
        future: courses,
        builder: (context, snap) {
          if (snap.hasError) {
            return ErrorView(snap.error!, () => setState(loadCourses));
          }
          if (!snap.hasData) {
            return const Padding(
              padding: EdgeInsets.all(50),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final items = records(snap.data!['items']);
          return Column(
            children: [
              if (items.isEmpty)
                EmptyView(
                  catalog ? 'No courses found' : 'Make space for learning',
                  catalog
                      ? 'Try a different search or ask your instructor to publish a course.'
                      : 'Explore the catalog to join a course.',
                )
              else
                ...items.map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: courseTile(c),
                  ),
                ),
              if ((snap.data!['pages'] as int) > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    TextButton(
                      onPressed: page > 1
                          ? () => setState(() {
                              page--;
                              loadCourses();
                            })
                          : null,
                      child: const Text('Previous'),
                    ),
                    Text(
                      '$page / ${snap.data!['pages']}',
                      style: const TextStyle(color: muted, fontSize: 11),
                    ),
                    TextButton(
                      onPressed: page < snap.data!['pages']
                          ? () => setState(() {
                              page++;
                              loadCourses();
                            })
                          : null,
                      child: const Text('Next'),
                    ),
                  ],
                ),
            ],
          );
        },
      ),
    ],
  );
  Widget assignmentList(Json data) {
    final submissions = records(data['submissions']);
    final assignments = records(data['assignments']).where((a) {
      final s = submissions
          .where((s) => s['assignmentId'] == a['_id'])
          .firstOrNull;
      final match = '${a['title']} ${a['course']?['code']}'
          .toLowerCase()
          .contains(search.toLowerCase());
      return match &&
          (filter == 'all' ||
              filter == 'graded' && s?['grade'] != null ||
              filter == 'todo' && s == null ||
              filter == 'upcoming' &&
                  s == null &&
                  DateTime.parse(a['dueDate']).isAfter(DateTime.now()) ||
              filter == 'overdue' &&
                  s == null &&
                  DateTime.parse(a['dueDate']).isBefore(DateTime.now()) ||
              filter == 'pending' && s != null && s['grade'] == null);
    }).toList();
    return ListView(
      padding: const EdgeInsets.all(22),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const Heading(
          'Assignments & grades',
          'Your tasks, progress, and feedback in one place.',
        ),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Search assignments…',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (v) => setState(() => search = v),
        ),
        const SizedBox(height: 15),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final entry in {
                'all': 'All',
                'todo': 'To do',
                'upcoming': 'Upcoming',
                'overdue': 'Overdue',
                'pending': 'Submitted',
                'graded': 'Graded',
              }.entries)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(
                      entry.value,
                      style: const TextStyle(fontSize: 11),
                    ),
                    selected: filter == entry.key,
                    onSelected: (_) => setState(() => filter = entry.key),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        if (assignments.isEmpty)
          const EmptyView(
            'A fresh page',
            'Assignments from your enrolled courses will appear here.',
          )
        else
          ...assignments.map((a) => assignmentTile(a, submissions)),
      ],
    );
  }

  Widget assignmentTile(Json assignment, List<Json> submissions) {
    final submission = submissions
        .where((s) => s['assignmentId'] == assignment['_id'])
        .firstOrNull;
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => openCourse(assignment['courseId'], initialTab: 1),
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      assignment['course']?['code'] ?? 'ASSIGNMENT',
                      style: const TextStyle(
                        color: muted,
                        fontSize: 10,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  Tag(
                    submission?['grade'] != null
                        ? 'Graded'
                        : submission != null
                        ? 'Submitted'
                        : DateTime.parse(
                            assignment['dueDate'],
                          ).isBefore(DateTime.now())
                        ? 'Overdue'
                        : 'To do',
                  ),
                ],
              ),
              const SizedBox(height: 13),
              Text(
                assignment['title'],
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 9),
              Text(
                'Due ${date(assignment['dueDate'], time: true)}',
                style: const TextStyle(color: muted, fontSize: 11),
              ),
              const SizedBox(height: 8),
              Text(
                '${assignment['maxPoints']} points',
                style: const TextStyle(color: muted, fontSize: 11),
              ),
              if (submission?['grade'] != null) ...[
                const Divider(height: 29),
                Text(
                  '${submission!['grade']} / ${assignment['maxPoints']}',
                  style: const TextStyle(
                    fontSize: 23,
                    color: accent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  submission['feedback'] ?? '',
                  style: const TextStyle(
                    color: muted,
                    fontSize: 12,
                    height: 1.7,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget announcementList(Json data) {
    final announcements = records(data['announcements']);
    return ListView(
      padding: const EdgeInsets.all(22),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const Heading('Notice board', 'Stay connected with your classroom.'),
        if (announcements.isEmpty)
          const AppCard(
            child: EmptyView(
              'All quiet for now',
              'Updates from your courses will appear here.',
            ),
          )
        else
          ...announcements.map(
            (a) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Tag(a['course']?['code'] ?? 'UPDATE'),
                        const Spacer(),
                        if (a['pinned'] == true)
                          const Icon(
                            Icons.push_pin_outlined,
                            color: accent,
                            size: 17,
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      a['title'],
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      date(a['createdAt']),
                      style: const TextStyle(color: muted, fontSize: 10),
                    ),
                    const SizedBox(height: 15),
                    Text(
                      a['body'],
                      style: const TextStyle(
                        color: muted,
                        height: 1.8,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => openCourse(a['courseId'], initialTab: 2),
                      child: const Text('View classroom'),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
