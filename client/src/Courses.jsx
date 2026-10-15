import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "./auth";
import { useDebounced, useResource } from "./hooks";
import {
  Button,
  CourseCard,
  Empty,
  ErrorState,
  Loading,
  PageHeading,
  Pagination,
  SearchBox,
} from "./ui";
import { Editor } from "./Editors";

export default function Courses() {
  const { user } = useAuth();
  const instructor = user.role === "instructor";
  const [params, setParams] = useSearchParams();
  const scope =
    params.get("scope") === "catalog" && !instructor ? "catalog" : "mine";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebounced(search);
  const create = params.has("create") && instructor;
  const { data, loading, error, reload } = useResource(
    `/courses?scope=${scope}&search=${encodeURIComponent(query)}&page=${page}`,
  );
  function changeScope(next) {
    setParams(next === "mine" ? {} : { scope: next });
    setPage(1);
  }
  return (
    <>
      <PageHeading
        eyebrow="A SPACE FOR EVERY POSSIBILITY"
        title={scope === "catalog" ? "Explore courses" : "My courses"}
        description={
          instructor
            ? "Create meaningful learning experiences, one course at a time."
            : "Make your next step a little more inspired."
        }
        action={
          instructor && (
            <Button onClick={() => setParams({ create: "1" })}>
              <Plus size={17} />
              Create course
            </Button>
          )
        }
      />
      <div className="list-toolbar">
        {!instructor ? (
          <div className="segmented">
            <button
              className={scope === "mine" ? "selected" : ""}
              onClick={() => changeScope("mine")}
            >
              Enrolled courses
            </button>
            <button
              className={scope === "catalog" ? "selected" : ""}
              onClick={() => changeScope("catalog")}
            >
              Explore courses
            </button>
          </div>
        ) : (
          <div className="list-count">
            {data?.total || 0} courses in your workspace
          </div>
        )}
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search courses, codes, categories…"
        />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : data.items.length ? (
        <>
          <div className="course-grid">
            {data.items.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      ) : (
        <div className="panel">
          <Empty
            title={
              search
                ? "No courses match your search"
                : scope === "mine"
                  ? instructor
                    ? "Start your first classroom"
                    : "Your learning journey starts here"
                  : "More learning is on its way"
            }
            text={
              search
                ? "Try another course title, code, or category."
                : instructor
                  ? "Create a course, add your resources, and publish when you’re ready."
                  : scope === "mine"
                    ? "Browse the catalog and join a course to get started."
                    : "Published courses will appear here. Check back with your instructor."
            }
            action={
              instructor ? (
                <Button onClick={() => setParams({ create: "1" })}>
                  Create a course
                </Button>
              ) : (
                scope === "mine" && (
                  <Button onClick={() => changeScope("catalog")}>
                    Explore courses
                  </Button>
                )
              )
            }
          />
        </div>
      )}
      {create && (
        <Editor type="courses" onClose={() => setParams({})} onSaved={reload} />
      )}
    </>
  );
}
