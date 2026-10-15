import { useState } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "./auth";
import { message } from "./api";

export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <BookOpen size={23} />
      </span>
      <span>
        classroom<span className="brand-dot">.</span>
        <small>LEARN. CONNECT. GROW.</small>
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
export default function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current =
    links.find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path),
    )?.[1] || "My profile";
  const instructor = user.role === "instructor";
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
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
            {instructor ? "Instructor workspace" : "Student workspace"}
            <small>Classroom LMS</small>
          </div>
          <span className="online-dot" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {links.map(([path, label, Icon]) => (
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
          <div className="sidebar-note">
            <span className="note-symbol">✦</span>
            <h4>
              A little progress,
              <br />
              every single day.
            </h4>
            <p>Your next chapter starts here.</p>
            {!instructor && (
              <Link to="/courses?scope=catalog" onClick={() => setOpen(false)}>
                Explore courses <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
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
          <div className="sidebar-caption">Made for better learning.</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-btn mobile-only"
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
              to="/announcements"
              className="icon-btn"
              aria-label="Announcements"
            >
              <Megaphone size={19} />
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
                <small>{instructor ? "Instructor" : "Student"}</small>
              </div>
            </Link>
          </div>
        </header>
        <main className="workspace-main" key={location.pathname}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} Classroom LMS</span>
          <span>A space to learn, a place to grow.</span>
        </footer>
      </div>
    </div>
  );
}
