import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { reportDate } from "./analytics-format";

const series = [
  { key: "newAccounts", label: "New accounts", color: "#547566" },
  { key: "newEnrollments", label: "Enrollments", color: "#aa7132" },
  { key: "submissions", label: "Submissions", color: "#315f95" },
];
export function ActivityChart({ daily, from, to }) {
  const chartId = useId();
  const plot = useRef(null);
  const [width, setWidth] = useState(620);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, Math.round(entry.contentRect.width))),
    );
    observer.observe(plot.current);
    return () => observer.disconnect();
  }, []);
  const [selected, setSelected] = useState(null);
  const index = Math.min(selected ?? daily.length - 1, daily.length - 1);
  const current = daily[index];
  const height = 220,
    left = 34,
    right = 12,
    top = 12,
    bottom = 32;
  const maximum = Math.max(
    1,
    ...daily.flatMap((row) => series.map((item) => row[item.key])),
  );
  const x = (index) =>
    left + (index / Math.max(1, daily.length - 1)) * (width - left - right);
  const y = (value) =>
    height - bottom - (value / maximum) * (height - top - bottom);
  const hasActivity = daily.some((row) =>
    series.some((item) => row[item.key] > 0),
  );
  return (
    <section className="panel analytics-chart-panel">
      <div className="section-heading">
        <div>
          <h2>Learning activity</h2>
          <p>
            {reportDate(from, true)} – {reportDate(to, true)} · Philippine time
            (UTC+8)
          </p>
        </div>
        <span className="analytics-period-tag">Daily totals</span>
      </div>
      <ul className="analytics-legend">
        {series.map((item) => (
          <li key={item.key}>
            <span style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
      <svg
        ref={plot}
        className="analytics-line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={chartId}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const svgX = ((event.clientX - box.left) / box.width) * width;
          setSelected(
            Math.max(
              0,
              Math.min(
                daily.length - 1,
                Math.round(
                  ((svgX - left) / (width - left - right)) * (daily.length - 1),
                ),
              ),
            ),
          );
        }}
      >
        <title id={chartId}>
          Daily new accounts, course enrollments, and latest submissions. Exact
          values are available below and in the data table.
        </title>
        {[...new Set([0, Math.ceil(maximum / 2), maximum])].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              className="analytics-grid-line"
            />
            <text x={left - 9} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {[
          ...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]),
        ].map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={height - 8}
            textAnchor={
              tick === 0
                ? "start"
                : tick === daily.length - 1
                  ? "end"
                  : "middle"
            }
          >
            {reportDate(daily[tick].date)}
          </text>
        ))}
        {series.map((item) => (
          <polyline
            key={item.key}
            points={daily
              .map((row, index) => `${x(index)},${y(row[item.key])}`)
              .join(" ")}
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeDasharray={item.key === "newEnrollments" ? "5 4" : undefined}
            strokeLinejoin="round"
          />
        ))}
        {current && (
          <g>
            <line
              x1={x(index)}
              x2={x(index)}
              y1={top}
              y2={height - bottom}
              className="analytics-cursor"
            />
            {series.map((item) => (
              <circle
                key={item.key}
                cx={x(index)}
                cy={y(current[item.key])}
                r="4"
                fill={item.color}
                stroke="#fffefb"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}
      </svg>
      {!hasActivity && (
        <p className="analytics-empty">No activity recorded for this period.</p>
      )}
      {current && (
        <>
          <label className="analytics-scrubber" htmlFor={`${chartId}-date`}>
            Inspect a date <strong>{reportDate(current.date, true)}</strong>
          </label>
          <input
            id={`${chartId}-date`}
            type="range"
            min="0"
            max={Math.max(0, daily.length - 1)}
            value={index}
            disabled={daily.length === 1}
            onChange={(event) => setSelected(Number(event.target.value))}
            aria-label="Inspect activity date"
            aria-valuetext={`${reportDate(current.date, true)}: ${current.newAccounts} new accounts, ${current.newEnrollments} enrollments, ${current.submissions} submissions`}
          />
          <div className="analytics-date-values">
            {series.map((item) => (
              <span key={item.key}>
                {item.label}
                <strong>{current[item.key].toLocaleString()}</strong>
              </span>
            ))}
          </div>
        </>
      )}
      <details className="analytics-data-details">
        <summary>View daily data</summary>
        <div className="analytics-table-scroll">
          <table className="analytics-data-table">
            <caption className="visually-hidden">
              Daily activity in Philippine time
            </caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>New accounts</th>
                <th>Enrollments</th>
                <th>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{reportDate(row.date, true)}</th>
                  <td>{row.newAccounts}</td>
                  <td>{row.newEnrollments}</td>
                  <td>{row.submissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function DonutChart({
  title,
  description,
  items,
  centerLabel = "Total",
  children,
}) {
  const chartId = useId();
  const total = items.reduce((sum, item) => sum + item.value, 0),
    radius = 54,
    circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <section className="panel analytics-chart-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="analytics-donut-layout">
        <svg
          className="analytics-donut"
          viewBox="0 0 150 150"
          role="img"
          aria-labelledby={chartId}
        >
          <title id={chartId}>
            {title}:{" "}
            {items.map((item) => `${item.label} ${item.value}`).join(", ")}
          </title>
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#eaede5"
            strokeWidth="15"
          />
          {items.map((item) => {
            const length = total ? (item.value / total) * circumference : 0;
            const start = offset;
            offset += length;
            return (
              <circle
                key={item.label}
                cx="75"
                cy="75"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="15"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-start}
                transform="rotate(-90 75 75)"
              >
                <title>
                  {item.label}: {item.value}
                </title>
              </circle>
            );
          })}
          <text
            x="75"
            y="73"
            textAnchor="middle"
            className="analytics-donut-total"
          >
            {total.toLocaleString()}
          </text>
          <text
            x="75"
            y="93"
            textAnchor="middle"
            className="analytics-donut-label"
          >
            {centerLabel}
          </text>
        </svg>
        <ul className="analytics-donut-legend">
          {items.map((item) => (
            <li key={item.label}>
              <span
                className="analytics-dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString()}</strong>
            </li>
          ))}
        </ul>
      </div>
      {!total && <p className="analytics-empty">No records to display.</p>}
      {children}
    </section>
  );
}

export function OverviewAnalytics({ stats, analytics }) {
  return (
    <section className="analytics-overview" aria-label="Overview analytics">
      <div className="analytics-section-title">
        <div>
          <span className="eyebrow">AT A GLANCE</span>
          <h2>Your school in numbers</h2>
        </div>
        <Link className="text-link" to="/admin/reports">
          Reports & analytics <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="analytics-chart-grid">
        <ActivityChart {...analytics} />
        <DonutChart
          title="Your learning community"
          description="Current accounts, including suspended users."
          items={[
            { label: "Students", value: stats.students, color: "#315f95" },
            {
              label: "Instructors",
              value: stats.instructors,
              color: "#8462a4",
            },
            { label: "Administrators", value: stats.admins, color: "#aa7132" },
          ]}
          centerLabel="accounts"
        >
          <div className="analytics-review-summary">
            <span>Grading across active courses</span>
            <strong>
              {stats.graded} graded{" "}
              <span>of {stats.submissions} submissions</span>
            </strong>
            <div
              className="analytics-progress"
              role="img"
              aria-label={`${stats.graded} graded; ${stats.pending} awaiting review`}
            >
              <span
                style={{
                  width: `${stats.submissions ? (stats.graded / stats.submissions) * 100 : 0}%`,
                }}
              />
            </div>
            <p>{stats.pending} awaiting review · Current totals</p>
          </div>
        </DonutChart>
      </div>
      <p className="analytics-scope-note">
        The trend covers the last 30 days. Account and grading charts show
        current totals. Learning activity excludes archived courses; account
        registrations include all roles.
      </p>
    </section>
  );
}

export function CourseActivityChart({ items }) {
  const maximum = Math.max(1, ...items.map((item) => item.submissions));
  return (
    <section className="panel analytics-chart-panel">
      <div className="section-heading">
        <div>
          <h2>Courses by submission activity</h2>
          <p>
            Top six active courses · Latest submissions in the selected period
          </p>
        </div>
      </div>
      {items.length ? (
        <ol className="analytics-course-bars">
          {items.map((item) => (
            <li key={item._id}>
              <div>
                <strong>{item.code}</strong>
                <span>{item.title}</span>
              </div>
              <div className="analytics-bar-track">
                <span
                  style={{ width: `${(item.submissions / maximum) * 100}%` }}
                />
              </div>
              <b>{item.submissions}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="analytics-empty">
          No submissions in this period. Course records will still appear in the
          table below.
        </p>
      )}
    </section>
  );
}
