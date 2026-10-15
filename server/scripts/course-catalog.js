import { GridFSBucket } from "mongodb";

// Curriculum examples are local project content. Linked readings are official docs.
export const additionalCourses = [
  {
    code: "IT 101",
    title: "Programming Foundations with Python",
    category: "Programming",
    color: "blue",
    description:
      "Start with variables, decisions, loops, and reusable functions. Practice breaking a small problem into clear steps and testing a working Python program.",
    reading: {
      title: "Python language tutorial",
      url: "https://docs.python.org/3/tutorial/",
      description:
        "Use the official tutorial alongside the beginner worksheet. Focus on expressions, control flow, and functions; no paid account is required.",
    },
    assignment: {
      title: "Build a student grade calculator",
      instructions:
        "Write a Python program that accepts three assessment scores from 0 to 100, validates each input, and prints their average and a pass/fail result using a 75-point threshold. Separate input validation and calculation into functions. Test zero, 75, 100, and invalid input. Submit a ZIP containing the program and a short PDF or TXT explanation of your test results.",
    },
    worksheet:
      "Learning goals: use variables, conditionals, loops, and functions.\n1. Trace a loop that adds five scores.\n2. Explain the difference between a string and a number.\n3. Design validation for a score outside 0 to 100.\n4. Implement an average(scores) function and test it.\nReflection: which invalid input was most difficult to handle?",
  },
  {
    code: "IT 102",
    title: "Responsive Web Design with HTML & CSS",
    category: "Web Development",
    color: "teal",
    description:
      "Create readable, accessible websites with semantic HTML and modern CSS. Explore forms, layout, typography, and designs that adapt from a phone to a desktop.",
    reading: {
      title: "Structuring pages with semantic HTML",
      url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content",
      description:
        "Read MDN's HTML learning module, then apply headings, landmarks, links, and form labels to your own page.",
    },
    assignment: {
      title: "Create a responsive student portfolio",
      instructions:
        "Build a portfolio with an introduction, three project cards, navigation, and a contact form. Use semantic HTML, associated form labels, visible keyboard focus, and CSS layouts that work at 360px, 768px, and 1440px. Do not include real private contact information. Submit your HTML/CSS files in a ZIP and screenshots of all three widths.",
    },
    worksheet:
      "Learning goals: semantic structure, CSS layout, and responsive behavior.\n1. Sketch the page landmarks before writing HTML.\n2. Choose a heading hierarchy and label every form field.\n3. Start with a single-column phone layout.\n4. Add a wider card grid using a media query.\n5. Test keyboard navigation and horizontal overflow at 360px.\nReflection: how does the content order change on a small screen?",
  },
  {
    code: "IT 203",
    title: "JavaScript Essentials",
    category: "Web Development",
    color: "orange",
    description:
      "Bring interfaces to life with JavaScript. Work with arrays, objects, DOM events, asynchronous requests, and validation through small interactive projects.",
    reading: {
      title: "JavaScript guide: language fundamentals",
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
      description:
        "Study values, functions, collections, promises, and error handling in MDN's JavaScript guide. Use the worksheet to plan your interaction states.",
    },
    assignment: {
      title: "Build an interactive study planner",
      instructions:
        "Create a study planner that adds tasks, marks them complete, filters by status, and removes a task after confirmation. Validate blank input and keep the task list in localStorage. Render user input as text rather than HTML. Submit a ZIP of the source and a short report covering add, complete, filter, delete, and reload behavior.",
    },
    worksheet:
      "Learning goals: arrays, events, state, and persistence.\n1. Define a task object with id, title, and completed fields.\n2. Write functions that add, toggle, and remove tasks.\n3. List the empty and validation states your interface needs.\n4. Explain how JSON serialization supports localStorage.\n5. Test a task containing angle brackets and quotation marks.\nReflection: which state should be stored, and which can be calculated?",
  },
  {
    code: "IT 205",
    title: "Data Structures & Algorithms",
    category: "Computer Science",
    color: "violet",
    description:
      "Choose useful data structures and reason about the work an algorithm performs. Practice lists, stacks, queues, searching, and sorting with small, testable examples.",
    reading: {
      title: "Lists, stacks, queues, and dictionaries",
      url: "https://docs.python.org/3/tutorial/datastructures.html",
      description:
        "Review the Python data-structures chapter, with particular attention to lists as stacks, deque-based queues, sets, and dictionaries.",
    },
    assignment: {
      title: "Implement a library request queue",
      instructions:
        "Implement a first-in-first-out queue for fictional book requests using Python. Support adding a request, serving the next request, viewing pending requests, and handling an empty queue. Compare list and deque operations in a short explanation. Include tests for empty, one-item, and multiple-item queues. Submit source and test results in a ZIP.",
    },
    worksheet:
      "Learning goals: pick a data structure that matches an operation.\n1. Trace enqueue(A), enqueue(B), dequeue(), enqueue(C).\n2. Compare a stack's LIFO order with a queue's FIFO order.\n3. Explain why removing the first item from a list can require shifting items.\n4. Design a dictionary lookup for requests by identifier.\n5. Describe what your program does for an empty queue.\nReflection: why is correctness more important than guessing a runtime?",
  },
  {
    code: "IT 303",
    title: "Cybersecurity & Secure Coding",
    category: "Cybersecurity",
    color: "pink",
    description:
      "Learn to protect accounts, validate input, and enforce access rules. Review common web risks and practice improving a deliberately small local application.",
    reading: {
      title: "OWASP Top 10: web application risks",
      url: "https://owasp.org/projects/top-ten",
      description:
        "Use OWASP's official overview to identify application security risks. Keep all exercises on your own local code and fictional data.",
    },
    assignment: {
      title: "Review and harden a local login API",
      instructions:
        "Create a small local Express API using fictional users. Add password hashing, server-side input validation, authenticated access, and an ownership check for a private record. Document five rejected requests and explain why they must fail. Never test on a third-party system or include real passwords in your report. Submit your source and security review in a ZIP.",
    },
    worksheet:
      "Learning goals: distinguish authentication, authorization, and validation.\n1. Identify which routes require a signed-in user.\n2. Define who can read or edit each record.\n3. Explain why hiding a button does not protect an API.\n4. Compare hashing a password with encrypting one.\n5. Plan checks for malformed input, missing sessions, and another user's record.\nReflection: what information should a failed login response reveal?",
  },
  {
    code: "IT 304",
    title: "Software Testing & Quality Assurance",
    category: "Software Engineering",
    color: "teal",
    description:
      "Turn requirements into meaningful checks. Practice test cases, boundary values, automated API tests, clear bug reports, and a repeatable regression workflow.",
    reading: {
      title: "Testing with the Node.js test runner",
      url: "https://nodejs.org/docs/latest-v22.x/api/test.html",
      description:
        "Read the official Node.js 22 test-runner documentation, matching the project's supported runtime. Start with test cases, assertions, and setup/cleanup.",
    },
    assignment: {
      title: "Create a tested assignment-submission API",
      instructions:
        "Build a local submission endpoint and write automated tests for a valid response, missing required data, an invalid assignment ID, an expired deadline, and unauthorized access. Include one regression test for a bug you found. Submit source, test commands, actual results, and one reproducible bug report in a ZIP. Do not claim tests you did not run.",
    },
    worksheet:
      "Learning goals: derive tests from behavior rather than implementation.\n1. Write a requirement in Given/When/Then form.\n2. Choose boundary values for a grade from 0 to 100.\n3. Separate setup, action, and assertion.\n4. Record expected and actual results for a failing case.\n5. Confirm tests clean up their own sample data.\nReflection: which test would catch an important regression?",
  },
  {
    code: "IT 306",
    title: "Git & Collaborative Development",
    category: "Developer Tools",
    color: "blue",
    description:
      "Build confidence working with version control. Practice commits, feature branches, conflict resolution, review, and safe collaboration without exposing project secrets.",
    reading: {
      title: "Pro Git: version control and branching",
      url: "https://git-scm.com/book/en/v2",
      description:
        "Use the official Pro Git book to explore repository basics, commits, branches, merging, and collaboration.",
    },
    assignment: {
      title: "Complete a feature-branch workflow",
      instructions:
        "Create a local repository for a small fictional project. Make a feature branch, add three focused commits, merge it, and demonstrate resolving one intentional conflict in a practice branch. Include a .gitignore that excludes environment secrets. Submit a ZIP of source files and a report with the commit graph, commands used, and conflict-resolution explanation. Exclude credentials and private repository data.",
    },
    worksheet:
      "Learning goals: explain and demonstrate a repeatable Git workflow.\n1. Distinguish the working tree, staging area, and commit history.\n2. Write a focused commit message for one change.\n3. Sketch two branches before and after a merge.\n4. Explain both sides of a simple conflict before resolving it.\n5. Check that .env and generated build files are ignored.\nReflection: how would you help a reviewer understand your change?",
  },
  {
    code: "IT 307",
    title: "Cloud Deployment & Containers",
    category: "Cloud Computing",
    color: "orange",
    description:
      "Package an application so it runs consistently across environments. Explore containers, environment configuration, health checks, persistent data, and deployment documentation.",
    reading: {
      title: "Docker: getting started with containers",
      url: "https://docs.docker.com/get-started/",
      description:
        "Follow Docker's official introduction to images, containers, ports, volumes, and multi-container applications. Local exercises do not require paid cloud hosting.",
    },
    assignment: {
      title: "Containerize a small Node.js application",
      instructions:
        "Create a Node.js application with a health endpoint, then add a Dockerfile and a .dockerignore. Configure its port using an environment variable and document build, run, and stop commands. Explain how you would keep secrets outside an image and persist application data. Submit source, configuration, and actual local test evidence in a ZIP; do not upload real credentials.",
    },
    worksheet:
      "Learning goals: distinguish images, running containers, and persistent data.\n1. List the files the image actually needs.\n2. Explain host-port to container-port mapping.\n3. Identify configuration values that belong in environment variables.\n4. Plan a health check and a persistent data volume.\n5. Write commands a classmate can reproduce locally.\nReflection: what happens to data when a container is removed?",
  },
];

export async function seedAdditionalCourses(db, instructor) {
  if (instructor?.role !== "instructor")
    throw new Error("An existing instructor account is required.");
  const bucket = new GridFSBucket(db, { bucketName: "lms_files" });
  const results = [];
  for (const definition of additionalCourses) {
    const { reading, assignment, worksheet, ...details } = definition;
    let course = await db
      .collection("lms_courses")
      .findOne({ code: details.code });
    if (
      course &&
      (course.deletedAt ||
        !course.instructorId.equals(instructor._id) ||
        course.catalogSource !== "expanded-catalog-v1")
    )
      continue;
    const now = new Date();
    if (!course) {
      course = {
        ...details,
        instructorId: instructor._id,
        published: true,
        catalogSource: "expanded-catalog-v1",
        createdAt: now,
        updatedAt: now,
      };
      await db.collection("lms_courses").insertOne(course);
    }
    const common = {
      courseId: course._id,
      authorId: instructor._id,
      createdAt: now,
      updatedAt: now,
    };
    await insertContent(db, "lms_materials", "reading", {
      ...common,
      ...reading,
      file: null,
    });
    if (
      !(await db
        .collection("lms_materials")
        .findOne({ courseId: course._id, catalogKey: "worksheet" }))
    ) {
      const filename = `${details.code.replaceAll(" ", "-")}-practice.txt`;
      const contents = Buffer.from(
        `${details.title}\n${details.code} | Knowhere to Grow\n\nPRACTICE WORKSHEET\n\n${worksheet}\n\nNEXT ASSIGNMENT\n${assignment.title}\n\n${assignment.instructions}\n\nSubmission checklist\n- Use fictional data.\n- Include your source files and test evidence.\n- Keep passwords and .env files out of your submission.\n- Check the assignment's current deadline in Knowhere to Grow.\n`,
        "utf8",
      );
      const stream = bucket.openUploadStream(filename, {
        metadata: { ownerId: instructor._id, mimeType: "text/plain" },
      });
      await new Promise((resolve, reject) => {
        stream.on("finish", resolve).on("error", reject);
        stream.end(contents);
      });
      try {
        await insertContent(db, "lms_materials", "worksheet", {
          ...common,
          title: `${details.code} practice worksheet`,
          description:
            "Download the course worksheet, complete the exercises, and use the checklist to prepare your assignment.",
          url: "",
          file: { id: stream.id, name: filename, size: contents.length },
        });
      } catch (error) {
        await bucket.delete(stream.id);
        throw error;
      }
    }
    await insertContent(db, "lms_assignments", "assignment", {
      ...common,
      ...assignment,
      maxPoints: 100,
      dueDate: new Date(now.getTime() + 14 * 86400000),
      allowLate: true,
    });
    await insertContent(db, "lms_announcements", "welcome", {
      ...common,
      title: `Welcome to ${details.code}`,
      body: `Welcome to ${details.title}. Start with the linked reading, then download the practice worksheet. Your first assignment is “${assignment.title}”. Check the assignment page for the current deadline and submit your own work. Late submissions are accepted and marked late. Bring questions to your next class meeting.`,
      pinned: true,
    });
    results.push({ code: course.code, title: course.title, id: course._id });
  }
  return results;
}

async function insertContent(db, collection, key, record) {
  await db
    .collection(collection)
    .updateOne(
      { courseId: record.courseId, catalogKey: key },
      { $setOnInsert: { ...record, catalogKey: key } },
      { upsert: true },
    );
}
