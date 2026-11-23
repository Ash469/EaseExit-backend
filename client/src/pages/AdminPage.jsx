import React, { useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { LogOut, User } from "lucide-react";
import DownloadUsersButton from "../components/DownloadUsersButton";
import DownloadApplicationsButton from "../components/DownloadApplicationsButton";
// Load XLSX and FileSaver from CDN to resolve compilation error
// These libraries will be available globally as `XLSX` and `saveAs`
// Ensure these script tags are loaded in the HTML page where this React app is embedded
// For a standalone React app, you might include them in public/index.html or similar.
/*
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
*/

import { useMemo } from "react";

const PER_PAGE = 25;

function MovementList({ title, badge, items = [], onView }) {
  const [nameQ, setNameQ] = useState("");
  const [batchQ, setBatchQ] = useState("");
  const [page, setPage] = useState(1);

  // Reset to page 1 when filters or source change
  useEffect(() => {
    setPage(1);
  }, [nameQ, batchQ, items]);

  // Filter FIRST (over the whole dataset), then paginate
  const filtered = useMemo(() => {
    const n = nameQ.trim().toLowerCase();
    const b = batchQ.trim();
    return items.filter((app) => {
      const name = (app.student?.name || "").toLowerCase();
      const batch = String(app.student?.batch ?? "");
      const nameOk = !n || name.includes(n);
      const batchOk = !b || batch.includes(b); // partial match allowed
      return nameOk && batchOk;
    });
  }, [items, nameQ, batchQ]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PER_PAGE;
  const endIdx = Math.min(startIdx + PER_PAGE, total);
  const pageItems = filtered.slice(startIdx, endIdx);

  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="bg-white rounded-2xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-gray-500">
            {total}/{badge} matched
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
            {badge}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <input
          type="text"
          value={nameQ}
          onChange={(e) => setNameQ(e.target.value)}
          placeholder="Search by student name…"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="text"
          value={batchQ}
          onChange={(e) => setBatchQ(e.target.value)}
          placeholder="Search by batch (e.g., 2023)…"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {pageItems.length === 0 ? (
        <p className="text-sm text-gray-500">No records.</p>
      ) : (
        <>
          {/* Scrollable table area (80vh) */}
          <div className="h-[80vh] overflow-y-auto overflow-x-auto no-scrollbar -mx-4 sm:mx-0 rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {[
                    "Student",
                    "Batch",
                    "From",
                    "To",
                    "Out At",
                    "Return",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {pageItems.map((app) => (
                  <tr key={app._id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800 font-medium">
                      {app.student?.name || "Deleted Student"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {app.student?.batch ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDateTime(app.startDate)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDateTime(app.endDate)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDateTime(app.outAt)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {formatDateTime(app.returnedAt)}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        className="text-indigo-600 hover:underline text-sm"
                        onClick={() => onView(app)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination (stays visible) */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{startIdx + 1}</span>–
              <span className="font-medium">{endIdx}</span> of{" "}
              <span className="font-medium">{total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                disabled={safePage === 1}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page <span className="font-medium">{safePage}</span> of{" "}
                <span className="font-medium">{totalPages}</span>
              </span>
              <button
                onClick={next}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ title, value, accent = "indigo" }) {
  const ring =
    {
      indigo: "ring-indigo-200 text-indigo-700",
      green: "ring-green-200 text-green-700",
      amber: "ring-amber-200 text-amber-700",
      rose: "ring-rose-200 text-rose-700",
    }[accent] || "ring-gray-200 text-gray-700";

  return (
    <div className="bg-gray-50 rounded-2xl p-6 shadow-sm">
      <p className="text-gray-600">{title}</p>
      <p className={`mt-2 text-4xl font-bold ${ring}`}>{value}</p>
    </div>
  );
}

function StatusCard({ title, data, labels }) {
  const pending = data.pending || 0;
  const approved = data.approved || 0;
  const rejected = data.rejected || 0;
  const stopped = data.stopped || 0;
  const total = pending + approved + rejected + stopped || 1;
  const pct = (v) => Math.round((v / total) * 100);

  return (
    <div className="bg-white rounded-2xl border p-6">
      <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="flex gap-2 mb-3 flex-wrap">
        {approved ? (
          <CountBadge
            label={labels?.approved ?? "Approved"}
            count={approved}
            color="green"
          />
        ) : null}
        {pending ? (
          <CountBadge
            label={labels?.pending ?? "Pending"}
            count={pending}
            color="yellow"
          />
        ) : null}
        {rejected ? (
          <CountBadge
            label={labels?.rejected ?? "Rejected"}
            count={rejected}
            color="red"
          />
        ) : null}
        {stopped ? (
          <CountBadge
            label={labels?.stopped ?? "Stopped"}
            count={stopped}
            color="gray"
          />
        ) : null}
      </div>

      {/* progress-like bar */}
      <div className="w-full h-2 rounded bg-gray-100 overflow-hidden">
        <div
          className="h-2 bg-green-400"
          style={{ width: `${pct(approved)}%` }}
        ></div>
        <div
          className="h-2 bg-yellow-400"
          style={{ width: `${pct(pending)}%` }}
        ></div>
        <div
          className="h-2 bg-red-400"
          style={{ width: `${pct(rejected)}%` }}
        ></div>
        {stopped ? (
          <div
            className="h-2 bg-gray-400"
            style={{ width: `${pct(stopped)}%` }}
          ></div>
        ) : null}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Approved {pct(approved)}% • Pending {pct(pending)}% • Rejected{" "}
        {pct(rejected)}% {stopped ? `• Stopped ${pct(stopped)}%` : ""}
      </p>
    </div>
  );
}

function InfoCard({ title, value }) {
  return (
    <div className="bg-white rounded-2xl p-6 border shadow-sm">
      <p className="text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function TrendChart({ data }) {
  // simple bar chart with pure HTML/CSS
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="bg-white rounded-2xl p-6 border">
      <h3 className="font-semibold text-gray-800 mb-4">
        New Leaves (last 7 days)
      </h3>
      <div className="flex items-end gap-3 h-40">
        {data.map((d) => (
          <div key={d.date} className="flex flex-col items-center flex-1">
            <div
              className="w-full bg-indigo-200 rounded-t"
              style={{ height: `${(d.count / max) * 100}%` }}
            ></div>
            <span className="text-xs text-gray-500 mt-2">
              {d.date.slice(5)}
            </span>
            <span className="text-xs text-gray-700">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountBadge({ label, count = 0, color = "gray" }) {
  const cls =
    {
      green: "bg-green-100 text-green-800",
      yellow: "bg-yellow-100 text-yellow-800",
      red: "bg-red-100 text-red-800",
      gray: "bg-gray-200 text-gray-700",
      indigo: "bg-indigo-100 text-indigo-800",
    }[color] || "bg-gray-200 text-gray-700";

  const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded bg-white/60">
        {safeCount}
      </span>
    </span>
  );
}

function StatusPill({ status }) {
  const s = (status ?? "pending").toString();
  const styles = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    stopped: "bg-gray-200 text-gray-700",
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
        styles[s] ?? styles.pending
      }`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

// Helper function to get authorization header
const authHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// Function to format date and time for consistent display
const formatDateTime = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "N/A";

  // Subtract 5 hours and 30 minutes (5.5 hours = 19,800,000 milliseconds)
  const adjustedDate = new Date(d.getTime() - 5.5 * 60 * 60 * 1000);

  return adjustedDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", // <— force IST
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // optional: 24-hour clock
  });
};

// Reusable badge component for status display (consistent with GuardPage)
// function StatusBadge({ status }) {
//   const styles = {
//     pending: "bg-yellow-100 text-yellow-800",
//     approved: "bg-green-100 text-green-800",
//     rejected: "bg-red-100 text-red-800",
//     stopped: "bg-gray-200 text-gray-700",
//   };
//   return (
//     <span
//       className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
//         styles[status] || styles.pending
//       }`}
//     >
//       {status?.charAt(0).toUpperCase() + status?.slice(1)}
//     </span>
//   );
// }

// Generic Confirmation Modal
function ConfirmationModal({
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  isLoading = false, // Added isLoading prop
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="relative bg-white rounded-3xl shadow-lg w-full max-w-sm p-8 transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Confirm Action
        </h2>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition shadow-md"
            disabled={isLoading} // Disable cancel button when loading
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading} // Disable confirm button when loading
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable UserTable component (only for Admin, Warden, Guard roles in this context)
function UserTable({ rows, onView, onDelete, onEdit, query, deletingUserIds }) {
  // Added deletingUserIds prop
  const filteredRows = rows.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow mb-6">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {["Name", "Email", "Role", "Actions"].map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan="4" className="text-center py-4 text-gray-500">
                No users found.
              </td>
            </tr>
          ) : (
            filteredRows.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-800 font-medium">
                  {u.name}
                </td>
                <td className="px-6 py-4 text-gray-600">{u.email}</td>
                <td className="px-6 py-4 capitalize text-gray-600">{u.role}</td>
                <td className="px-6 py-4 space-x-2">
                  <button
                    onClick={() => onView(u)}
                    className="text-indigo-600 hover:underline text-sm"
                    disabled={deletingUserIds.has(u._id)} // Disable view button if user is being deleted
                  >
                    View
                  </button>
                  <button
                    onClick={() => onEdit(u)}
                    className="text-blue-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deletingUserIds.has(u._id)}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(u)}
                    className="text-red-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={deletingUserIds.has(u._id)} // Disable delete button when deleting
                  >
                    {deletingUserIds.has(u._id) ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("stats");
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalLeaves: 0,
    leavesByParentStatus: { pending: 0, approved: 0, rejected: 0 },
    leavesByWardenStatus: { pending: 0, approved: 0, rejected: 0 },
    leavesByGuardStatus: { pending: 0, approved: 0, rejected: 0 },
    leavesByAdminStatus: { pending: 0, stopped: 0 },
    withDocs: 0,
    activeNow: 0,
    today: 0,
    thisMonth: 0,
    avgDurationDays: 0,
    fullyApproved: 0,
    rejectedAny: 0,
    trend7: [],
    movements: {
      leftToday: { count: 0, items: [] },
      returnedToday: { count: 0, items: [] },
      outsideNow: { count: 0, items: [] },
    },
  });
  const [users, setUsers] = useState([]);
  const [apps, setApps] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [imageToShow, setImageToShow] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorUsers, setErrorUsers] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [errorApps, setErrorApps] = useState("");
  const [loadingConcerns, setLoadingConcerns] = useState(false);
  const [errorConcerns, setErrorConcerns] = useState("");
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editFormUser, setEditFormUser] = useState(null); // holds user being edited
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Search queries for Admin, Warden, Guard (global search for these roles)
  const [adminQuery, setAdminQuery] = useState("");
  const [wardenQuery, setWardenQuery] = useState("");
  const [guardQuery, setGuardQuery] = useState("");
  // Per-batch queries for students (original logic)
  const [batchQueries, setBatchQueries] = useState({});
  // General search for applications
  const [appSearchQuery, setAppSearchQuery] = useState("");

  const [selectedAppSubTab, setSelectedAppSubTab] = useState("all");

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  // Removed 'password' from initial state as per original logic's commented out input
  const [formUser, setFormUser] = useState({
    name: "",
    email: "",
    role: "student",
    batch: "",
    gender: "",
    parents: [],
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);

  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [showAppDetailModal, setShowAppDetailModal] = useState(false);
  const [viewApp, setViewApp] = useState(null);

  const [showStopReasonModal, setShowStopReasonModal] = useState(false);
  const [reasonAppToStop, setReasonAppToStop] = useState(null);
  const [stopReasonInput, setStopReasonInput] = useState("");
  const [stoppingIds, setStoppingIds] = useState(new Set());

  const [showConcernImageModal, setShowConcernImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");

  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUserIds, setDeletingUserIds] = useState(new Set()); // New state for individual user deletion loading
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false); // New state for bulk delete loading

  const [selectedStudents, setSelectedStudents] = useState([]);
  const [userDetails, setUserDetails] = useState(null);
  const token = localStorage.getItem("token");

  // Fetch user details for the logged-in user
  const fetchAdminProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load profile");
      }
      const { user } = await res.json();
      setUserDetails(user);
    } catch (err) {
      console.error("Profile fetch error:", err);
      toast.error(`Profile Error: ${err.message}`);
    }
  }, [token]);

  // Fetch user details for the logged-in user
  useEffect(() => {
    fetchAdminProfile();
  }, [fetchAdminProfile]);

  // Fetch dashboard statistics
  useEffect(() => {
    setLoadingStats(true);
    fetch("/api/admin/stats", { headers: authHeader() })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err.message || "Failed to load stats");
          });
        }
        return r.json();
      })
      .then(setStats)
      .catch((err) => toast.error(`Stats Error: ${err.message}`))
      .finally(() => setLoadingStats(false));
  }, []);

  // Fetch all users
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers("");
    try {
      const res = await fetch("/api/v1/admin/users", { headers: authHeader() });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to load users");
      }
      const { users } = await res.json();
      setUsers(users);
    } catch (err) {
      setErrorUsers(err.message);
      toast.error(`Users Error: ${err.message}`);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch all applications
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    setErrorApps("");
    try {
      const res = await fetch("/api/admin/applications", {
        headers: authHeader(),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to load applications");
      }
      const { leaves } = await res.json();
      setApps(leaves);
    } catch (err) {
      setErrorApps(err.message);
      toast.error(`Applications Error: ${err.message}`);
    } finally {
      setLoadingApps(false);
    }
  }, []);

  // Fetch all concerns
  const loadConcerns = useCallback(async () => {
    setLoadingConcerns(true);
    setErrorConcerns("");
    try {
      const res = await fetch("/api/admin/concerns", { headers: authHeader() });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to load concerns");
      }
      const { concerns } = await res.json();
      setConcerns(concerns);
    } catch (err) {
      setErrorConcerns(err.message);
      toast.error(`Concerns Error: ${err.message}`);
    } finally {
      setLoadingConcerns(false);
    }
  }, []);

  // Effect to load data when tabs change
  useEffect(() => {
    if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "applications") {
      loadApps();
    } else if (activeTab === "concerns") {
      loadConcerns();
    }
  }, [activeTab, loadUsers, loadApps, loadConcerns]);

  const openEditUserModal = (u) => {
    setEditFormUser({
      _id: u._id,
      name: u.name || "",
      email: u.email || "",
      role: u.role || "student",
      batch: u.batch ?? "", // keep input friendly
      gender: u.gender || "",
      parents: Array.isArray(u.parents)
        ? u.parents.map((p) => ({ name: p.name || "", email: p.email || "" }))
        : [],
    });
    setShowEditUserModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditRoleChange = (e) => {
    const role = e.target.value;
    setEditFormUser((prev) => ({
      ...prev,
      role,
      // Clear student-only fields if moving away from student
      batch: role === "student" ? prev.batch : "",
      parents: role === "student" ? prev.parents : [],
      // Gender required for student/warden per schema
      gender: role === "student" || role === "warden" ? prev.gender : "",
    }));
  };

  const addEditParent = () => {
    setEditFormUser((prev) => ({
      ...prev,
      parents: [...(prev.parents || []), { name: "", email: "" }],
    }));
  };

  const handleEditParentChange = (i, field, val) => {
    setEditFormUser((prev) => {
      const ps = [...(prev.parents || [])];
      ps[i] = { ...ps[i], [field]: val };
      return { ...prev, parents: ps };
    });
  };

  const removeEditParent = (i) => {
    setEditFormUser((prev) => ({
      ...prev,
      parents: (prev.parents || []).filter((_, idx) => idx !== i),
    }));
  };

  const submitEditUser = async (e) => {
    e.preventDefault();
    if (!editFormUser?._id) return;

    setSubmittingEdit(true);
    try {
      // Build payload respecting role-based fields
      const payload = {
        name: editFormUser.name,
        email: editFormUser.email,
        role: editFormUser.role,
      };

      if (editFormUser.role === "student") {
        payload.batch =
          editFormUser.batch !== "" ? Number(editFormUser.batch) : null;
        payload.gender = editFormUser.gender;
        payload.parents = (editFormUser.parents || []).filter(
          (p) => p.name && p.email
        );
      } else if (editFormUser.role === "warden") {
        payload.gender = editFormUser.gender; // required by schema
        payload.batch = null; // ensure cleared if present
        payload.parents = []; // ensure cleared if present
      } else {
        payload.batch = null;
        payload.parents = [];
        // gender not required for guard/admin; send only if set
        if (editFormUser.gender) payload.gender = editFormUser.gender;
      }

      const res = await fetch(`/api/admin/users/${editFormUser._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update user");
      }

      toast.success("User updated successfully!");
      setShowEditUserModal(false);
      setEditFormUser(null);
      await loadUsers();
    } catch (err) {
      toast.error(`Update Error: ${err.message}`);
    } finally {
      setSubmittingEdit(false);
    }
  };

  // User logout handler
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // Handlers for User Management
  const handleViewUser = (u) => {
    setViewUser(u);
    setShowUserDetailModal(true);
  };

  const handleDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteUserConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUserIds((prev) => new Set(prev).add(userToDelete._id)); // Add user to deleting state
    try {
      const res = await fetch(`/api/v1/admin/users/${userToDelete._id}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to delete user");
      }
      toast.success("User deleted successfully!");
      await loadUsers();
    } catch (err) {
      toast.error(`Delete User Error: ${err.message}`);
    } finally {
      setShowDeleteUserConfirm(false);
      setUserToDelete(null);
      setDeletingUserIds((prev) => {
        // Remove user from deleting state
        const newState = new Set(prev);
        newState.delete(userToDelete._id);
        return newState;
      });
    }
  };

  // Create User form handlers
  const openCreateUserModal = () => {
    // Password input logic removed to match original code's behavior
    setFormUser({
      name: "",
      email: "",
      role: "student",
      batch: "",
      parents: [],
      gender: "",
    });
    setShowCreateUserModal(true);
  };

  const handleFormChange = (e) => {
    setFormUser({ ...formUser, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setFormUser((prev) => ({
      ...prev,
      role,
      // Clear parents/batch if role changes away from student, as per original logic
      parents: role === "student" ? prev.parents : [],
      batch: role === "student" ? prev.batch : "",
    }));
  };

  const addParent = () => {
    setFormUser((prev) => ({
      ...prev,
      parents: [...prev.parents, { name: "", email: "" }],
    }));
  };

  const handleParentChange = (i, field, val) => {
    const ps = [...formUser.parents];
    ps[i] = { ...ps[i], [field]: val };
    setFormUser((prev) => ({ ...prev, parents: ps }));
  };

  const removeParent = (i) => {
    setFormUser((prev) => ({
      ...prev,
      parents: prev.parents.filter((_, idx) => idx !== i),
    }));
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    setSubmittingUser(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(formUser),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to create user");
      }
      toast.success("User created successfully!");
      setShowCreateUserModal(false);
      await loadUsers();
    } catch (err) {
      toast.error(`Create User Error: ${err.message}`);
    } finally {
      setSubmittingUser(false);
    }
  };

  // Bulk Upload functionality - Restored to original logic for sending data
  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    // Check if XLSX and saveAs are available globally
    if (typeof XLSX === "undefined" || typeof saveAs === "undefined") {
      toast.error(
        "Spreadsheet functionalities are not loaded. Please ensure internet connectivity or refresh the page."
      );
      console.error(
        "XLSX or saveAs is not defined. Ensure CDN scripts are loaded."
      );
      return;
    }

    try {
      setBulkUploadLoading(true);
      const data = await bulkFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const rawRows = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]]
      );

      // Reverting to original logic: mapping "Parent Name" and "Parent Email" to top-level properties
      const rows = rawRows
        .map((row) => {
          const newRow = {};
          if (row.name !== undefined) newRow.name = row.name;
          if (row.email !== undefined) newRow.email = row.email;
          if (row.batch !== undefined) newRow.batch = row.batch;
          if (row.gender !== undefined) newRow.gender = row.gender;
          if (row["Parent Name"] !== undefined)
            newRow.parentName = row["Parent Name"];
          if (row["Parent Email"] !== undefined)
            newRow.parentEmail = row["Parent Email"];
          return newRow;
        })
        .filter((row) => Object.keys(row).length > 0); // Filter out completely empty rows

      // Send parsed and mapped data to original bulk endpoint
      const res = await fetch("/api/v1/admin/students/bulk", {
        // Original endpoint and body structure
        method: "POST",
        headers: {
          ...authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows }), // Backend expects { rows: [...] } with parentName/parentEmail
      });

      const responseData = await res.json();
      if (!res.ok)
        throw new Error(responseData.message || "Bulk upload failed");

      toast.success(`Created ${responseData.createdCount} students`);
      setShowBulkUploadModal(false);
      setBulkFile(null);
      await loadUsers(); // Refresh the user list
    } catch (err) {
      console.error("Bulk upload error:", err);
      toast.error(
        `Bulk Upload Error: ${err.message || "An unexpected error occurred."}`
      );
    } finally {
      setBulkUploadLoading(false);
    }
  };

  // Sample Excel download - matches original headers
  const handleDownloadSampleExcel = () => {
    // Check if XLSX and saveAs are available globally
    if (typeof XLSX === "undefined" || typeof saveAs === "undefined") {
      toast.error(
        "Spreadsheet functionalities are not loaded. Please ensure internet connectivity or refresh the page."
      );
      console.error(
        "XLSX or saveAs is not defined. Ensure CDN scripts are loaded."
      );
      return;
    }

    const sampleData = [
      {
        name: "name",
        email: "email",
        batch: "batch",
        gender: "gender",
        "Parent Name": "Parent Name", // Original header name
        "Parent Email": "Parent Email", // Original header name
      },
      {
        name: "John Doe",
        email: "john@school.com",
        batch: "2023",
        gender: "Male",
        "Parent Name": "Jane Doe",
        "Parent Email": "jane@email.com",
      },
      // Empty rows for user to fill
      {},
      {},
      {},
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { skipHeader: true });
    const colWidths = [
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
      { wch: 30 },
    ];
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students Template");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(data, "student_bulk_upload_template.xlsx");
  };

  // Bulk student selection and deletion handlers
  const handleSelectStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id)
        ? prev.filter((studentId) => studentId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllInBatch = (batch) => {
    const batchStudents = users
      .filter((u) => u.role === "student" && u.batch === batch)
      .map((s) => s._id);

    const allSelected = batchStudents.every((id) =>
      selectedStudents.includes(id)
    );

    setSelectedStudents((prev) =>
      allSelected
        ? prev.filter((id) => !batchStudents.includes(id))
        : [...prev, ...batchStudents.filter((id) => !prev.includes(id))]
    );
  };

  const handleBulkDelete = () => {
    if (selectedStudents.length === 0) {
      toast.error("No students selected for deletion.");
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleting(true); // Set bulk delete loading state
    try {
      const res = await fetch("/api/v1/admin/users/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ ids: selectedStudents }),
      });

      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Bulk deletion failed");
      }

      toast.success(
        `Deleted ${selectedStudents.length} students successfully!`
      );
      setSelectedStudents([]);
      await loadUsers();
    } catch (err) {
      toast.error(`Bulk Delete Error: ${err.message}`);
    } finally {
      setShowBulkDeleteConfirm(false);
      setBulkDeleting(false); // Reset bulk delete loading state
    }
  };

  // Handlers for Application Management
  const handleViewApp = (a) => {
    setViewApp(a);
    setShowAppDetailModal(true);
  };

  // Original handleStopApplication logic - triggers reason modal
  const handleStopApplication = (app) => {
    setReasonAppToStop(app);
    setStopReasonInput("");
    setShowStopReasonModal(true);
  };

  const confirmStopApplication = async () => {
    if (!reasonAppToStop) return;

    setStoppingIds((prev) => new Set(prev).add(reasonAppToStop._id));
    setShowStopReasonModal(false); // Close modal immediately

    try {
      const res = await fetch(
        `/api/admin/applications/${reasonAppToStop._id}`,
        {
          method: "PATCH",
          headers: {
            ...authHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "stop",
            cancellationReason: stopReasonInput, // Send cancellation reason
          }),
        }
      );
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to stop application");
      }
      toast.success(`${reasonAppToStop.student.name}'s application stopped`);
      await loadApps(); // Reload applications after action
    } catch (err) {
      toast.error(`Stop Application Error: ${err.message}`);
    } finally {
      setStoppingIds((prev) => {
        const s = new Set(prev);
        s.delete(reasonAppToStop._id);
        return s;
      });
      setReasonAppToStop(null);
      setStopReasonInput("");
    }
  };

  // Filter applications for display based on sub-tab and search query
  const getFilteredApps = () => {
    let filtered = apps;

    // Filter by sub-tab
    switch (selectedAppSubTab) {
      case "pending":
        // Logic for "pending" application in original code:
        // app.adminStatus?.status || "pending" was checked as part of table display.
        // The "Stop" button was shown if `app.adminStatus?.status === "pending"`.
        // So, a pending admin stop application is one that the admin hasn't acted on.
        // It's reasonable for this tab to show applications that are pending admin approval/action.
        // Based on your original table, the admin `Stop` button was for `app.adminStatus?.status === "pending"`.
        // The original code didn't explicitly filter by parent/warden/guard status for the 'pending' tab,
        // it just showed all with `adminStatus` pending and relied on the "Stop" button.
        // To strictly match, we filter for admin status pending only.
        filtered = filtered.filter(
          (app) => (app.adminStatus?.status || "pending") === "pending"
        );
        break;
      case "active":
        // An active application is one that has been approved by the guard (student has left)
        // and has not yet returned.
        filtered = filtered.filter(
          (app) => app.guardStatus.status === "approved" && !app.returnDateTime
        );
        break;
      case "completed":
        // A completed application is one where the student has returned.
        filtered = filtered.filter((app) => app.returnDateTime);
        break;
      case "all":
      default:
        // No additional filter for 'all'
        break;
    }

    // Filter by search query
    if (appSearchQuery) {
      const lowerCaseQuery = appSearchQuery.toLowerCase();
      filtered = filtered.filter((app) =>
        (app.student?.name || "").toLowerCase().includes(lowerCaseQuery)
      );
    }
    return filtered;
  };

  const currentFilteredApps = getFilteredApps();

  // Define table headers dynamically for applications tab
  const getAppTableHeaders = (subTab) => {
    // Original headers were: "Student", "From", "To", "Status", "Actions", "Return Status"
    // The "Status" column in the original code referred to `app.adminStatus?.status || "pending"`.
    // The "Return Status" column was conditional based on `app.guardStatus.status` and `app.returnDateTime`.

    // To preserve original columns for 'all' and 'pending' sub-tabs
    const baseHeaders = ["Student", "From", "To", "Status", "Actions"];
    if (subTab === "active" || subTab === "completed") {
      // These tabs imply departure, so "Return Status" is relevant
      return [...baseHeaders, "Return Status"];
    }
    return baseHeaders; // For 'all' and 'pending'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-inter">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="relative bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-3xl p-8 shadow-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <User className="h-12 w-12 text-white/90" />
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Welcome, {userDetails?.name || "Warden"}!
            </h2>
            <p className="text-sm text-white/80">
              {userDetails?.email}{" "}
              <span className="font-medium capitalize">
                {userDetails?.gender}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-5 py-2 rounded-full backdrop-blur-md transition"
        >
          <LogOut className="h-5 w-5 text-white" />
          <span className="text-white font-medium">Logout</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mb-8 border-b border-gray-200 pb-4">
        {["stats", "users", "applications", "concerns"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats Tab Content */}
      {activeTab === "stats" && (
        <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Overview Statistics
            </h2>
            <button
              onClick={() => {
                setLoadingStats(true);
                fetch("/api/admin/stats", { headers: authHeader() })
                  .then((r) =>
                    r.ok
                      ? r.json()
                      : r.json().then((e) => {
                          throw new Error(e.message || "Failed");
                        })
                  )
                  .then(setStats)
                  .catch((err) => toast.error(`Stats Error: ${err.message}`))
                  .finally(() => setLoadingStats(false));
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              Refresh
            </button>
          </div>

          {loadingStats ? (
            <p className="text-center text-gray-500 py-8">Loading stats…</p>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPI
                  title="Total Students"
                  value={stats.totalStudents}
                  accent="indigo"
                />
                <KPI
                  title="Total Leaves"
                  value={stats.totalLeaves}
                  accent="green"
                />
                <KPI
                  title="Active Now"
                  value={stats.activeNow}
                  accent="amber"
                />
                <KPI
                  title="Avg Duration (days)"
                  value={stats.avgDurationDays}
                  accent="rose"
                />
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <StatusCard
                  title="Parent Status"
                  data={stats.leavesByParentStatus}
                />
                <StatusCard
                  title="Warden Status"
                  data={stats.leavesByWardenStatus}
                />
                <StatusCard
                  title="Guard Status"
                  data={stats.leavesByGuardStatus}
                />
                <StatusCard
                  title="Admin (stopped)"
                  data={stats.leavesByAdminStatus}
                  labels={{
                    approved: undefined,
                    rejected: undefined,
                    pending: "Pending",
                    stopped: "Stopped",
                  }}
                />
              </div>

              {/* Extras */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <InfoCard title="Leaves Today" value={stats.today} />
                <InfoCard title="This Month" value={stats.thisMonth} />
                <InfoCard title="With Documents" value={stats.withDocs} />
              </div>

              {/* 7-day trend (mini chart) */}
              <div className="mt-8">
                <TrendChart data={stats.trend7} />
              </div>
              {/* Movements Today & Outside Now */}
              <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <MovementList
                  title="Left Today"
                  badge={`${stats.movements?.leftToday?.count ?? 0}`}
                  items={stats.movements?.leftToday?.items ?? []}
                  onView={(app) => {
                    setViewApp(app);
                    setShowAppDetailModal(true);
                  }}
                />
                <MovementList
                  title="Came Inside Today"
                  badge={`${stats.movements?.returnedToday?.count ?? 0}`}
                  items={stats.movements?.returnedToday?.items ?? []}
                  onView={(app) => {
                    setViewApp(app);
                    setShowAppDetailModal(true);
                  }}
                />
                <MovementList
                  title="Still Outside"
                  badge={`${stats.movements?.outsideNow?.count ?? 0}`}
                  items={stats.movements?.outsideNow?.items ?? []}
                  onView={(app) => {
                    setViewApp(app);
                    setShowAppDetailModal(true);
                  }}
                />
              </div>
            </>
          )}
        </section>
      )}

      {/* Users Tab Content */}
      {activeTab === "users" && (
        <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Manage Users
            </h2>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              {selectedStudents.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting} // Disable button during bulk deletion
                  className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {bulkDeleting
                    ? "Deleting..."
                    : `Delete Selected (${selectedStudents.length})`}
                </button>
              )}
              <button
                onClick={openCreateUserModal}
                className="px-5 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-md flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Create User
              </button>
              <DownloadUsersButton users={users} />
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="px-5 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition shadow-md flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Bulk Upload Students
              </button>
            </div>
          </div>

          {loadingUsers && (
            <p className="text-center text-gray-500 py-8">Loading users…</p>
          )}
          {errorUsers && (
            <div className="p-4 text-red-600 bg-red-50 rounded-lg">
              {errorUsers}
            </div>
          )}

          {!loadingUsers && !errorUsers && (
            <>
              {/* Admins */}
              <h3 className="text-xl font-semibold text-gray-800 mt-6 mb-4">
                Admins
              </h3>
              <input
                type="text"
                placeholder="Search admins…"
                value={adminQuery}
                onChange={(e) => setAdminQuery(e.target.value)}
                className="mb-4 w-full sm:w-64 my-4 px-4 py-2 border border-gray-300 rounded-full bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-indigo-400 transition shadow-sm"
              />
              <UserTable
                rows={users.filter((u) => u.role === "admin")}
                onView={handleViewUser}
                onDelete={handleDeleteUser}
                onEdit={openEditUserModal}
                query={adminQuery}
                deletingUserIds={deletingUserIds} // Pass deleting state
              />

              {/* Wardens */}
              <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">
                Wardens
              </h3>
              <input
                type="text"
                placeholder="Search wardens…"
                value={wardenQuery}
                onChange={(e) => setWardenQuery(e.target.value)}
                className="mb-4 w-full sm:w-64 px-4 my-4 py-2 border border-gray-300 rounded-full bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-indigo-400 transition shadow-sm"
              />
              <UserTable
                rows={users.filter((u) => u.role === "warden")}
                onView={handleViewUser}
                onDelete={handleDeleteUser}
                onEdit={openEditUserModal}
                query={wardenQuery}
                deletingUserIds={deletingUserIds} // Pass deleting state
              />
              {/* Guards */}
              <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">
                Guards
              </h3>
              <input
                type="text"
                placeholder="Search guards…"
                value={guardQuery}
                onChange={(e) => setGuardQuery(e.target.value)}
                className="mb-4 w-full sm:w-64 px-4 my-4 py-2 border border-gray-300 rounded-full bg-gray-50
                  focus:outline-none focus:ring-2 focus:ring-indigo-400 transition shadow-sm"
              />
              <UserTable
                rows={users.filter((u) => u.role === "guard")}
                onView={handleViewUser}
                onDelete={handleDeleteUser}
                onEdit={openEditUserModal}
                query={guardQuery}
                deletingUserIds={deletingUserIds} // Pass deleting state
              />

              {/* Students grouped by batch - logic for individual batch queries restored */}
              <h3 className="text-xl font-semibold text-gray-800 mt-8 mb-4">
                Students
              </h3>
              {(() => {
                const students = users.filter((u) => u.role === "student");
                const batches = [
                  ...new Set(students.map((s) => s.batch)),
                ].sort();

                return batches.map((batch) => {
                  const query = batchQueries[batch] || "";
                  const batchStudents = students
                    .filter((s) => s.batch === batch)
                    .filter(
                      (s) =>
                        s.name.toLowerCase().includes(query.toLowerCase()) ||
                        s.email.toLowerCase().includes(query.toLowerCase())
                    );
                  const allStudentsInBatchSelected =
                    batchStudents.length > 0 &&
                    batchStudents.every((s) =>
                      selectedStudents.includes(s._id)
                    );

                  return (
                    <div
                      key={batch}
                      className="mb-8 bg-white rounded-xl shadow-lg p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-700">
                          Batch {batch}
                        </h4>
                        {batchStudents.length > 0 && (
                          <button
                            onClick={() => handleSelectAllInBatch(batch)}
                            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm hover:bg-indigo-200 transition"
                            disabled={bulkDeleting} // Disable select all during bulk delete
                          >
                            {allStudentsInBatchSelected
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={`Search batch ${batch}…`}
                        value={query}
                        onChange={(e) =>
                          setBatchQueries((q) => ({
                            ...q,
                            [batch]: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-full bg-gray-50 mb-4
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 transition shadow-sm"
                      />
                      <div className="rounded-lg border border-gray-200 max-h-[480px] overflow-y-auto overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                                <input
                                  type="checkbox"
                                  checked={allStudentsInBatchSelected}
                                  onChange={() => handleSelectAllInBatch(batch)}
                                  className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out rounded border-gray-300"
                                  disabled={bulkDeleting} // Disable checkbox during bulk delete
                                />
                              </th>
                              {["Name", "Email", "Actions"].map((col) => (
                                <th
                                  key={col}
                                  className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {batchStudents.length === 0 ? (
                              <tr>
                                <td
                                  colSpan="4"
                                  className="text-center py-4 text-gray-500"
                                >
                                  No students found in this batch matching your
                                  search.
                                </td>
                              </tr>
                            ) : (
                              batchStudents.map((u) => (
                                <tr key={u._id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedStudents.includes(u._id)}
                                      onChange={() =>
                                        handleSelectStudent(u._id)
                                      }
                                      className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out rounded border-gray-300"
                                      disabled={
                                        deletingUserIds.has(u._id) ||
                                        bulkDeleting
                                      } // Disable checkbox when deleting
                                    />
                                  </td>
                                  <td className="px-6 py-4 text-gray-800 font-medium">
                                    {u?.name}
                                  </td>
                                  <td className="px-6 py-4 text-gray-600">
                                    {u.email}
                                  </td>
                                  <td className="px-6 py-4 space-x-3">
                                    <button
                                      onClick={() => handleViewUser(u)}
                                      className="text-indigo-600 hover:underline text-sm"
                                      disabled={
                                        deletingUserIds.has(u._id) ||
                                        bulkDeleting
                                      } // Disable view button when deleting
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => openEditUserModal(u)}
                                      className="text-blue-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={
                                        deletingUserIds.has(u._id) ||
                                        bulkDeleting
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u)}
                                      className="text-red-600 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                      disabled={
                                        deletingUserIds.has(u._id) ||
                                        bulkDeleting
                                      } // Disable delete button when deleting
                                    >
                                      {deletingUserIds.has(u._id)
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                });
              })()}
            </>
          )}
        </section>
      )}

      {/* Applications Tab Content */}
      {activeTab === "applications" && (
        <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
          <DownloadApplicationsButton applications={apps} />
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Leave Applications
          </h2>
          {/* Application Sub-Tabs */}
          <div className="flex flex-wrap gap-3 mb-6 border-b border-gray-200 pb-4">
            {["all", "pending", "active", "completed"].map((subTab) => (
              <button
                key={subTab}
                onClick={() => setSelectedAppSubTab(subTab)}
                className={`px-6 py-2 rounded-full font-medium transition ${
                  selectedAppSubTab === subTab
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {subTab === "pending"
                  ? "Pending Admin Stop"
                  : subTab.charAt(0).toUpperCase() + subTab.slice(1)}
              </button>
            ))}
          </div>

          {/* Search Bar for Applications */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search applications by student name..."
              value={appSearchQuery}
              onChange={(e) => setAppSearchQuery(e.target.value)}
              className="w-full px-5 py-3 border border-gray-300 rounded-full shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          {loadingApps && (
            <p className="text-center text-gray-500 py-8">
              Loading applications…
            </p>
          )}
          {errorApps && (
            <div className="p-4 text-red-600 bg-red-50 rounded-lg">
              {errorApps}
            </div>
          )}

          {!loadingApps && !errorApps && (
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {getAppTableHeaders(selectedAppSubTab).map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentFilteredApps.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getAppTableHeaders(selectedAppSubTab).length}
                        className="text-center py-8 text-gray-500"
                      >
                        No applications found in this category.
                      </td>
                    </tr>
                  ) : (
                    currentFilteredApps.map((app) => (
                      <tr
                        key={app._id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleViewApp(app)}
                      >
                        <td className="px-6 py-4 text-gray-800 font-medium">
                          {app.student && app.student.name
                            ? app.student.name
                            : "Deleted Student"}
                        </td>

                        <td className="px-6 py-4 text-gray-600">
                          {formatDateTime(app.startDate)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {formatDateTime(app.endDate)}
                        </td>
                        <td className="px-6 py-4 capitalize">
                          {app.adminStatus?.status || "pending"}{" "}
                          {/* "Status" column from original code */}
                        </td>
                        <td className="px-6 py-4 space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent modal from opening twice
                              handleViewApp(app);
                            }}
                            className="text-indigo-600 hover:underline text-sm"
                            disabled={stoppingIds.has(app._id)} // Disable view button when stopping
                          >
                            View
                          </button>
                          {(app.adminStatus?.status || "pending") ===
                            "pending" && ( // Only show "Stop" button if admin status is pending
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent modal from opening twice
                                handleStopApplication(app);
                              }}
                              disabled={stoppingIds.has(app._id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {stoppingIds.has(app._id) ? "Stopping…" : "Stop"}
                            </button>
                          )}
                        </td>
                        {(selectedAppSubTab === "active" ||
                          selectedAppSubTab === "completed") && (
                          <td className="px-6 py-4 text-gray-600">
                            {app.guardStatus.status !== "approved"
                              ? "Didn't leave college"
                              : app.returnDateTime
                              ? formatDateTime(app.returnDateTime)
                              : "Not returned"}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Concerns Tab Content */}
      {activeTab === "concerns" && (
        <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Guard Concerns
          </h2>
          {loadingConcerns ? (
            <p className="text-center text-gray-500 py-8">Loading concerns…</p>
          ) : errorConcerns ? (
            <p className="p-4 text-red-600 bg-red-50 rounded-lg">
              {errorConcerns}
            </p>
          ) : concerns.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No concerns submitted.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {["Time", "Student", "Batch", "Description", "Image"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {concerns.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (c.documentUrl) {
                          setModalImageUrl(`/api/drive/${c.documentUrl}`);
                          setShowConcernImageModal(true);
                        } else {
                          toast("No image provided for this concern.");
                        }
                      }}
                    >
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDateTime(c.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-gray-800 font-medium">
                        {c.studentName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{c.batch}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                        {c.description}
                      </td>
                      <td className="px-6 py-4">
                        {c.documentUrl ? (
                          <img
                            src={`/api/drive/${c.documentUrl}`}
                            alt="Concern"
                            className="h-16 w-16 object-cover rounded-lg shadow-sm hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowCreateUserModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl max-h-[90vh] overflow-auto no-scrollbar w-full max-w-lg p-8 relative transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCreateUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={submittingUser} // Disable close button when submitting
            >
              &times;
            </button>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Create New User
            </h3>
            <form className="space-y-6" onSubmit={handleCreateUserSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={formUser?.name}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingUser} // Disable input when submitting
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formUser.email}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingUser} // Disable input when submitting
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formUser.role}
                    onChange={handleRoleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingUser} // Disable select when submitting
                  >
                    <option value="admin">Admin</option>
                    <option value="warden">Warden</option>
                    <option value="guard">Guard</option>
                    <option value="student">Student</option>
                  </select>
                </div>
                {/* Password input section removed to match original code's behavior */}
                {formUser.role === "student" && (
                  <div>
                    <div>
                      <label
                        htmlFor="batch"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Batch
                      </label>
                      <input
                        id="batch"
                        name="batch"
                        type="number"
                        value={formUser.batch}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        placeholder="e.g. 2023"
                        disabled={submittingUser} // Disable input when submitting
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gender"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Gender
                      </label>
                      {/* insert here */}{" "}
                      <select
                        id="gender"
                        name="gender"
                        value={formUser.gender}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                        disabled={submittingUser} // Disable select when submitting
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {formUser.role === "warden" && (
                <div>
                  <label
                    htmlFor="gender"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Gender
                  </label>
                  {/* insert here */}{" "}
                  <select
                    id="gender"
                    name="gender"
                    value={formUser.gender}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingUser} // Disable select when submitting
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              )}

              {formUser.role === "student" && (
                <div className="space-y-4">
                  <p className="font-medium text-gray-800">Parent(s)</p>
                  {formUser.parents.map((p, i) => (
                    <div
                      key={i}
                      className="relative bg-gray-100 border border-gray-200 rounded-lg p-4 space-y-4 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => removeParent(i)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl"
                        disabled={submittingUser} // Disable button when submitting
                      >
                        &times;
                      </button>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Parent Name
                        </label>
                        <input
                          placeholder="Name"
                          value={p.name}
                          onChange={(e) =>
                            handleParentChange(i, "name", e.target.value)
                          }
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          disabled={submittingUser} // Disable input when submitting
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Parent Email
                        </label>
                        <input
                          placeholder="Email"
                          value={p.email}
                          onChange={(e) =>
                            handleParentChange(i, "email", e.target.value)
                          }
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          disabled={submittingUser} // Disable input when submitting
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addParent}
                    className="text-indigo-600 hover:underline text-sm font-medium flex items-center gap-1"
                    disabled={submittingUser} // Disable button when submitting
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Add Parent
                  </button>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-6 py-2 rounded-full bg-gray-200 hover:bg-gray-300 transition shadow-md"
                  disabled={submittingUser} // Disable button when submitting
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-6 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                  {submittingUser ? "Creating…" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editFormUser && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50"
          onClick={() => !submittingEdit && setShowEditUserModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl max-h-[90vh] overflow-auto no-scrollbar w-full max-w-lg p-8 relative transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowEditUserModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={submittingEdit}
            >
              &times;
            </button>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Edit User
            </h3>

            <form className="space-y-6" onSubmit={submitEditUser}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    value={editFormUser.name}
                    onChange={handleEditFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingEdit}
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={editFormUser.email}
                    onChange={handleEditFormChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingEdit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="edit-role"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="edit-role"
                    name="role"
                    value={editFormUser.role}
                    onChange={handleEditRoleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    disabled={submittingEdit}
                  >
                    <option value="admin">Admin</option>
                    <option value="warden">Warden</option>
                    <option value="guard">Guard</option>
                    <option value="student">Student</option>
                  </select>
                </div>

                {(editFormUser.role === "student" ||
                  editFormUser.role === "warden") && (
                  <div>
                    <label
                      htmlFor="edit-gender"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Gender
                    </label>
                    <select
                      id="edit-gender"
                      name="gender"
                      value={editFormUser.gender}
                      onChange={handleEditFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      disabled={submittingEdit}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                )}
              </div>

              {editFormUser.role === "student" && (
                <>
                  <div>
                    <label
                      htmlFor="edit-batch"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Batch
                    </label>
                    <input
                      id="edit-batch"
                      name="batch"
                      type="number"
                      value={editFormUser.batch}
                      onChange={handleEditFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                      placeholder="e.g. 2023"
                      disabled={submittingEdit}
                    />
                  </div>

                  <div className="space-y-4 mt-2">
                    <p className="font-medium text-gray-800">Parent(s)</p>
                    {(editFormUser.parents || []).map((p, i) => (
                      <div
                        key={i}
                        className="relative bg-gray-100 border border-gray-200 rounded-lg p-4 space-y-4 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => removeEditParent(i)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xl"
                          disabled={submittingEdit}
                        >
                          &times;
                        </button>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Parent Name
                          </label>
                          <input
                            placeholder="Name"
                            value={p.name}
                            onChange={(e) =>
                              handleEditParentChange(i, "name", e.target.value)
                            }
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            disabled={submittingEdit}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Parent Email
                          </label>
                          <input
                            placeholder="Email"
                            type="email"
                            value={p.email}
                            onChange={(e) =>
                              handleEditParentChange(i, "email", e.target.value)
                            }
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                            disabled={submittingEdit}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addEditParent}
                      className="text-indigo-600 hover:underline text-sm font-medium flex items-center gap-1"
                      disabled={submittingEdit}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Add Parent
                    </button>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-6 py-2 rounded-full bg-gray-200 hover:bg-gray-300 transition shadow-md"
                  disabled={submittingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-6 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                  {submittingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetailModal && viewUser && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowUserDetailModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-lg w-full max-w-md p-8 relative transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUserDetailModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              User Details
            </h3>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>Name:</strong>{" "}
                <span className="font-medium text-gray-900">
                  {viewUser.name}
                </span>
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <span className="font-medium text-gray-900">
                  {viewUser.email}
                </span>
              </p>
              <p>
                <strong>Role:</strong>{" "}
                <span className="font-medium text-gray-900 capitalize">
                  {viewUser.role}
                </span>
              </p>
              {viewUser.gender && (
                <p>
                  <strong>Gender:</strong>{" "}
                  <span className="font-medium text-gray-900">
                    {viewUser.gender}
                  </span>
                </p>
              )}
              {viewUser.batch && (
                <p>
                  <strong>Batch:</strong>{" "}
                  <span className="font-medium text-gray-900">
                    {viewUser.batch}
                  </span>
                </p>
              )}
              {viewUser.parents && viewUser.parents.length > 0 && (
                <div>
                  <p className="font-medium text-gray-900 mb-2">Parent(s):</p>
                  <ul className="list-disc list-inside space-y-2">
                    {viewUser.parents.map((p, i) => (
                      <li key={i} className="text-gray-700">
                        <span className="font-medium">{p.name}</span> &lt;
                        <a
                          href={`mailto:${p.email}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {p.email}
                        </a>
                        &gt;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowUserDetailModal(false)}
              className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowBulkUploadModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-lg w-full max-w-md p-8 relative transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowBulkUploadModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={bulkUploadLoading} // Disable close button when uploading
            >
              &times;
            </button>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Bulk Upload Students
            </h3>

            <button
              onClick={handleDownloadSampleExcel}
              className="w-full mb-6 px-4 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 flex items-center justify-center transition shadow-md"
              disabled={bulkUploadLoading} // Disable download button when uploading
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Download Template (.xlsx)
            </button>
            <div className="mb-6">
              <label
                htmlFor="bulk-file-upload"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Upload Student Data File (CSV or XLSX)
              </label>
              <input
                id="bulk-file-upload"
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={(e) => setBulkFile(e.target.files[0])}
                className="w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={bulkUploadLoading} // Disable file input when uploading
              />
              <p className="text-xs text-gray-500 mt-2">
                Accepted columns: "name", "email", "batch", "Parent Name",
                "gender", "Parent Email"
              </p>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition shadow-md"
                disabled={bulkUploadLoading} // Disable cancel button when uploading
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={bulkUploadLoading || !bulkFile}
                className="px-5 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition shadow-md disabled:bg-green-300 disabled:cursor-not-allowed"
              >
                {bulkUploadLoading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {showAppDetailModal && viewApp && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowAppDetailModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-lg max-h-[80vh] no-scrollbar w-full max-w-lg p-8 relative transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAppDetailModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Application Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Student</p>
                <p className="text-gray-900 font-medium">
                  {viewApp.student.name}
                  <br />
                  <a
                    href={`mailto:${viewApp.student.email}`}
                    className="text-indigo-600 underline hover:text-indigo-800 transition"
                  >
                    {viewApp.student.email}
                  </a>
                  <p className="py-2">Batch-{viewApp.student.batch}</p>
                  <p className="py-2">Gender-{viewApp.student.gender}</p>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">
                  Parent(s)
                </p>
                {viewApp.student.parents?.length ? (
                  <ul className="space-y-2 text-gray-900">
                    {viewApp.student.parents.map((p, i) => (
                      <li key={i}>
                        <span className="font-medium">{p.name}</span>
                        <br />
                        <a
                          href={`mailto:${p.email}`}
                          className="text-indigo-600 underline hover:text-indigo-800 transition"
                        >
                          {p.email}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic text-gray-500">None on record</p>
                )}
              </div>
            </div>

            <hr className="border-gray-200 mb-6" />

            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase mb-2">
                Departure & Return
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-gray-600 text-sm">Departure Date</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(viewApp.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">Return Due Date</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(viewApp.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">
                    Actual Departure Time (Guard)
                  </dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(viewApp.guardStatus.decidedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">Actual Return Time</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(viewApp.returnDateTime)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-600 text-sm">Reason for Leave</dt>
                  <dd className="text-gray-900 font-medium">
                    {viewApp.reason}
                  </dd>
                </div>
                {viewApp.documentUrl && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-600 text-sm">
                      Supporting Document
                    </dt>
                    {viewApp.documentUrl ? (
                      <img
                        src={`/api/drive/${viewApp.documentUrl}`}
                        alt="Supporting Document"
                        className="rounded-2xl cursor-pointer object-cover w-40 h-40 hover:opacity-90 transition"
                        onClick={() => {
                          setImageToShow(`/api/drive/${viewApp.documentUrl}`);
                          setShowImageModal(true);
                        }}
                      />
                    ) : (
                      <p className="italic text-gray-400">
                        No document provided
                      </p>
                    )}
                  </div>
                )}
              </dl>
            </div>

            <hr className="border-gray-200 mb-6" />

            <div className="space-y-4 mb-6">
              <p className="text-xs text-gray-500 uppercase mb-2">
                Approval Status Timeline
              </p>
              {[
                ["Parent", viewApp.parentStatus],
                ["Warden", viewApp.wardenStatus],
                ["Guard", viewApp.guardStatus],
                ["Admin", viewApp.adminStatus ?? { status: "pending" }],
              ].map(([label, st]) => (
                <div key={label} className="flex justify-between items-start">
                  <span className="text-gray-700 font-medium">{label}:</span>
                  <div className="flex flex-col items-end">
                    {label === "Admin" && st.status !== "stopped" ? (
                      <span className="italic text-gray-500 text-sm">
                        No interference
                      </span>
                    ) : (
                      <StatusPill status={st?.status} />
                    )}
                    {label === "Parent" && st.status !== "pending" && (
                      <span className="mt-1 text-[10px] text-gray-500">
                        Parent responded via: {st.isDoneFromWebsite ? "Website" : "App"}
                      </span>
                    )}
                    {st.decidedAt && (
                      <p className="mt-1 text-[10px] text-gray-500">
                        {formatDateTime(st.decidedAt)}
                        {st.reason &&
                        (st.status === "rejected" ||
                          st.status === "stopped") ? (
                          <span className="ml-1"> (Reason: {st.reason})</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAppDetailModal(false)}
              className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Stop Application Reason Modal */}
      {showStopReasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
          onClick={() => setShowStopReasonModal(false)}
        >
          <div
            className="relative bg-white rounded-3xl shadow-lg w-full max-w-md p-8 transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowStopReasonModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={stoppingIds.has(reasonAppToStop?._id)} // Disable close button when stopping
            >
              &times;
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Provide Cancellation Reason (Optional)
            </h2>
            <div className="mb-6">
              <label
                htmlFor="stopReason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for Cancellation:
              </label>
              <textarea
                id="stopReason"
                name="stopReason"
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-y"
                placeholder="e.g., Student has pending dues, specific disciplinary issue, etc."
                value={stopReasonInput}
                onChange={(e) => setStopReasonInput(e.target.value)}
                disabled={stoppingIds.has(reasonAppToStop?._id)} // Disable textarea when stopping
              ></textarea>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowStopReasonModal(false)}
                className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition shadow-md"
                disabled={stoppingIds.has(reasonAppToStop?._id)} // Disable cancel button when stopping
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStopApplication}
                className="px-5 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={stoppingIds.has(reasonAppToStop?._id)} // Disable confirm button when stopping
              >
                {stoppingIds.has(reasonAppToStop?._id)
                  ? "Stopping..."
                  : "Confirm Stop Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Concern Image Modal */}
      {showConcernImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
          onClick={() => setShowConcernImageModal(false)}
        >
          <div className="relative">
            <img
              src={modalImageUrl}
              alt="Concern Detail"
              className="max-h-[90vh] max-w-full object-contain rounded-lg shadow-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowConcernImageModal(false)}
              className="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-80 transition"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* User Delete Confirmation Modal */}
      {showDeleteUserConfirm && (
        <ConfirmationModal
          message={`Are you sure you want to delete user "${userToDelete?.name}"? This action cannot be undone.`}
          onConfirm={confirmDeleteUser}
          onCancel={() => setShowDeleteUserConfirm(false)}
          confirmText="Delete User"
          isLoading={deletingUserIds.has(userToDelete?._id)} // Pass loading state to modal
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <ConfirmationModal
          message={`Are you sure you want to delete ${selectedStudents.length} selected students? This action cannot be undone.`}
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
          confirmText={`Delete ${selectedStudents.length} Students`}
          isLoading={bulkDeleting} // Pass loading state to modal
        />
      )}
      {showImageModal && imageToShow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative w-full max-w-3xl p-4">
            <img
              src={imageToShow}
              alt="Full Document"
              className="rounded-2xl shadow-lg max-h-[80vh] w-full object-contain"
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white text-3xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
