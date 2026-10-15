import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api, message } from "./api";
import { useAuth } from "./auth";
import { useResource } from "./hooks";
import {
  Badge,
  Button,
  Confirm,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeading,
  formatDate,
} from "./ui";
import "./learning.css";

export function QuizHub({ courseId }) {
  const teacher = useAuth().user.role === "instructor";
  const { data, loading, error, reload } = useResource(
    courseId ? `/courses/${courseId}/quizzes` : "/quizzes",
  );
  const [opened, setOpened] = useState(null),
    [editor, setEditor] = useState(null),
    [remove, setRemove] = useState(null);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  return (
    <>
      {!courseId && (
        <PageHeading
          eyebrow="PRACTICE & DISCOVERY"
          title="Quizzes"
          description={
            teacher
              ? "Manage quizzes from each course. Review attempts and scores here."
              : "Practice what you have learned and review your permitted attempts."
          }
        />
      )}
      {teacher && courseId && (
        <div className="learning-toolbar">
          <Button onClick={() => setEditor({})}>Create quiz</Button>
        </div>
      )}
      {!data.items.length && (
        <div className="panel">
          <Empty
            title="Your next challenge awaits"
            text={
              teacher
                ? "Open a course and create its first quiz."
                : "Published quizzes from your enrolled courses will appear here."
            }
          />
        </div>
      )}
      <div className="resource-list">
        {data.items.map((q) => (
          <article className="panel" key={q._id}>
            <div className="record-heading">
              <div>
                <small>{q.course?.code}</small>
                <h3>{q.title}</h3>
              </div>
              <Badge
                tone={
                  q.archivedAt ? "neutral" : q.published ? "green" : "orange"
                }
              >
                {q.archivedAt
                  ? "Archived"
                  : q.published
                    ? "Published"
                    : "Draft"}
              </Badge>
            </div>
            <p>
              {q.questionCount} questions · {q.maxScore} points · Up to{" "}
              {q.maxAttempts} attempts
            </p>
            <p>
              {q.closesAt
                ? `Closes ${formatDate(q.closesAt, true)}`
                : "No closing date"}
            </p>
            {!teacher && (
              <p>
                Attempts used: {q.attemptCount} / {q.maxAttempts}
                {q.bestScore != null &&
                  ` · Best score: ${q.bestScore} / ${q.maxScore}`}
              </p>
            )}
            <div className="learning-toolbar">
              <Button variant="light" onClick={() => setOpened(q._id)}>
                {teacher ? "View attempts" : "Open quiz"}
              </Button>
              {teacher && !q.archivedAt && (
                <>
                  <Button
                    variant="light"
                    onClick={async () => {
                      try {
                        const { data } = await api.get(`/quizzes/${q._id}`);
                        setEditor(data);
                      } catch (e) {
                        toast.error(message(e));
                      }
                    }}
                  >
                    Edit quiz
                  </Button>
                  <Button variant="outline-danger" onClick={() => setRemove(q)}>
                    Archive quiz
                  </Button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {opened && (
        <QuizDialog
          quizId={opened}
          teacher={teacher}
          onClose={() => {
            setOpened(null);
            reload();
          }}
        />
      )}
      {editor && (
        <QuizEditor
          courseId={courseId}
          record={editor}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      )}
      {remove && (
        <Confirm
          title="Archive quiz?"
          text="This stops new attempts. Existing attempts and scores are retained for review."
          confirmLabel="Archive quiz"
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            await api.delete(`/quizzes/${remove._id}`);
            setRemove(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function QuizDialog({ quizId, teacher, onClose }) {
  const resource = useResource(`/quizzes/${quizId}`),
    attempts = useResource(`/quizzes/${quizId}/attempts`);
  const [answers, setAnswers] = useState({}),
    [taking, setTaking] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const q = resource.data;
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api.post(`/quizzes/${quizId}/attempts`, {
        revision: q.revision,
        answers: q.questions.map((_, i) => answers[i]),
      });
      setTaking(false);
      setAnswers({});
      setConfirm(false);
      resource.reload();
      attempts.reload();
      toast.success("Quiz submitted and scored.");
    } catch (e) {
      setError(message(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={q?.title || "Quiz"} wide onClose={() => !busy && onClose()}>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : (
        <>
          <p className="preserve-lines">{q.instructions}</p>
          <p>
            {q.maxScore} points · {q.maxAttempts} permitted attempts ·{" "}
            {q.closesAt
              ? `Closes ${formatDate(q.closesAt, true)}`
              : "No deadline"}
          </p>
          <p className="admin-notice">
            Answer review:{" "}
            {q.reviewPolicy === "after-close"
              ? "after the quiz closes"
              : q.reviewPolicy === "never"
                ? "scores only; answers stay private"
                : "immediately after submission"}
            . Each submitted attempt is final. Your best score appears in course
            progress.
          </p>
          {!teacher && !taking && (
            <Button
              disabled={!q.canAttempt}
              onClick={() => {
                setTaking(true);
                setError("");
              }}
            >
              {q.canAttempt
                ? `Start attempt ${q.attemptCount + 1}`
                : "No attempts available"}
            </Button>
          )}
          {taking && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirm(true);
              }}
            >
              {q.questions.map((question, i) => (
                <fieldset className="quiz-question" key={i}>
                  <legend>
                    {i + 1}. {question.prompt}{" "}
                    <small>({question.points} points)</small>
                  </legend>
                  {question.options.map((option, j) => (
                    <label className="quiz-option" key={j}>
                      <input
                        type="radio"
                        name={`answer-${i}`}
                        value={j}
                        required
                        checked={answers[i] === j}
                        onChange={() => setAnswers({ ...answers, [i]: j })}
                        disabled={busy}
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))}
              <div className="learning-toolbar">
                <Button
                  type="button"
                  variant="light"
                  disabled={busy}
                  onClick={() => setTaking(false)}
                >
                  Cancel attempt
                </Button>
                <Button type="submit" busy={busy}>
                  Submit answers
                </Button>
              </div>
            </form>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {confirm && (
            <div className="feedback-box" role="alert">
              <p>
                Submit this attempt? Answers cannot be changed after submission.
              </p>
              <div className="learning-toolbar">
                <Button busy={busy} onClick={submit}>
                  Confirm submission
                </Button>
                <Button
                  variant="light"
                  disabled={busy}
                  onClick={() => setConfirm(false)}
                >
                  Keep reviewing
                </Button>
              </div>
            </div>
          )}
          <h3 className="admin-section-title">
            {teacher ? "Student attempts" : "Your attempts"}
          </h3>
          {attempts.loading ? (
            <Loading />
          ) : attempts.error ? (
            <ErrorState error={attempts.error} retry={attempts.reload} />
          ) : attempts.data.items.length ? (
            attempts.data.items.map((a) => (
              <article className="quiz-question" key={a._id}>
                <h4>
                  {a.student?.name ? `${a.student.name} · ` : ""}Attempt{" "}
                  {a.attemptNumber}: {a.score} / {a.maxScore}
                </h4>
                <small>
                  {a.student?.email} · {formatDate(a.submittedAt, true)}
                </small>
                {a.reviewAllowed ? (
                  <details>
                    <summary>Review answers</summary>
                    {a.review.map((r, i) => (
                      <div className="quiz-review" key={i}>
                        <strong>
                          {i + 1}. {r.prompt}
                        </strong>
                        <p>Your answer: {r.options[r.chosenIndex]}</p>
                        <p>
                          Correct answer: {r.options[r.correctIndex]} ·{" "}
                          {r.earned} / {r.points} points
                        </p>
                        {r.explanation && (
                          <p className="preserve-lines">{r.explanation}</p>
                        )}
                      </div>
                    ))}
                  </details>
                ) : (
                  <p>
                    Answer review is restricted by the instructor’s settings.
                  </p>
                )}
              </article>
            ))
          ) : (
            <p>No attempts yet.</p>
          )}
        </>
      )}
    </Modal>
  );
}
const blankQuestion = () => ({
  prompt: "",
  options: ["", ""],
  correctIndex: 0,
  points: 1,
  explanation: "",
});
function QuizEditor({ courseId, record, onClose, onSaved }) {
  const [questions, setQuestions] = useState(
    record.questions || [blankQuestion()],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const localDate = (value) =>
    value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  const update = (i, patch) =>
    setQuestions(questions.map((q, j) => (i === j ? { ...q, ...patch } : q)));
  return (
    <Modal
      title={record._id ? "Edit quiz" : "Create quiz"}
      wide
      onClose={() => !busy && onClose()}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          const body = {
            title: values.title,
            instructions: values.instructions,
            published: values.published === "on",
            maxAttempts: Number(values.maxAttempts),
            reviewPolicy: values.reviewPolicy,
            closesAt: values.closesAt
              ? new Date(values.closesAt).toISOString()
              : null,
            questions,
          };
          try {
            await api[record._id ? "patch" : "post"](
              record._id
                ? `/quizzes/${record._id}`
                : `/courses/${courseId}/quizzes`,
              body,
            );
            onSaved();
            onClose();
            toast.success("Quiz saved.");
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field
          label="Quiz title"
          name="title"
          minLength={3}
          maxLength={160}
          required
          defaultValue={record.title}
        />
        <Field
          label="Quiz instructions"
          name="instructions"
          textarea
          maxLength={6000}
          defaultValue={record.instructions}
        />
        <div className="form-two">
          <Field
            label="Maximum attempts"
            name="maxAttempts"
            type="number"
            min={1}
            max={10}
            required
            defaultValue={record.maxAttempts || 1}
          />
          <Field
            label="Closing date (local time, optional)"
            name="closesAt"
            type="datetime-local"
            defaultValue={localDate(record.closesAt)}
          />
        </div>
        <Field label="Answer review" name="reviewPolicy">
          <select
            className="form-select"
            id="reviewPolicy"
            name="reviewPolicy"
            defaultValue={record.reviewPolicy || "immediate"}
          >
            <option value="immediate">Immediately after submission</option>
            <option value="after-close">After closing date</option>
            <option value="never">Scores only</option>
          </select>
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            name="published"
            defaultChecked={record.published}
          />{" "}
          Publish quiz
        </label>
        <p className="admin-notice">
          Questions and points are locked after the first accepted attempt. You
          can still update instructions, availability, and review settings.
        </p>
        {questions.map((q, i) => (
          <fieldset
            className="quiz-question"
            key={i}
            disabled={record.questionsLocked || busy}
          >
            <legend>Question {i + 1}</legend>
            <Field
              label={`Question ${i + 1} prompt`}
              name={`prompt-${i}`}
              value={q.prompt}
              required
              minLength={3}
              maxLength={2000}
              onChange={(e) => update(i, { prompt: e.target.value })}
            />
            {q.options.map((option, j) => (
              <Field
                key={j}
                label={`Question ${i + 1}, option ${j + 1}`}
                name={`option-${i}-${j}`}
                value={option}
                required
                maxLength={500}
                onChange={(e) =>
                  update(i, {
                    options: q.options.map((v, k) =>
                      k === j ? e.target.value : v,
                    ),
                  })
                }
              />
            ))}
            <div className="learning-toolbar">
              <Button
                type="button"
                variant="light"
                disabled={q.options.length >= 6}
                onClick={() => update(i, { options: [...q.options, ""] })}
              >
                Add option
              </Button>
              <Button
                type="button"
                variant="light"
                disabled={q.options.length <= 2}
                onClick={() =>
                  update(i, {
                    options: q.options.slice(0, -1),
                    correctIndex: Math.min(
                      q.correctIndex,
                      q.options.length - 2,
                    ),
                  })
                }
              >
                Remove last option
              </Button>
            </div>
            <Field
              label={`Question ${i + 1} correct option`}
              name={`correct-${i}`}
            >
              <select
                className="form-select"
                id={`correct-${i}`}
                value={q.correctIndex}
                onChange={(e) =>
                  update(i, { correctIndex: Number(e.target.value) })
                }
              >
                {q.options.map((_, j) => (
                  <option value={j} key={j}>
                    Option {j + 1}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={`Question ${i + 1} points`}
              name={`points-${i}`}
              type="number"
              required
              min={1}
              max={100}
              value={q.points}
              onChange={(e) => update(i, { points: Number(e.target.value) })}
            />
            <Field
              label={`Question ${i + 1} explanation (optional)`}
              name={`explanation-${i}`}
              textarea
              maxLength={2000}
              value={q.explanation}
              onChange={(e) => update(i, { explanation: e.target.value })}
            />
            <Button
              type="button"
              variant="outline-danger"
              disabled={questions.length === 1}
              onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
            >
              Remove question {i + 1}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="light"
          disabled={record.questionsLocked || busy || questions.length >= 100}
          onClick={() => setQuestions([...questions, blankQuestion()])}
        >
          Add question
        </Button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button
            variant="light"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Save quiz
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CourseProgress({ courseId }) {
  const teacher = useAuth().user.role === "instructor";
  const { data, loading, error, reload } = useResource(
    `/courses/${courseId}/progress`,
  );
  const [busy, setBusy] = useState("");
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  const s = data.summary;
  return (
    <div className="resource-list">
      <section className="panel">
        <h3>Learning progress</h3>
        <p>
          Each current lecture, assignment, and published quiz counts as one
          unit. Lectures are marked complete by the student; assignments count
          when submitted and quizzes when attempted. This measures
          participation, not a passing grade.
        </p>
        <ProgressBar value={s?.progressPercent} />
        <p>
          {s?.completedUnits || 0} / {s?.totalUnits || 0} learning units
          completed
        </p>
      </section>
      {teacher ? (
        <section className="panel">
          <div className="table-responsive">
            <table className="table app-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Lectures</th>
                  <th>Assignments</th>
                  <th>Quizzes</th>
                  <th>Progress</th>
                  <th>Best quiz scores</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.enrollmentId}>
                    <td>
                      {r.student?.name}
                      <small className="learning-block">
                        {r.student?.email}
                      </small>
                    </td>
                    <td>
                      {r.lecturesCompleted}/{r.lectureCount}
                    </td>
                    <td>
                      {r.assignmentsSubmitted}/{r.assignmentCount}
                    </td>
                    <td>
                      {r.quizzesCompleted}/{r.quizCount}
                    </td>
                    <td>{r.progressPercent}%</td>
                    <td>
                      {r.quizScores.map((q) => (
                        <div key={q._id}>
                          {q.title}: {q.score}/{q.maxScore}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <p>No students enrolled yet.</p>}
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <h3>Lecture completion</h3>
            <p>
              Read or watch the material, then mark it complete. You can undo a
              completion mark.
            </p>
            {data.lectures.map((r) => (
              <div className="learning-row" key={r._id}>
                <span>{r.title}</span>
                <Button
                  variant={r.completed ? "light" : "primary"}
                  busy={busy === r._id}
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(r._id);
                    try {
                      await api.put(`/materials/${r._id}/completion`, {
                        completed: !r.completed,
                      });
                      reload();
                    } catch (e) {
                      toast.error(message(e));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {r.completed ? "Mark incomplete" : "Mark complete"}
                </Button>
              </div>
            ))}
            {!data.lectures.length && <p>No lectures yet.</p>}
            <Link to={`?tab=materials`}>Open learning materials</Link>
          </section>
          {[
            ["Assignments", data.assignments, "assignments"],
            ["Quizzes", data.quizzes, "quizzes"],
          ].map(([label, rows, tab]) => (
            <section className="panel" key={tab}>
              <h3>{label}</h3>
              {rows.map((r) => (
                <div className="learning-row" key={r._id}>
                  <span>
                    {r.title}
                    {r.bestScore != null &&
                      ` · Best: ${r.bestScore}/${r.maxScore}`}
                  </span>
                  <Badge tone={r.completed ? "green" : "orange"}>
                    {r.completed ? "Completed" : "To do"}
                  </Badge>
                </div>
              ))}
              {!rows.length && <p>No {label.toLowerCase()} yet.</p>}
              <Link to={`?tab=${tab}`}>Open {label.toLowerCase()}</Link>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
export function ProgressBar({ value }) {
  return (
    <div className="learning-progress">
      <progress max="100" value={value ?? 0} aria-label="Learning progress" />
      <strong>{value == null ? "No learning units yet" : `${value}%`}</strong>
    </div>
  );
}
