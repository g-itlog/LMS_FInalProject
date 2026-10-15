import 'package:flutter/material.dart';
import 'api.dart';
import 'widgets.dart';
import 'course_screen.dart';
import 'profile_screen.dart';

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
          const Icon(Icons.auto_stories_outlined, color: purple, size: 24),
          const SizedBox(width: 9),
          const Text(
            'classroom.',
            style: TextStyle(
              fontSize: 22,
              letterSpacing: -1,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          onPressed: () => setState(() => tab = 4),
          tooltip: 'My profile',
          icon: CircleAvatar(
            radius: 17,
            backgroundColor: const Color(0xFFE8DFF6),
            child: Text(
              widget.api.user!['name'].toString().substring(0, 1).toUpperCase(),
              style: const TextStyle(
                color: purple,
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
      backgroundColor: Colors.white,
      indicatorColor: const Color(0xFFEDE6FA),
      labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 10)),
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
          selectedIcon: Icon(Icons.grid_view_rounded, color: purple),
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
    final upcoming = assignments
        .where(
          (a) =>
              DateTime.parse(a['dueDate']).isAfter(DateTime.now()) &&
              !submissions.any((s) => s['assignmentId'] == a['_id']),
        )
        .toList();
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
          'LET’S MAKE TODAY COUNT',
          style: TextStyle(
            fontSize: 9,
            color: muted,
            letterSpacing: 1.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Heading(
          'Hello, ${widget.api.user!['name'].toString().split(' ').first} 👋',
          'A fresh day to learn something new. You’ve got this.',
        ),
        AppCard(
          color: const Color(0xFFEDE6F8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Tag('YOUR NEXT CHAPTER'),
              const SizedBox(height: 17),
              const Text(
                'Keep your curiosity.\nBuild your momentum.',
                style: TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -.7,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Every small step moves you forward.',
                style: TextStyle(fontSize: 12, color: muted),
              ),
              const SizedBox(height: 15),
              TextButton.icon(
                onPressed: () => setState(() => tab = 1),
                icon: const Icon(Icons.arrow_forward, size: 17),
                label: const Text('Go to my courses'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 17),
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
        const SizedBox(height: 12),
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
                possible > 0 ? '${(earned * 100 / possible).round()}%' : '—',
                'Overall grade',
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
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
        sectionTitle('Coming up next', () => setState(() => tab = 2)),
        const SizedBox(height: 14),
        if (upcoming.isEmpty)
          const AppCard(
            child: Text(
              'No upcoming deadlines. A little room to breathe.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
          )
        else
          ...upcoming.take(3).map((a) => assignmentTile(a, submissions)),
      ],
    );
  }

  Widget metric(IconData icon, String value, String label) => AppCard(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: purple, size: 22),
        const SizedBox(height: 14),
        Text(
          value,
          style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 5),
        Text(label, style: const TextStyle(fontSize: 10, color: muted)),
      ],
    ),
  );
  Widget sectionTitle(String title, VoidCallback viewAll) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        title,
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
      ),
      TextButton(
        onPressed: viewAll,
        child: const Text('View all →', style: TextStyle(fontSize: 11)),
      ),
    ],
  );
  Widget courseTile(Json course) => InkWell(
    borderRadius: BorderRadius.circular(18),
    onTap: () => openCourse(course['_id']),
    child: AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 108,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: courseColor(course['color']),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(17),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Tag(course['code']),
                const Icon(
                  Icons.auto_stories_outlined,
                  color: purple,
                  size: 53,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  course['category'].toString().toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9,
                    color: muted,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 9),
                Text(
                  course['title'],
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 17,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  course['instructorName'] ?? 'Your classroom',
                  style: const TextStyle(color: muted, fontSize: 11),
                ),
                const SizedBox(height: 15),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Open classroom',
                      style: TextStyle(fontSize: 11, color: purple),
                    ),
                    Icon(Icons.arrow_forward, size: 17, color: purple),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
  Widget courseList() => ListView(
    padding: const EdgeInsets.all(22),
    physics: const AlwaysScrollableScrollPhysics(),
    children: [
      const Heading('My courses', 'A space for every possibility.'),
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
                      child: const Text('← Previous'),
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
                      child: const Text('Next →'),
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
        borderRadius: BorderRadius.circular(18),
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
                    color: purple,
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
                            color: purple,
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
                      child: const Text('View classroom →'),
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
