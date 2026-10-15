import { useEffect, useRef, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  LayoutDashboard,
  LibraryBig,
  ClipboardList,
  GraduationCap,
  Megaphone,
  UserRound,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ChevronRight,
  PanelTop,
  Users,
  ScrollText,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "./auth";
import { message } from "./api";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Knowhere to Grow home">
      <span className="brand-mark">
        <BookOpen size={23} />
      </span>
      <span className="brand-wordmark">
        <span>Knowhere</span>
        <span className="brand-second">to Grow</span>
      </span>
    </Link>
  );
}
const links = [
  ["/", "Overview", LayoutDashboard],
  ["/courses", "My courses", LibraryBig],
  ["/assignments", "Assignments", ClipboardList],
  ["/grades", "Grades & feedback", GraduationCap],
  ["/announcements", "Announcements", Megaphone],
];
const adminLinks = [
  ["/", "Overview", LayoutDashboard],
  ["/admin/users", "Users", Users],
  ["/admin/courses", "Courses", LibraryBig],
  ["/admin/invitations", "Invitation codes", KeyRound],
  ["/admin/activity", "Activity log", ScrollText],
];
export default function Shell() {
  const { user, logout } = useAuth();
  const admin = user.role === "admin";
  const workspaceLinks = admin ? adminLinks : links;
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const returnFocus = menuButton.current;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector('[aria-label="Close navigation"]')?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const elements = [
        ...sidebar.current.querySelectorAll("a[href], button:not([disabled])"),
      ].filter((node) => node.getClientRects().length);
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      returnFocus?.focus();
    };
  }, [open]);
  const location = useLocation();
  const current =
    workspaceLinks.find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path),
    )?.[1] || "My profile";
  const instructor = user.role === "instructor";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        inert={mobile && !open}
        className={`sidebar ${open ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-tag">
          <span className="workspace-icon">
            <PanelTop size={17} />
          </span>
          <div>
            {admin
              ? "Admin workspace"
              : instructor
                ? "Instructor workspace"
                : "Student workspace"}
            <small>Knowhere to Grow</small>
          </div>
          <span className="online-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace">
          {workspaceLinks.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              {instructor && path === "/grades" ? "Review submissions" : label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            className="sidebar-catalog"
            to={
              admin
                ? "/admin/activity"
                : instructor
                  ? "/courses?create=1"
                  : "/courses?scope=catalog"
            }
            onClick={() => setOpen(false)}
          >
            <BookOpen size={21} />
            <span>
              {admin
                ? "Review admin activity"
                : instructor
                  ? "Start a new course"
                  : "Find your next course"}
              <small>
                {admin
                  ? "Account and course changes"
                  : instructor
                    ? "Build your classroom"
                    : "Browse the course catalog"}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <NavLink
            to="/profile"
            className="nav-item"
            onClick={() => setOpen(false)}
          >
            <UserRound size={19} />
            My profile
          </NavLink>
          <button
            className="nav-item logout"
            onClick={async () => {
              try {
                await logout();
              } catch (e) {
                toast.error(message(e));
              }
            }}
          >
            <LogOut size={19} />
            Sign out
          </button>
          <div className="sidebar-caption">
            KNOWHERE TO GROW /{" "}
            {admin ? "ADMIN" : instructor ? "FACULTY" : "STUDENT"}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-only"
              ref={menuButton}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={23} />
            </button>
            <span className="desktop-only">Workspace</span>
            <ChevronRight size={14} className="desktop-only" />
            <strong>{current}</strong>
          </div>
          <div className="topbar-right">
            <span className="today desktop-only">
              {new Intl.DateTimeFormat("en-PH", {
                weekday: "short",
                month: "short",
                day: "numeric",
              }).format(new Date())}
            </span>
            <Link
              to={admin ? "/admin/activity" : "/announcements"}
              className="icon-btn"
              aria-label={admin ? "Activity log" : "Announcements"}
            >
              {admin ? <ShieldCheck size={19} /> : <Megaphone size={19} />}
            </Link>
            <span className="top-divider" />
            <Link to="/profile" className="user-link">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="desktop-only">
                <strong>{user.name}</strong>
                <small>
                  {admin
                    ? "Administrator"
                    : instructor
                      ? "Instructor"
                      : "Student"}
                </small>
              </div>
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="workspace-main"
          key={location.pathname}
        >
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} Knowhere to Grow</span>
          <span>Your learning workspace.</span>
        </footer>
      </div>
    </div>
  );
}
