# Knowhere to Grow interface

The interface takes its cues from printed course catalogs and a student's desk: warm paper, dark ink, numbered course covers, fine rules, and a restrained ochre accent. Public Sans handles navigation and forms; Lora gives page titles and deadlines a distinct hierarchy. Both fonts are bundled, with their SIL Open Font Licenses, so the apps do not depend on a font CDN.

The React web workspace supports students and instructors. Its overview highlights the next future assignment or an ungraded submission with a direct action, then shows real course and submission counts. On phones, the sidebar becomes a keyboard-accessible drawer and assignment/grade tables become labeled cards. Focus indicators, readable status colors, a skip link, and reduced-motion support remain available.

The student Flutter app uses the same palette and typography with native navigation and controls. Its desk shows the earliest unsubmitted future assignment, followed by a compact record of progress, deadlines, and courses. Course rows use a numbered colored spine to leave more space for titles. Downloads, submission, grading feedback, and account forms share consistent borders and spacing.

Web styling lives in `client/src/index.css` (layout and shared controls) and `client/src/workspace.css` (the visual system and responsive presentation). Flutter styling lives in `mobile/lib/theme.dart` and `mobile/lib/widgets.dart`.

Verification includes both web roles across six pages at 320, 390, 768, and 1280 pixels; mobile navigation focus behavior; and Flutter rendering with larger text at 320 pixels. See `TEST_REPORT.md` for the complete results and native device verification limits. Current captures are in `screenshots/` and `System-Screenshots.pdf`.
