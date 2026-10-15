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

const flow = `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="800" viewBox="0 0 660 800" role="img" aria-labelledby="title"><title id="title">Knowhere to Grow role-based system flowchart</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8d7ba6"/></marker><style>text{font-family:Arial,sans-serif;font-size:14px;fill:#42324e;text-anchor:middle}.box{fill:#f4effb;stroke:#b6a1cc;stroke-width:1.4}.line{fill:none;stroke:#8d7ba6;stroke-width:1.5;marker-end:url(#arrow)}.small{font-size:11px;fill:#8f7d9c}</style></defs>
<rect x="250" y="10" width="160" height="43" rx="22" class="box"/><text x="330" y="37">Start</text><path d="M330 53V78" class="line"/>
<rect x="200" y="80" width="260" height="57" rx="7" class="box"/><text x="330" y="103">Register / Sign in</text><text x="330" y="122" class="small">Web: both roles · Flutter: students only</text><path d="M330 137V160" class="line"/>
<path d="M330 161L450 210L330 259L210 210Z" class="box"/><text x="330" y="207">Valid credentials</text><text x="330" y="225">and role?</text><path d="M450 210H565V107H460" class="line"/><text x="557" y="189" class="small">No: show error</text><path d="M330 259V284" class="line"/><text x="350" y="279" class="small">Yes</text>
<rect x="206" y="286" width="248" height="50" rx="7" class="box"/><text x="330" y="308">Issue JWT + persist session</text><text x="330" y="326" class="small">Authorize every protected request</text><path d="M330 336V358" class="line"/>
<path d="M330 360L428 402L330 444L232 402Z" class="box"/><text x="330" y="407">User role?</text><path d="M232 402H158V470" class="line"/><path d="M428 402H502V470" class="line"/><text x="163" y="444" class="small">Instructor · web only</text><text x="498" y="444" class="small">Student · web / Flutter</text>
<rect x="25" y="472" width="265" height="73" rx="7" class="box"/><text x="158" y="496">Create / publish own course</text><text x="158" y="517">Manage materials, assignments,</text><text x="158" y="537">and announcements</text>
<rect x="370" y="472" width="265" height="73" rx="7" class="box"/><text x="502" y="496">Browse / join published course</text><text x="502" y="517">Read materials, instructions,</text><text x="502" y="537">deadlines, and announcements</text>
<path d="M158 545V583" class="line"/><path d="M502 545V583" class="line"/>
<rect x="25" y="585" width="265" height="64" rx="7" class="box"/><text x="158" y="610">Review submissions</text><text x="158" y="632">Save grade + written feedback</text>
<rect x="370" y="585" width="265" height="64" rx="7" class="box"/><text x="502" y="610">Submit text and/or attachment</text><text x="502" y="632">View grade + instructor feedback</text><path d="M370 605H290" class="line"/><path d="M290 631H370" class="line"/>
<path d="M158 649V681H330V705" class="line"/><path d="M502 649V681H330" fill="none" stroke="#8d7ba6" stroke-width="1.5"/>
<rect x="200" y="707" width="260" height="43" rx="7" class="box"/><text x="330" y="734">Log out → revoke JWT session</text><path d="M330 750V768" class="line"/><rect x="265" y="770" width="130" height="28" rx="14" class="box"/><text x="330" y="790">End</text></svg>`;
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
      `<h2>CHAPTER 1<br>INTRODUCTION</h2><p>Teaching and learning involve more than distributing lessons. Students need a dependable way to locate resources, understand deadlines, submit work, and act on feedback. Instructors need a coherent place to organize content, communicate with classes, and assess student submissions. When these activities are spread across multiple messaging threads and unrelated storage locations, both groups must spend additional time finding information and confirming the status of work.</p><p>Knowhere to Grow addresses this coordination problem through a web application for students and instructors and a Flutter application for students. Both applications communicate with one backend and one MongoDB database. This shared structure allows a submission created on a phone to be reviewed on the instructor’s web dashboard and its grade to be retrieved through either student interface.</p><h3>1.1 Project Context</h3><p>The project is intended for an academic setting in which instructors manage individual courses and students participate in enrolled classes. It provides a structured alternative to fragmented course communication without attempting to replace every institutional information system.</p><p>The web application uses MongoDB, Express.js, React.js, and Node.js. React Router manages navigation; React hooks and context manage interface and authentication state; Axios connects the interface to REST endpoints; and Bootstrap supports forms, controls, and responsive presentation. The Flutter application consumes the same API using student sessions.</p><p>This project demonstrates course concepts through a complete academic workflow: account registration, role-based access, course enrollment, content management, assignment submission, assessment, and feedback. Security checks are applied on the server, where requests are validated and permissions are verified.</p>`,
    ),
    page(
      `<h2>1.2 Purpose and Description</h2><p>The purpose of Knowhere to Grow is to centralize everyday course activities in an accessible system that supports both desktop and mobile learning. It is designed to make academic tasks easier to locate, their status easier to understand, and feedback easier to follow.</p><p>Students use the web application or Flutter app to register and sign in, browse published courses, join a class, view learning resources, read announcements, review assignment instructions and deadlines, submit written responses and attachments, and check grades with instructor comments. Students can also update their profiles and passwords and securely sign out.</p><p>Instructors use the web application to create and publish courses, upload and maintain learning materials, create assignments, configure deadlines and late-submission policies, view enrolled students, review submitted work, save grades and written feedback, and post announcements. Instructors may only manage courses that they own.</p><p>The backend exposes REST endpoints for these operations and stores records in MongoDB. Files are stored through GridFS so that the academic records and attachments use the same database service. The backend grants access to learning content only to the course owner and enrolled students, and protects individual student work from access by other students.</p><p>Authentication uses signed JSON Web Tokens associated with persisted sessions. Web tokens are delivered in HTTP-only cookies, while mobile student tokens are stored using platform secure storage. Logging out revokes the corresponding server session; changing a password revokes other sessions.</p><p>The design uses a consistent learning workspace, visible task states, search and pagination, responsive layouts, and explicit loading and error states. Mobile navigation focuses on home, courses, assignments and grades, announcements, and profile management.</p>`,
    ),
    page(
      `<h2>1.3 Objectives</h2><h3>General Objective</h3><p>To design and develop a secure learning management system using the MERN stack, with a connected Flutter student application, that centralizes course resources, assignment submission, assessment, and academic communication.</p><h3>Specific Objectives</h3><ol><li>Develop a React web interface using components, JSX, props, state, hooks, forms, routing, and Axios integration to support student and instructor workflows.</li><li>Build an Express.js and Node.js REST API with MongoDB persistence for user, course, enrollment, material, assignment, submission, and announcement records.</li><li>Implement account registration, password hashing, JWT authentication, logout, session revocation, role checks, course ownership, and enrollment-based permissions.</li><li>Provide complete instructor CRUD operations for courses, learning materials, assignments, and announcements, together with submission review and grading.</li><li>Allow students to access enrolled courses, retrieve resources, submit text and attachments, and view grades and constructive written feedback.</li><li>Develop a Flutter application that restricts mobile access to students while sharing the same backend and academic records with the web application.</li><li>Apply client and server validation, secure API access, responsive design, search, pagination, and clear feedback for loading, empty, success, and error states.</li><li>Evaluate implementation behavior using integration, browser, and Flutter tests, and prepare system documentation, screenshots, source code, and a project presentation.</li></ol>`,
    ),
    page(
      `<h2>1.4 Scope and Delimitation</h2><h3>Scope</h3><p>The system supports two roles: student and instructor. Both roles may use the web application. Only students may use the Flutter application; instructor mobile authentication is rejected by the backend.</p><p>The student scope includes registration, authentication, a responsive dashboard, published-course discovery, self-enrollment, enrolled-course access, learning resource download, assignment instructions and deadlines, submission with text and/or a file, grades and feedback, announcements, profile editing, password changes, and logout.</p><p>The instructor scope includes invitation-protected registration, authentication, dashboard statistics, ownership-protected course creation and publication, learning material management, assignment management, submission review, grading with written feedback, enrolled-student viewing, announcement management, profile editing, and logout.</p><p>The system stores academic records and sessions in MongoDB, and attachments in GridFS. Input validation, role checks, ownership and enrollment checks, request limits, and protected file access are part of the implementation. The web interface adapts to phone, tablet, and desktop dimensions.</p><h3>Data and Assessment Rules</h3><p>Files are limited to 3 MB and approved document, image, archive, text, or video formats. Late submissions depend on an instructor-defined setting. Students may replace ungraded work; graded work is locked. Grades must fall between zero and the assignment’s maximum points and include written feedback.</p><p>Course deletion archives a course and blocks access while retaining records for recovery. Assignment deletion permanently removes associated submissions, grades, and attachments. The displayed overall grade summarizes graded assignment points; it does not implement institutional grading policies.</p>`,
    ),
    page(
      `<h2>1.4 Scope and Delimitation (continued)</h2><h3>Delimitations</h3><p>The project does not include payment processing, library book circulation, live video classes, attendance tracking, automated quizzes, institutional enrollment synchronization, third-party single sign-on, push notifications, or password-reset email. It does not include a separate administrator dashboard; the private instructor invitation code is configured by the system operator.</p><p>Enrollment is self-service for published courses. The system does not implement approval queues, prerequisite enforcement, course capacity limits, or semester-based registration rules. Unpublishing a course stops new enrollment while retaining access for students who already joined.</p><p>The Flutter app requires network access. It does not queue submissions offline or synchronize edits made without a connection. Previously downloaded files may remain in the device’s private app documents after logout. An installed file viewer is required to open supported attachments.</p><p>Basic file-content validation is implemented; antivirus scanning and advanced document analysis are outside the project scope. Production use requires HTTPS, managed secrets, appropriate database network restrictions, backups, and operational monitoring.</p><p>Web browser workflows, server integration behavior, Flutter static analysis, and Flutter widget/API tests have been verified. Android bundle compilation was attempted but could not proceed because the development machine lacks the Android SDK. An Android APK, emulator or physical-device run, platform file-picker/download smoke test, and iOS build remain unverified. iOS compilation requires macOS, Xcode, and signing.</p><p>These boundaries distinguish the implemented academic functionality from platform setup and operational responsibilities that must be completed before public deployment or a device-based final demonstration.</p>`,
    ),
    page(
      `<h2>1.5 System Flowchart</h2><img class="flowchart" src="system-flowchart.svg" alt="System flow from sign-in through role-based course work, submission, grading and logout"><p class="caption">Figure 1. Role-based learning workflow using a shared Express API and MongoDB database.</p>`,
    ),
    page(
      `<h2>1.5 System Flowchart (continued)</h2><p>The workflow begins when a user registers or signs in. Registration validates account information; instructor registration additionally requires a private invitation code. Mobile registration and sign-in are restricted to student accounts.</p><p>After successful authentication, the server creates a persisted session and issues a signed JWT. Each protected request verifies the JWT and checks that its session has not expired or been revoked. A valid token does not, by itself, grant access to every course or submission.</p><p>Instructors proceed to their web workspace, where they create and publish courses and maintain their own learning content. For each change, the server verifies that the requesting instructor owns the relevant course.</p><p>Students proceed to their web or Flutter workspace. They discover and join published courses, then view course resources, assignments, and announcements. For learning-content requests, the server checks their enrollment. Download requests for submitted work additionally check the submission owner.</p><p>When a student submits work, the server validates the assignment deadline, late-submission policy, response, attachment type, and file size. The instructor reviews the stored submission and saves a valid score with written feedback. The student retrieves that same grade and feedback through either client.</p><p>Logging out deletes the persisted session. Subsequent requests with a copied token from that session are rejected. Password changes update the stored hash and revoke other sessions, closing the workflow with explicit control over account access.</p><h3>Implementation References</h3><p class="small">Express: expressjs.com/en/advanced/best-practice-security/<br>MongoDB Node driver: mongodb.com/docs/drivers/node/current/<br>React: react.dev/learn<br>Flutter Android setup: docs.flutter.dev/platform-integration/android/setup</p>`,
    ),
  ].join(""),
);
await fs.writeFile(path.join(docs, "chapter1.html"), chapter);

const shots = [
  ["web-login.png", "Web sign-in", false],
  ["web-student-dashboard.png", "Student web dashboard", false],
  ["web-course-materials.png", "Course learning materials", false],
  ["web-course-catalog.png", "Expanded student course catalog", false],
  ["web-student-grades.png", "Student grades and feedback", false],
  ["web-instructor-dashboard.png", "Instructor dashboard", false],
  ["web-instructor-review.png", "Instructor submission review", false],
  ["web-phone-dashboard.png", "Responsive web dashboard — phone width", true],
  ["web-phone-assignments-student.png", "Student assignments — responsive phone cards", true],
  ["web-phone-assignments-instructor.png", "Instructor assignments — responsive phone cards", true],
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
