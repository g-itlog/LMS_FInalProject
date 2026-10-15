import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./auth";
import AuthPage from "./AuthPage";
import Shell from "./Shell";
import Dashboard from "./Dashboard";
import Courses from "./Courses";
import CourseDetail from "./CourseDetail";
import ActivityPage from "./ActivityPage";
import Profile from "./Profile";
import { ErrorState, Loading } from "./ui";
import {
  AdminActivity,
  AdminCourses,
  AdminOverview,
  AdminUsers,
} from "./Admin";
import AdminInvitations from "./AdminInvitations";
function Home() {
  const { user } = useAuth();
  return user.role === "admin" ? <AdminOverview /> : <Dashboard />;
}
function AdminOnly() {
  const { user } = useAuth();
  return user.role === "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
function LearningOnly() {
  const { user } = useAuth();
  return user.role !== "admin" ? <Outlet /> : <Navigate to="/" replace />;
}
function Protected() {
  const { user, loading, unavailable, restore } = useAuth();
  if (loading) return <Loading />;
  if (unavailable)
    return (
      <ErrorState
        error="The server is unavailable. Start the API and check your database connection."
        retry={restore}
      />
    );
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route element={<Protected />}>
            <Route index element={<Home />} />
            <Route path="admin" element={<AdminOnly />}>
              <Route index element={<Navigate to="/" replace />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="invitations" element={<AdminInvitations />} />
            </Route>
            <Route element={<LearningOnly />}>
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:courseId" element={<CourseDetail />} />
              <Route
                path="/assignments"
                element={<ActivityPage type="assignments" />}
              />
              <Route path="/grades" element={<ActivityPage type="grades" />} />
              <Route
                path="/announcements"
                element={<ActivityPage type="announcements" />}
              />
            </Route>
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: 14, borderRadius: 12 },
        }}
      />
    </AuthProvider>
  );
}
