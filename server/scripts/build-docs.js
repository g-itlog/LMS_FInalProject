import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(root, "client/package.json"));
const { chromium } = require("playwright");
const docs = path.join(root, "docs");
const meta = JSON.parse(
  await fs.readFile(path.join(docs, "project.json"), "utf8"),
);
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
await fs.mkdir(path.join(docs, "source-screenshots"), { recursive: true });

const flow =
  '<svg xmlns="http://www.w3.org/2000/svg" width="660" height="800" viewBox="0 0 660 800" role="img" aria-labelledby="title"><title id="title">Knowhere to Grow: student, instructor, and web administration flow</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#547566"/></marker></defs><style>.box{fill:#fffefb;stroke:#547566;stroke-width:1.5}.line{fill:none;stroke:#547566;stroke-width:1.5;marker-end:url(#arrow)}text{font-family:Arial,sans-serif;font-size:14px;fill:#203d49;text-anchor:middle}.small{font-size:12px}</style><rect x="250" y="12" width="160" height="36" rx="18" class="box"/><text x="330" y="35">Start</text><path d="M330 48V72" class="line"/><rect x="205" y="75" width="250" height="62" rx="6" class="box"/><text x="330" y="98">Register / sign in</text><text x="330" y="118" class="small">Web: three roles / Flutter: students</text><path d="M330 137V160" class="line"/><path d="M330 162L440 210L330 258L220 210Z" class="box"/><text x="330" y="204">Valid credentials,</text><text x="330" y="224">active account and role?</text><path d="M440 210H615V105H455" class="line"/><text x="584" y="192" class="small">No: error</text><path d="M330 258V281" class="line"/><rect x="205" y="284" width="250" height="50" rx="6" class="box"/><text x="330" y="306">Issue JWT + persist session</text><text x="330" y="324" class="small">Authorize each protected request</text><path d="M330 334V357" class="line"/><path d="M330 360L415 397L330 434L245 397Z" class="box"/><text x="330" y="402">User role?</text><path d="M245 397H110V467" class="line"/><path d="M330 434V467" class="line"/><path d="M415 397H550V467" class="line"/><text x="110" y="450" class="small">Student: web / Flutter</text><text x="330" y="453" class="small">Instructor: web</text><text x="550" y="450" class="small">Administrator: web</text><rect x="20" y="470" width="180" height="125" rx="6" class="box"/><text x="110" y="495">Join courses</text><text x="110" y="517">Read learning resources</text><text x="110" y="539">Assignments / quizzes</text><text x="110" y="561">View grades / feedback</text><text x="110" y="583">Progress / inbox / profile</text><rect x="240" y="470" width="180" height="125" rx="6" class="box"/><text x="330" y="495">Manage own courses</text><text x="330" y="517">Materials / tasks / quizzes</text><text x="330" y="539">Grade / track progress</text><text x="330" y="561">Post announcements</text><text x="330" y="583">Manage profile</text><rect x="460" y="470" width="180" height="125" rx="6" class="box"/><text x="550" y="495">School overview</text><text x="550" y="517">Manage user access</text><text x="550" y="539">Manage invitation codes</text><text x="550" y="561">Courses / enrollments</text><text x="550" y="583">Reports / notices / logs</text><path d="M110 595V642H330V677" class="line"/><path d="M330 595V642" class="line"/><path d="M550 595V642H330" class="line"/><rect x="200" y="680" width="260" height="46" rx="6" class="box"/><text x="330" y="708">Log out: revoke session</text><path d="M330 726V751" class="line"/><rect x="265" y="754" width="130" height="32" rx="16" class="box"/><text x="330" y="775">End</text></svg>';
await fs.writeFile(path.join(docs, "system-flowchart.svg"), flow);
const baseStyle = `@page{size:Letter;margin:1in 1in 1in 1.5in}*{box-sizing:border-box}body{font:12pt/1.65 'Times New Roman',serif;color:#17131b;margin:0}h1,h2,h3{line-height:1.3}h1{font-size:20pt}h2{font-size:15pt;margin:0 0 20px}h3{font-size:12pt;margin:22px 0 10px}p{text-align:justify;margin:0 0 15px}.page{break-after:page;min-height:8.8in}.page:last-child{break-after:auto}.cover{display:flex;flex-direction:column;justify-content:space-between;text-align:center;height:8.9in}.cover p{text-align:center}.cover .title{font-size:25pt;margin:35px 0 15px}.subtitle{font-size:14pt}.small{font-size:10pt;color:#6d5c7a}.flowchart{width:100%;height:7.1in;object-fit:contain}li{margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:10pt}td,th{padding:9px;text-align:left;border:1px solid #ddd4e5}th{background:#f1edf7}.caption{font-size:10pt;color:#6d5c7a;text-align:center}.screen{width:100%;max-height:7.3in;object-fit:contain;border:1px solid #e9e1ee}.screen.phone{height:7.2in;width:auto;max-width:100%;display:block;margin:auto}.label{color:#8c73ae;letter-spacing:2px;font:9pt Arial,sans-serif}@media screen{body{background:#eeeaf4;padding:35px}.page{background:white;padding:45px;max-width:850px;margin:0 auto 25px;box-shadow:0 8px 35px #38294310;min-height:auto}.cover{height:900px}.flowchart{height:740px}}`;
const html = (title, body, style = baseStyle) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${style}</style></head><body>${body}</body></html>`;
const page = (content) => `<section class="page">${content}</section>`;
const chapter = html(
  "Knowhere to Grow — Chapter 1",
  [
    page(
      `<div class="cover"><div><p>${esc(meta.institution)}<br>${esc(meta.program)}</p></div><div><span class="label">FINAL PROJECT DOCUMENTATION</span><h1 class="title">${esc(meta.title)}</h1><p class="subtitle">${esc(meta.subtitle)}</p><p>Chapter 1<br>Introduction</p></div><div><p>Prepared by<br>${esc(meta.authors)}</p><p>${esc(meta.date)}</p><p class="small">Replace bracketed institution, program, and student information before submission.</p></div></div>`,
    ),
    page(
      `<h2>CHAPTER 1<br>INTRODUCTION</h2><p>Teaching and learning involve more than distributing lessons. Students need a dependable way to locate resources, understand deadlines, submit work, and act on feedback. Instructors need a coherent place to organize content, communicate with classes, and assess student submissions. When these activities are spread across multiple messaging threads and unrelated storage locations, both groups must spend additional time finding information and confirming the status of work.</p><p>Knowhere to Grow addresses this coordination problem through a web application for students, instructors, and administrators and a Flutter application for students. Both applications communicate with one backend and one MongoDB database. This shared structure allows a submission created on a phone to be reviewed on the instructor’s web dashboard and its grade to be retrieved through either student interface.</p><h3>1.1 Project Context</h3><p>The project is intended for an academic setting in which instructors manage individual courses and students participate in enrolled classes. It provides a structured alternative to fragmented course communication without attempting to replace every institutional information system.</p><p>The web application uses MongoDB, Express.js, React.js, and Node.js. React Router manages navigation; React hooks and context manage interface and authentication state; Axios connects the interface to REST endpoints; and Bootstrap supports forms, controls, and responsive presentation. The Flutter application consumes the same API using student sessions.</p><p>This project demonstrates course concepts through a complete academic workflow: email-verified registration, password recovery, role-based access, course enrollment, content management, assignment submission, assessment, and feedback. Security checks are applied on the server, where requests are validated and permissions are verified.</p>`,
    ),
    page(
      `<h2>1.2 Purpose and Description</h2><p>The purpose of Knowhere to Grow is to centralize everyday course activities in an accessible system that supports both desktop and mobile learning. It is designed to make academic tasks easier to locate, their status easier to understand, and feedback easier to follow.</p><p>Students use the web application or Flutter app to register and sign in, browse published courses, join a class, view learning resources, read announcements, review assignment instructions and deadlines, submit written responses and attachments, and check grades with instructor comments. Students can also update their profiles and passwords and securely sign out.</p><p>Instructors use the web application to create and publish courses, upload and maintain learning materials, create assignments, configure deadlines and late-submission policies, view enrolled students, review submitted work, save grades and written feedback, and post announcements. Instructors may only manage courses that they own.</p><p>The backend exposes REST endpoints for these operations and stores records in MongoDB. Files are stored through GridFS so that the academic records and attachments use the same database service. The backend grants access to learning content only to the course owner and enrolled students, and protects individual student work from access by other students.</p><p>Authentication uses signed JSON Web Tokens associated with persisted sessions. Public signup requires email OTP. Password recovery verifies an emailed code before updating the password and revoking sessions. SMTP sender configuration is required for live mail. Web tokens are delivered in HTTP-only cookies, while mobile student tokens are stored using platform secure storage. Logging out revokes the corresponding server session; changing a password revokes other sessions.</p><p>The design uses a consistent learning workspace, visible task states, search and pagination, responsive layouts, and explicit loading and error states. Mobile navigation focuses on home, courses, assignments and grades, announcements, and profile management.</p>`,
    ),
    page(
      `<h2>1.3 Objectives</h2><h3>General Objective</h3><p>To design and develop a secure learning management system using the MERN stack, with a connected Flutter student application, that centralizes course resources, assignment submission, assessment, and academic communication.</p><h3>Specific Objectives</h3><ol><li>Develop a React web interface using components, JSX, props, state, hooks, forms, routing, and Axios integration to support student, instructor, and administrator workflows.</li><li>Build an Express.js and Node.js REST API with MongoDB persistence for user, course, enrollment, material, assignment, submission, and announcement records.</li><li>Implement account registration, password hashing, JWT authentication, logout, session revocation, role checks, course ownership, and enrollment-based permissions.</li><li>Provide complete instructor CRUD operations for courses, learning materials, assignments, and announcements, together with submission review and grading.</li><li>Allow students to access enrolled courses, retrieve resources, submit text and attachments, and view grades and constructive written feedback.</li><li>Develop a Flutter application that restricts mobile access to students while sharing the same backend and academic records with the web application.</li><li>Apply client and server validation, secure API access, responsive design, search, pagination, and clear feedback for loading, empty, success, and error states.</li><li>Evaluate implementation behavior using integration, browser, and Flutter tests, and prepare system documentation, screenshots, source code, and a project presentation.</li></ol>`,
    ),
    page(
      `<h2>1.4 Scope and Delimitation</h2><h3>Scope</h3><p>The system supports three web roles: student, instructor, and administrator. Only students may use Flutter; instructor and administrator mobile authentication is rejected by the backend.</p><p>The student scope includes registration, authentication, a responsive dashboard, published-course discovery, self-enrollment, enrolled-course access, learning resource download, assignment instructions and deadlines, submission with text and/or a file, grades and feedback, quizzes and permitted attempt review, lecture/course progress, an in-app inbox, profile editing, password changes, and logout.</p><p>The instructor scope includes invitation-protected registration, authentication, dashboard statistics, ownership-protected course creation and publication, learning material management, assignment management, submission review, grading with written feedback, quizzes and questions, student progress and score tracking, enrolled-student viewing, announcements, profile editing, and logout.</p><p>The system stores academic records and sessions in MongoDB, and attachments in GridFS. Input validation, role checks, ownership and enrollment checks, request limits, and protected file access are part of the implementation. The web interface adapts to phone, tablet, and desktop dimensions.</p><h3>Data and Assessment Rules</h3><p>Files are limited to 3 MB and approved document, image, archive, text, or video formats. Late submissions depend on an instructor-defined setting. Students may replace ungraded work; graded work is locked. Grades must fall between zero and the assignment’s maximum points and include written feedback.</p><p>Course deletion archives a course and blocks access while retaining records for recovery. Assignment deletion permanently removes associated submissions, grades, and attachments. The displayed overall grade summarizes graded assignment points; it does not implement institutional grading policies.</p>`,
    ),
    page(
      "<h2>1.4 Scope and Delimitation (continued)</h2><h3>Web Administration</h3><p>Administrators use a web-only workspace to oversee school accounts, courses, learning activity, and administrative changes. The overview summarizes users, active courses, enrollments, materials, assignments, announcements, and graded or pending submissions. Reports add activity graphs, date filters, weighted scores, and daily/course CSV exports using Philippine calendar dates.</p><p>The user directory supports search, role/status filters, pagination, account creation, profile editing, and suspension or reactivation. Suspension revokes existing web and mobile sessions while retaining teaching records. Role changes are blocked for accounts with course, enrollment, or submission history, and administrator accounts are protected from directory suspension or demotion.</p><p>Administrators generate, add, edit, copy, and deactivate unused instructor invitations. Each code registers one instructor: a transaction creates the account and consumes the code. Used codes disappear from the available list, lose their plaintext value, and become immutable history. Failed registration preserves the code. Replacing or deactivating unused codes blocks access without suspending existing instructors. The environment code imports once; restarts never restore consumed codes.</p><p>The course directory supports inspection, metadata editing, archival, restoration, and catalog publication control. Enrollment monitoring, targeted school announcements, and current learning-progress reports support school administration. Instructors retain responsibility for their learning content and grades. Recent activity previews have explicit limits, while record counts cover the course history. A searchable, paginated activity log records the actor, target, action, and time without recording passwords or invitation-code values.</p><p>Administrator accounts are created privately through a server command. Their initial random passwords are written to a local credentials file excluded from version control, deployment uploads, and source packages. Administrators use the ordinary web sign-in page; there is no public administrator signup or Flutter administrator workspace.</p>",
    ),
    page(
      `<h2>1.4 Scope and Delimitation (continued)</h2><h3>Delimitations</h3><p>The project does not include payment processing, library book circulation, live video classes, attendance tracking, institutional enrollment synchronization, third-party single sign-on, push notifications. Administrator provisioning requires trusted server access. Public registration cannot create administrator accounts.</p><p>Enrollment is self-service for published courses. The system does not implement approval queues, prerequisite enforcement, course capacity limits, or semester-based registration rules. Unpublishing a course stops new enrollment while retaining access for students who already joined.</p><p>The Flutter app requires network access. It does not queue submissions offline or synchronize edits made without a connection. Previously downloaded files may remain in the device’s private app documents after logout. An installed file viewer is required to open supported attachments.</p><p>Basic file-content validation is implemented; antivirus scanning and advanced document analysis are outside the project scope. Production use requires HTTPS, managed secrets, appropriate database network restrictions, backups, and operational monitoring.</p><p>Web browser workflows, server integration behavior, Flutter static analysis, and Flutter widget/API tests have been verified. Android bundle compilation was attempted but could not proceed because the development machine lacks the Android SDK. An Android APK, emulator or physical-device run, platform file-picker/download smoke test, and iOS build remain unverified. iOS compilation requires macOS, Xcode, and signing.</p><p>These boundaries distinguish the implemented academic functionality from platform setup and operational responsibilities that must be completed before public deployment or a device-based final demonstration.</p>`,
    ),
    page(
      `<h2>1.5 System Flowchart</h2><img class="flowchart" src="system-flowchart.svg" alt="System flow from sign-in through role-based course work, submission, grading and logout"><p class="caption">Figure 1. Role-based learning workflow using a shared Express API and MongoDB database.</p>`,
    ),
    page(
      '<h2>1.5 System Flowchart (continued)</h2><p>Students and instructors register or sign in. Instructor registration requires an unused, active code from the admin-managed list; successful signup consumes it permanently. Administrators are privately provisioned and use the web login. Flutter accepts only students.</p><p>Successful authentication creates a persisted session and a signed JWT. Every protected request checks the session, role, and account status. Course operations also verify ownership or enrollment; submitted work is private to its student and course instructor.</p><p>Instructors manage courses, materials, assignments, quizzes, announcements, grading, and learning progress. Students enroll, retrieve resources, submit work, take quizzes, mark lectures complete, read their inbox, and review grades through either student client.</p><p>Administrators manage accounts, course records and invitation codes, monitor enrollments and progress, post school announcements, and review system activity. Suspension revokes account sessions; deactivating an invitation blocks new registrations without changing existing instructor accounts.</p><p>Logout revokes the corresponding session. Password changes update the hash and revoke other sessions. These checks apply on the server and do not depend solely on visible navigation.</p><h3>Implementation References</h3><p class="small">Express: expressjs.com/en/advanced/best-practice-security/<br>MongoDB Node driver: mongodb.com/docs/drivers/node/current/<br>React: react.dev/learn<br>Flutter: docs.flutter.dev</p>',
    ),
  ].join(""),
);
await fs.writeFile(path.join(docs, "chapter1.html"), chapter);

const shots = [
  [
    "web-extension-request-phone.png",
    "Student deadline extension request and history",
    true,
  ],
  [
    "web-extension-review.png",
    "Instructor extension review and decision",
    false,
  ],
  [
    "web-email-verification-phone.png",
    "Email OTP verification before registration",
    true,
  ],
  [
    "web-password-reset-phone.png",
    "Password recovery after verified email",
    true,
  ],
  [
    "web-student-quiz-phone.png",
    "Student quiz and permitted answer review",
    true,
  ],
  [
    "web-student-progress-phone.png",
    "Student lecture and course progress",
    true,
  ],
  [
    "web-instructor-progress.png",
    "Instructor learner progress and quiz scores",
    false,
  ],
  ["web-admin-enrollments.png", "Administrator enrollment monitoring", false],
  ["web-admin-dashboard.png", "Web administrator overview", false],
  ["web-admin-users.png", "Administrator user directory", false],
  ["web-admin-courses.png", "Administrator course oversight", false],
  ["web-admin-invitations.png", "Managed instructor invitation codes", false],
  [
    "web-admin-reports-desktop.png",
    "Administrator reports, activity charts, and course analytics",
    false,
  ],
  ["web-admin-reports-phone.png", "Administrator reports at phone width", true],
  ["web-admin-phone.png", "Administrator web view at phone width", true],
  ["web-login.png", "Web sign-in", false],
  ["web-student-dashboard.png", "Student web dashboard", false],
  ["web-course-materials.png", "Course learning materials", false],
  ["web-course-catalog.png", "Expanded student course catalog", false],
  ["web-student-grades.png", "Student grades and feedback", false],
  ["web-instructor-dashboard.png", "Instructor dashboard", false],
  ["web-instructor-review.png", "Instructor submission review", false],
  ["web-phone-dashboard.png", "Responsive web dashboard — phone width", true],
  [
    "web-phone-assignments-student.png",
    "Student assignments — responsive phone cards",
    true,
  ],
  [
    "web-phone-assignments-instructor.png",
    "Instructor assignments — responsive phone cards",
    true,
  ],
  ["flutter-login.png", "Flutter student sign-in — widget render", true],
  ["flutter-dashboard.png", "Flutter student dashboard — widget render", true],
  ["flutter-materials.png", "Flutter course materials — widget render", true],
  [
    "flutter-assignment.png",
    "Flutter assignment submission — widget render",
    true,
  ],
  ["flutter-grades.png", "Flutter grade and feedback — widget render", true],
  ["flutter-profile.png", "Flutter profile — widget render", true],
  [
    "flutter-browser-login.png",
    "Flutter browser preview — student login",
    true,
  ],
  [
    "flutter-browser-dashboard.png",
    "Flutter browser preview — live Atlas dashboard",
    true,
  ],
];
const gallery = html(
  "Knowhere to Grow — System screenshots",
  page(
    `<h1>System Screenshots</h1><p>Actual web browser captures and Flutter widget renders using seeded demonstration accounts.</p><p class="small">Web captures: Microsoft Edge, desktop and phone viewport. Flutter captures: native widget test renderer at 390 × 844 logical pixels, not an emulator or physical-device run. No real student data or credentials are included.</p>`,
  ) +
    shots
      .map(([file, caption, phone], index) =>
        page(
          `<h2>${index + 1}. ${caption}</h2><img class="screen ${phone ? "phone" : ""}" src="screenshots/${file}" alt="${caption}"><p class="caption">Figure ${index + 1}. ${caption}.</p>`,
        ),
      )
      .join(""),
);
await fs.writeFile(path.join(docs, "system-screenshots.html"), gallery);

const sources = [
  ["server/src/deadlines.js", "Shared effective student deadline calculation", 1, 70],
  ["server/src/extensions.js", "Validated deadline request and owner review rules", 1, 95],
  [
    "server/src/quizzes.js",
    "Validated quizzes and private answer-key projection",
    1,
    95,
  ],
  [
    "server/src/quizzes.js",
    "Atomic quiz attempts, limits, and server grading",
    290,
    385,
  ],
  [
    "server/src/learning.js",
    "Shared course participation calculation",
    55,
    140,
  ],
  [
    "mobile/lib/learning_screen.dart",
    "Flutter student quiz submission and confirmation",
    128,
    188,
  ],
  [
    "server/src/admin.js",
    "Administrator authorization and validated management",
    1,
    85,
  ],
  [
    "server/src/invitations.js",
    "Invitation migration and transactional single-use registration",
    1,
    105,
  ],
  [
    "server/src/security.js",
    "JWT verification and session authorization",
    1,
    75,
  ],
  ["server/src/validation.js", "Server input schemas and validation", 1, 74],
  ["server/src/courses.js", "Course ownership and enrollment checks", 1, 73],
  ["server/src/content.js", "File validation and durable upload", 1, 90],
  ["client/src/App.jsx", "Protected React routing", 1, 87],
  [
    "client/src/hooks.js",
    "React state, effect, cancellation, and API hook",
    1,
    90,
  ],
  [
    "mobile/lib/api.dart",
    "Flutter shared API and student authentication",
    21,
    90,
  ],
  [
    "mobile/lib/submission_screen.dart",
    "Flutter assignment submission and confirmation",
    24,
    110,
  ],
];
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const browserPage = await browser.newPage({
    viewport: { width: 1150, height: 1000 },
  });
  for (let index = 0; index < sources.length; index++) {
    const [file, title, first, last] = sources[index];
    const lines = (await fs.readFile(path.join(root, file), "utf8"))
      .split(/\r?\n/)
      .slice(first - 1, last);
    const code = `<div class="code-window"><header><i></i><i></i><i></i><span>${esc(file)}</span></header><h1>${esc(title)}</h1><pre>${lines.map((line, n) => `<div><b>${String(first + n).padStart(3)}</b><span>${esc(line) || " "}</span></div>`).join("")}</pre></div>`;
    await browserPage.setContent(
      html(
        title,
        code,
        `body{margin:0;padding:25px;background:#eeeaf5;font:13px 'Segoe UI',Arial;color:#ddd2ef}.code-window{background:#241d32;border:1px solid #4c3b66;border-radius:13px;padding:23px}header{display:flex;align-items:center;gap:7px;font-size:12px;color:#a99abc}header i{width:9px;height:9px;background:#ae8bcb;border-radius:50%}header i:nth-child(2){background:#dcbb8c}header i:nth-child(3){background:#90b79c}header span{margin-left:14px}h1{font-size:18px;color:#dfcaef;margin:24px 0}pre{font:12px/1.6 Consolas,monospace;margin:0;white-space:pre-wrap}pre div{display:flex;min-height:19px}pre b{color:#6c5b7e;font-weight:400;flex-shrink:0;width:38px;user-select:none}pre span{white-space:pre-wrap;overflow-wrap:anywhere;flex:1}`,
      ),
    );
    await browserPage.screenshot({
      path: path.join(docs, "source-screenshots", `source-${index + 1}.png`),
      fullPage: true,
    });
  }
  const sourceGallery = html(
    "Knowhere to Grow — Source code screenshots",
    page(
      '<h1>Source Code Screenshots</h1><p>Selected implementation excerpts demonstrating authentication, validation, authorization, file handling, React hooks/routing, and Flutter API/submission behavior.</p><p class="small">The complete editable source accompanies these screenshots. Secrets and environment configuration are excluded.</p>',
    ) +
      sources
        .map(([file, title], index) =>
          page(
            `<h2>${index + 1}. ${title}</h2><p class="small">${esc(file)}</p><img class="screen" src="source-screenshots/source-${index + 1}.png" alt="Code screenshot: ${esc(title)}">`,
          ),
        )
        .join(""),
  );
  await fs.writeFile(
    path.join(docs, "source-code-screenshots.html"),
    sourceGallery,
  );
  for (const [input, output] of [
    ["chapter1.html", "Chapter-1.pdf"],
    ["system-screenshots.html", "System-Screenshots.pdf"],
    ["source-code-screenshots.html", "Source-Code-Screenshots.pdf"],
  ]) {
    await browserPage.goto(pathToFileURL(path.join(docs, input)).href);
    await browserPage.emulateMedia({ media: "print" });
    await browserPage.pdf({
      path: path.join(docs, output),
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font-size:9px;width:100%;text-align:center;color:#aaa"><span class="pageNumber"></span></div>',
    });
  }
  // Native launcher assets are rasterized from the project's code-native vector logo.
  const svg = await fs.readFile(
    path.join(root, "client/public/knowhere-to-grow.svg"),
    "utf8",
  );
  for (const [name, size] of [
    ["favicon.png", 32],
    ["icons/Icon-192.png", 192],
    ["icons/Icon-512.png", 512],
    ["icons/Icon-maskable-192.png", 192],
    ["icons/Icon-maskable-512.png", 512],
  ]) {
    await browserPage.setContent(
      `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await browserPage
      .locator("svg")
      .screenshot({ path: path.join(root, "mobile/web", name) });
  }
  for (const [density, size] of [
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
  ]) {
    await browserPage.setContent(
      `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await browserPage.locator("svg").screenshot({
      path: path.join(
        root,
        `mobile/android/app/src/main/res/mipmap-${density}/ic_launcher.png`,
      ),
    });
  }
  const iconDir = path.join(
    root,
    "mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset",
  );
  const icons = JSON.parse(
    await fs.readFile(path.join(iconDir, "Contents.json"), "utf8"),
  );
  for (const icon of icons.images) {
    const size = Math.round(parseFloat(icon.size) * parseFloat(icon.scale));
    if (!icon.filename) continue;
    await browserPage.setContent(
      `<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await browserPage
      .locator("svg")
      .screenshot({ path: path.join(iconDir, icon.filename) });
  }
  console.log(
    "Generated Chapter 1 PDF, flowchart, system screenshots PDF, source screenshots PDF, and native app icons.",
  );
} finally {
  await browser.close();
}
