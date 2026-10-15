import { useState } from "react";
import {
  Download,
  RefreshCw,
  Users,
  GraduationCap,
  ClipboardList,
  Clock3,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useDebounced, useResource } from "./hooks";
import {
  Badge,
  Button,
  ErrorState,
  Loading,
  PageHeading,
  Pagination,
  SearchBox,
} from "./ui";
import {
  ActivityChart,
  CourseActivityChart,
  DonutChart,
} from "./AnalyticsCharts";
import { percent, reportDate } from "./analytics-format";
import { ProgressBar } from "./Learning";

function recentPeriod(days = 30) {
  const to = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  return {
    from: new Date(Date.parse(to) - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10),
    to,
  };
}
const number = (value) => value.toLocaleString();
export default function AdminReports() {
  const [range, setRange] = useState(() => recentPeriod());
  const [draft, setDraft] = useState(range);
  const [preset, setPreset] = useState("30");
  const [validation, setValidation] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState("");
  const debouncedSearch = useDebounced(search);
  const query = new URLSearchParams({
    ...range,
    search: debouncedSearch,
    page,
  });
  const { data, loading, error, reload } = useResource(
    `/admin/reports?${query}`,
  );
  function apply(event) {
    event.preventDefault();
    const days = (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000;
    if (
      !draft.from ||
      !draft.to ||
      !Number.isFinite(days) ||
      days < 0 ||
      days > 365
    ) {
      setValidation("Choose a start and end date covering 1–366 days.");
      return;
    }
    setValidation("");
    setRange({ ...draft });
    setPage(1);
  }
  async function exportCsv(kind) {
    setExporting(kind);
    try {
      const params = new URLSearchParams({
        from: data.from,
        to: data.to,
        kind,
        ...(kind === "courses" ? { search: debouncedSearch } : {}),
      });
      const response = await api.get(`/admin/reports/export?${params}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `knowhere-${kind}-${data.from}-${data.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Report downloaded.");
    } catch (error) {
      let detail = message(error);
      // Axios also decodes failed CSV requests as blobs, including JSON errors.
      if (error.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await error.response.data.text());
          if (typeof body.message === "string") detail = body.message;
        } catch {
          // Keep the normal connection/timeout message for non-JSON failures.
        }
      }
      toast.error(detail);
    } finally {
      setExporting("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="SCHOOL INSIGHTS"
        title="Reports & analytics"
        description="Follow learning activity, review progress, and export your course reports."
        action={
          <Button variant="light" onClick={reload}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        }
      />
      <form className="panel analytics-filters" onSubmit={apply}>
        <div>
          <label htmlFor="report-preset">Reporting period</label>
          <select
            id="report-preset"
            className="form-select"
            value={preset}
            onChange={(event) => {
              const value = event.target.value;
              setPreset(value);
              setValidation("");
              if (value !== "custom") {
                const next = recentPeriod(Number(value));
                setRange(next);
                setDraft(next);
                setPage(1);
              }
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom dates</option>
          </select>
        </div>
        <div>
          <label htmlFor="report-from">From</label>
          <input
            className="form-control"
            id="report-from"
            type="date"
            value={draft.from}
            required
            onChange={(event) => {
              setDraft({ ...draft, from: event.target.value });
              setPreset("custom");
              setValidation("");
            }}
          />
        </div>
        <div>
          <label htmlFor="report-to">Through</label>
          <input
            className="form-control"
            id="report-to"
            type="date"
            value={draft.to}
            required
            onChange={(event) => {
              setDraft({ ...draft, to: event.target.value });
              setPreset("custom");
              setValidation("");
            }}
          />
        </div>
        <Button type="submit">Apply dates</Button>
        <p>Both dates included · Philippine time (UTC+8) · Up to 366 days</p>
        {validation && (
          <p className="form-error" role="alert">
            {validation}
          </p>
        )}
      </form>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        data && (
          <>
            {loading && (
              <p className="analytics-scope-note" role="status">
                Updating report…
              </p>
            )}
            <div className="analytics-report-heading">
              <div>
                <h2>
                  {reportDate(data.from, true)} – {reportDate(data.to, true)}
                </h2>
                <p>
                  Generated{" "}
                  {new Intl.DateTimeFormat("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: data.timeZone,
                  }).format(new Date(data.generatedAt))}{" "}
                  · Philippine time
                </p>
              </div>
              <div className="analytics-export-actions">
                <Button
                  variant="light"
                  disabled={
                    loading || !!exporting || search !== debouncedSearch
                  }
                  busy={exporting === "daily"}
                  onClick={() => exportCsv("daily")}
                >
                  <Download size={16} />
                  Daily CSV
                </Button>
                <Button
                  variant="light"
                  disabled={
                    loading || !!exporting || search !== debouncedSearch
                  }
                  busy={exporting === "courses"}
                  onClick={() => exportCsv("courses")}
                >
                  <Download size={16} />
                  Course CSV
                </Button>
              </div>
            </div>
            <div className="stats-grid analytics-stats">
              {[
                [Users, "New accounts", data.summary.newAccounts],
                [GraduationCap, "New enrollments", data.summary.newEnrollments],
                [ClipboardList, "Latest submissions", data.summary.submissions],
                [Clock3, "Awaiting review", data.summary.pending],
              ].map(([Icon, label, value]) => (
                <div className="stat-card" key={label}>
                  <span className="stat-icon blue">
                    <Icon size={21} />
                  </span>
                  <div>
                    <strong>{number(value)}</strong>
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="analytics-chart-grid">
              <ActivityChart {...data} />
              <DonutChart
                title="Submission review"
                description="Current review status of submissions in this period."
                items={[
                  {
                    label: "Graded",
                    value: data.summary.graded,
                    color: "#547566",
                  },
                  {
                    label: "Awaiting review",
                    value: data.summary.pending,
                    color: "#c28b42",
                  },
                ]}
                centerLabel="submissions"
              >
                <div className="analytics-summary-metrics">
                  <div>
                    <span>Reviewed</span>
                    <strong>{percent(data.summary.reviewRate)}</strong>
                  </div>
                  <div>
                    <span>Weighted score</span>
                    <strong>{percent(data.summary.weightedScore)}</strong>
                  </div>
                  <div>
                    <span>Late submissions</span>
                    <strong>{number(data.summary.late)}</strong>
                  </div>
                </div>
                <p className="analytics-scope-note">
                  Weighted score = earned ÷ possible points across{" "}
                  {data.summary.scoredSubmissions} scored submissions. Zero
                  scores are included; ungraded work is excluded.
                </p>
              </DonutChart>
            </div>
            <CourseActivityChart items={data.topCourses} />
            {data.learning && (
              <section className="panel">
                <h2>Current learning progress</h2>
                <ProgressBar value={data.learning.progressPercent} />
                <p>
                  {data.learning.completedUnits} / {data.learning.totalUnits}{" "}
                  learning units · {data.learning.lecturesCompleted} lecture
                  completions · {data.learning.quizzesCompleted} completed
                  student/quiz pairs · {data.learning.quizAttempts} quiz
                  attempts
                </p>
                <p>
                  Current totals for active courses, independent of the
                  reporting dates above. Each lecture, submitted assignment, and
                  attempted published quiz is one unit. Lecture completion is
                  student-confirmed. Repeated attempts do not add progress
                  units.
                </p>
              </section>
            )}
            <section className="panel analytics-course-report">
              <div className="section-heading">
                <div>
                  <h2>Course report</h2>
                  <p>
                    {data.courses.total} matching active courses · Enrollment
                    and assignment counts are current totals.
                  </p>
                </div>
              </div>
              <SearchBox
                value={search}
                onChange={(value) => {
                  setSearch(value.slice(0, 100));
                  setPage(1);
                }}
                placeholder="Search report courses"
              />
              <p className="analytics-scope-note">
                Search filters this table and the Course CSV only. Charts and
                period totals remain school-wide. Course CSV includes every
                matching course, across all pages.
              </p>
              <div className="analytics-table-scroll">
                <table className="analytics-data-table analytics-course-table">
                  <caption className="visually-hidden">
                    Course activity report. Submissions, review counts, late
                    counts, and scores use the selected reporting period.
                  </caption>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Enrollments</th>
                      <th>Assignments</th>
                      <th>Current progress</th>
                      <th>Submissions</th>
                      <th>Graded</th>
                      <th>Awaiting review</th>
                      <th>Late</th>
                      <th>Weighted score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.courses.items.map((course) => (
                      <tr key={course._id}>
                        <th scope="row">
                          <strong>{course.code}</strong>
                          <span>{course.title}</span>
                          <Badge tone={course.published ? "green" : "neutral"}>
                            {course.published ? "Published" : "Unpublished"}
                          </Badge>
                        </th>
                        <td>{number(course.enrollments)}</td>
                        <td>{number(course.assignments)}</td>
                        <td>{percent(course.progressPercent)}</td>
                        <td>{number(course.submissions)}</td>
                        <td>{number(course.graded)}</td>
                        <td>{number(course.pending)}</td>
                        <td>{number(course.late)}</td>
                        <td>{percent(course.weightedScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.courses.items.length && (
                <p className="analytics-empty">
                  No matching courses. Try another search.
                </p>
              )}
              <Pagination
                page={data.courses.page}
                pages={data.courses.pages}
                onChange={setPage}
              />
            </section>
            <details className="panel analytics-definitions">
              <summary>How to read these reports</summary>
              <ul>
                <li>
                  Account registrations include all roles, including accounts
                  currently suspended. Course activity includes published and
                  unpublished courses and excludes archived courses.
                </li>
                <li>
                  Enrollments count course memberships, so one student joining
                  two courses counts as two enrollments.
                </li>
                <li>
                  Each assignment has one current submission per student.
                  Resubmitting moves that submission into its latest submission
                  date; this report does not count every upload attempt.
                </li>
                <li>
                  Grading figures show the current status and scores of
                  submissions dated within the period. They do not count grading
                  actions performed during the period.
                </li>
                <li>
                  Missing or invalid assessment totals are excluded from
                  weighted scores. A dash means there is no valid denominator;
                  it does not mean zero performance.
                </li>
                <li>
                  Reports are generated when loaded or refreshed. They reflect
                  the records currently stored, rather than a permanent
                  historical snapshot.
                </li>
              </ul>
            </details>
          </>
        )
      )}
    </>
  );
}
