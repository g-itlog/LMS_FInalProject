import bcrypt from "bcryptjs";
import { seedAdditionalCourses } from "./course-catalog.js";

export async function seedDemo(db, password) {
  if (!password || password.length < 8)
    throw new Error("Set DEMO_PASSWORD to a strong password before seeding.");
  const users = db.collection("lms_users");
  const definitions = [
    {
      email: "instructor@classroom.test",
      name: "Alex Rivera",
      role: "instructor",
      bio: "Helping curious minds build useful things.",
    },
    {
      email: "student@classroom.test",
      name: "Jamie Santos",
      role: "student",
      bio: "BS Information Technology student. Learning one project at a time.",
    },
  ];
  const accounts = [];
  for (const definition of definitions) {
    await users.updateOne(
      { email: definition.email },
      {
        $setOnInsert: {
          ...definition,
          passwordHash: await bcrypt.hash(password, 12),
          department: "School of Information Technology",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    accounts.push(await users.findOne({ email: definition.email }));
  }
  const [instructor, student] = accounts;
  const courseDefinitions = [
    {
      code: "IT 301",
      title: "Full-Stack Web Development",
      category: "Computer Science",
      color: "violet",
      description:
        "Build secure, useful web applications with MongoDB, Express, React, and Node.js. Learn through practical projects and thoughtful feedback.",
    },
    {
      code: "IT 204",
      title: "User Interface & Experience Design",
      category: "Design",
      color: "teal",
      description:
        "Design thoughtful digital experiences. Explore research, accessible interfaces, responsive layouts, and the small details that make technology feel human.",
    },
    {
      code: "IT 202",
      title: "Database Management Systems",
      category: "Information Technology",
      color: "blue",
      description:
        "Turn data into useful information. Explore database modeling, CRUD operations, indexing, and secure data access with hands-on exercises.",
    },
    {
      code: "IT 305",
      title: "Mobile Application Development",
      category: "Mobile Development",
      color: "orange",
      description:
        "Create connected mobile experiences with Flutter. Practice layouts, navigation, forms, API integration, and secure session management.",
    },
  ];
  for (let index = 0; index < courseDefinitions.length; index++) {
    const definition = courseDefinitions[index];
    const existing = await db
      .collection("lms_courses")
      .findOne({ code: definition.code });
    // Never change another instructor's course or revive a deleted course.
    if (
      existing &&
      (!existing.instructorId.equals(instructor._id) || existing.deletedAt)
    )
      continue;
    const now = new Date();
    const courseId = existing
      ? existing._id
      : (
          await db.collection("lms_courses").insertOne({
            ...definition,
            instructorId: instructor._id,
            published: true,
            createdAt: now,
            updatedAt: now,
          })
        ).insertedId;
    if (index < 3)
      await db
        .collection("lms_enrollments")
        .updateOne(
          { courseId, studentId: student._id },
          { $setOnInsert: { createdAt: now } },
          { upsert: true },
        );
    const assignment = {
      courseId,
      title: [
        "Build your first REST API",
        "Design a responsive learning dashboard",
        "Model a learning management database",
        "Create a Flutter student profile",
      ][index],
      instructions:
        "Create a practical solution using the concepts discussed in class. Include your source code, a brief explanation of your decisions, and evidence that you tested your work. Submit a PDF report or a ZIP of your source files.",
      dueDate: new Date(Date.now() + (index + 2) * 86400000),
      maxPoints: 100,
      allowLate: true,
      authorId: instructor._id,
      createdAt: now,
      updatedAt: now,
    };
    await insertOnce(db, "lms_assignments", assignment);
    await insertOnce(db, "lms_materials", {
      courseId,
      title: [
        "Getting started with React",
        "Introduction to accessible design",
        "MongoDB fundamentals",
        "Flutter learning pathway",
      ][index],
      description:
        "Start here: read the official guide, try the examples, and write down any questions for our next class.",
      url: [
        "https://react.dev/learn",
        "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
        "https://www.mongodb.com/docs/manual/introduction/",
        "https://docs.flutter.dev/get-started/learn-pathway",
      ][index],
      file: null,
      authorId: instructor._id,
      createdAt: now,
      updatedAt: now,
    });
    await insertOnce(db, "lms_announcements", {
      courseId,
      title:
        index === 0
          ? "Welcome to your next chapter 👋"
          : `Welcome to ${definition.code}`,
      body: "Our classroom is ready for you. Start with the learning resources, take a look at your first assignment, and make a little progress each day. If you need help, bring your questions to our next meeting.",
      pinned: index === 0,
      authorId: instructor._id,
      createdAt: now,
      updatedAt: now,
    });
    if (index === 0) {
      const completed = await insertOnce(db, "lms_assignments", {
        ...assignment,
        title: "Project proposal & system flow",
        instructions:
          "Describe a real-world problem your application will solve. Identify the users, outline the main features, and include a system flowchart.",
        dueDate: new Date(Date.now() - 86400000),
        createdAt: new Date(Date.now() - 5 * 86400000),
      });
      await db.collection("lms_submissions").updateOne(
        { assignmentId: completed._id, studentId: student._id },
        {
          $setOnInsert: {
            courseId,
            text: "My proposal is a learning management system that connects students and instructors. Students can access resources and submit work, while instructors organize courses and provide feedback. The mobile app will give students the same learning access on their phones.",
            file: null,
            submittedAt: new Date(Date.now() - 2 * 86400000),
            late: false,
            grade: 92,
            feedback:
              "Clear problem statement and a practical scope. Your role separation is well considered. Add more detail to the assignment submission and grading flow before implementation.",
            gradedAt: new Date(Date.now() - 86400000),
            gradedBy: instructor._id,
          },
        },
        { upsert: true },
      );
    }
  }
  await seedAdditionalCourses(db, instructor);
  return accounts.map(({ name, email, role }) => ({ name, email, role }));
}
async function insertOnce(db, collection, record) {
  await db
    .collection(collection)
    .updateOne(
      { courseId: record.courseId, title: record.title },
      { $setOnInsert: record },
      { upsert: true },
    );
  return db
    .collection(collection)
    .findOne({ courseId: record.courseId, title: record.title });
}
