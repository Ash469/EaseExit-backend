import { LogOut, User } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// Reusable badge component for status display
function StatusBadge({ status }) {
  const styles = {
    pending: "bg-indigo-100 text-indigo-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    stopped: "bg-gray-200 text-gray-700",
  };
  return (
    <span
      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
        styles[status] || styles.pending
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Function to format date and time for consistent display
const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A"; // Display 'N/A' if date is null or undefined

export default function App() {
  // Changed to App for direct rendering in Canvas
  // State variables for application data and UI control
  const [allApplications, setAllApplications] = useState([]); // Master list of all applications fetched
  const [loading, setLoading] = useState(true); // Loading indicator for data fetch
  const [error, setError] = useState(""); // Error message display
  const [selectedApp, setSelectedApp] = useState(null); // Currently selected application for detail modal
  const [activeTab, setActiveTab] = useState("pending"); // Controls which tab is active: 'pending', 'departed', 'returned', 'all'
  const [searchQuery, setSearchQuery] = useState(""); // Input for searching applications by student name
  // inside function App() { … }

  const [studentsList, setStudentsList] = useState([]);
  const batchOptions = Array.from(
    new Set(studentsList.map((s) => s.batch))
  ).sort();

  // State variables for the concern registration modal
  const [showConcernModal, setShowConcernModal] = useState(false);
  const [concernForm, setConcernForm] = useState({
    studentId: "",
    studentName: "",
    batch: "",
    description: "",
    image: null, // For image file upload
  });
  const [submittingConcern, setSubmittingConcern] = useState(false); // Submitting state for concern form

  // State variables for the rejection reason modal
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentRejectingAppId, setCurrentRejectingAppId] = useState(null); // ID of the application being rejected
  const [rejectionReasonInput, setRejectionReasonInput] = useState(""); // Input for rejection reason
  const [guardProfile, setGuardProfile] = useState(null); // Guard profile data

  // New loading states for specific actions
  const [approvingAppIds, setApprovingAppIds] = useState(new Set());
  const [rejectingAppIds, setRejectingAppIds] = useState(new Set());
  const [markingReturnAppIds, setMarkingReturnAppIds] = useState(new Set());

  const navigate = useNavigate(); // Hook for navigation (e.g., logout)
  const token = localStorage.getItem("token"); // Auth token from local storage
  const fetchGuardProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/guard/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load profile");
      }
      const { user } = await res.json();
      setGuardProfile(user);
    } catch (err) {
      console.error("Profile fetch error:", err);
      toast.error(`Profile Error: ${err.message}`);
    }
  }, [token]);
  // useCallback to memoize the fetchApplications function to prevent unnecessary re-renders
  // This function fetches all applications relevant to the guard from the backend.
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // NOTE: This assumes an API endpoint like "/api/guard/applications?status=all" exists
      // and returns all applications relevant to the guard role.
      // If your backend requires different endpoints for 'pending', 'departed', 'returned', or 'all',
      // please adjust this fetch URL accordingly or implement multiple fetch calls.
      const res = await fetch("/api/guard/applications?status=all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to load applications.");
      }

      const data = await res.json();
      setAllApplications(data.leaves || []); // Assuming response contains a 'leaves' array
    } catch (err) {
      console.error("Error fetching applications:", err);
      setError(`Applications Error: ${err.message}`);
      toast.error(`Failed to load applications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]); // Dependency array: re-run if token changes

  // useEffect hook to fetch applications when the component mounts or fetchApplications changes
  useEffect(() => {
    fetchApplications();
    fetchGuardProfile(); // Fetch guard profile data on mount
  }, [fetchApplications, fetchGuardProfile]);

  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await fetch("/api/guard/allstudents", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to load students");
        }
        const { students } = await res.json();
        setStudentsList(students);
      } catch (e) {
        console.error(e);
        toast.error(`Student List Error: ${e.message}`);
      }
    }
    loadStudents();
  }, [token]);

  // Handler for user logout
  const handleLogout = () => {
    localStorage.clear(); // Clear all items from local storage (including token)
    navigate("/login"); // Redirect to login page
  };

  // Handler for guard's decision (approve/reject) on a departure application
  const handleDepartureDecision = async (
    id,
    decision,
    rejectionReason = ""
  ) => {
    if (decision === "approved") {
      setApprovingAppIds((prev) => new Set(prev).add(id));
    } else {
      setRejectingAppIds((prev) => new Set(prev).add(id));
    }

    try {
      const res = await fetch(`/api/guard/applications/${id}`, {
        method: "PATCH", // Use PATCH for partial updates
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, rejectionReason }), // Send decision and reason
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Decision failed");
      }
      await fetchApplications(); // Re-fetch all data to update the UI across tabs
      toast.success(
        decision === "approved"
          ? "Exit approved ✅ Student has left campus"
          : "Exit denied ❌ Student remains inside"
      );
      closeReasonModal(); // Close the reason input modal if it was open
    } catch (err) {
      console.error("Error updating decision:", err);
      toast.error(`Decision Error: ${err.message}`);
    } finally {
      if (decision === "approved") {
        setApprovingAppIds((prev) => {
          const newState = new Set(prev);
          newState.delete(id);
          return newState;
        });
      } else {
        setRejectingAppIds((prev) => {
          const newState = new Set(prev);
          newState.delete(id);
          return newState;
        });
      }
    }
  };

  // Handler to mark a student as returned to campus
  const handleMarkReturn = async (e, id) => {
    e.stopPropagation(); // Prevent row click from opening detail modal
    setMarkingReturnAppIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/guard/applications/${id}/return`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to mark return");
      }
      await fetchApplications(); // Re-fetch all data to update the UI
      toast.success("Student marked as returned to campus ✅");
      closeModal(); // Close the detail modal after marking return
    } catch (err) {
      console.error("Error marking return:", err);
      toast.error(`Mark Return Error: ${err.message}`);
    } finally {
      setMarkingReturnAppIds((prev) => {
        const newState = new Set(prev);
        newState.delete(id);
        return newState;
      });
    }
  };

  // Handler for changes in the concern registration form inputs
  // in your change-handler:
  const handleConcernChange = (e) => {
    const { name, value } = e.target;
    setConcernForm((f) => ({
      ...f,
      [name]: name === "batch" ? parseInt(value, 10) : value,
    }));
  };

  // Handler for file input in the concern registration form
  const handleConcernFile = (e) => {
    setConcernForm((f) => ({ ...f, image: e.target.files[0] }));
  };

  // Handler for submitting the concern registration form
  const submitConcern = async (e) => {
    e.preventDefault();
    setSubmittingConcern(true);
    try {
      const formData = new FormData(); // Use FormData for file uploads
      formData.append("studentName", concernForm.studentName);
      formData.append("studentId", concernForm.studentId);
      formData.append("batch", concernForm.batch);
      formData.append("description", concernForm.description);
      if (concernForm.image) formData.append("document", concernForm.image);

      const res = await fetch("/api/guard/concerns", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // Content-Type is set automatically for FormData
        body: formData,
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || "Failed to register concern");
      }
      toast.success("Concern submitted & parents notified!");
      setShowConcernModal(false); // Close the modal
      // Reset the form
      setConcernForm({
        studentName: "",
        batch: "",
        description: "",
        image: null,
      });
      await fetchApplications(); // Re-fetch to update any lists affected by new concerns (if applicable)
    } catch (err) {
      console.error("Error submitting concern:", err);
      toast.error(`Concern Submission Error: ${err.message}`);
    } finally {
      setSubmittingConcern(false);
    }
  };

  // Functions to control the detail modal
  const openModal = (app) => setSelectedApp(app);
  const closeModal = () => setSelectedApp(null);

  // Functions to control the rejection reason modal
  const openReasonModal = (e, appId) => {
    e.stopPropagation(); // Prevent row click from opening detail modal
    setCurrentRejectingAppId(appId);
    setRejectionReasonInput(""); // Clear previous reason
    setShowReasonModal(true);
  };
  const closeReasonModal = () => {
    setShowReasonModal(false);
    setCurrentRejectingAppId(null);
    setRejectionReasonInput("");
  };
  const confirmReject = () => {
    if (currentRejectingAppId) {
      handleDepartureDecision(
        currentRejectingAppId,
        "rejected",
        rejectionReasonInput
      );
    }
  };

  // Derived state: Filter applications based on active tab and search query
  const getFilteredApplications = () => {
    let applicationsToFilter = [];

    // First, filter by active tab
    switch (activeTab) {
      case "pending":
        applicationsToFilter = allApplications.filter(
          (app) => app.guardStatus.status === "pending"
        );
        break;
      case "departed":
        applicationsToFilter = allApplications.filter(
          (app) => app.guardStatus.status === "approved" && !app.returnDateTime
        );
        break;
      case "returned":
        applicationsToFilter = allApplications.filter(
          (app) => app.guardStatus.status === "approved" && app.returnDateTime
        );
        break;
      case "all":
      default:
        applicationsToFilter = allApplications; // Show all fetched applications
        break;
    }

    // Then, filter by search query (student name)
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      applicationsToFilter = applicationsToFilter.filter((app) =>
        app.student.name.toLowerCase().includes(lowerCaseQuery)
      );
    }

    return applicationsToFilter;
  };

  const currentApplications = getFilteredApplications(); // Get the filtered list for display

  // Define table headers dynamically based on the active tab
  const getTableHeaders = (tab) => {
    if (tab === "departed") {
      return [
        "ID",
        "Student",
        "Dates",
        "Departure Time",
        "Reason",
        "Actions", // Actions for 'Mark Returned'
      ];
    } else if (tab === "returned") {
      return [
        "ID",
        "Student",
        "Dates",
        "Departure Time",
        "Return Time",
        "Reason",
      ];
    } else {
      // 'pending' and 'all' tabs will have these headers
      return [
        "ID",
        "Student",
        "Dates",
        "Reason",
        "Parent",
        "Warden",
        "Guard",
        "Admin",
        "Actions", // Actions for 'Allow Exit' / 'Deny Exit'
      ];
    }
  };

  // Display loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading applications…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-inter">
      {/* Toaster for displaying notifications */}
      <Toaster position="top-right" />

      {/* Header section with title and action buttons */}
      <header className="relative bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-3xl p-8 shadow-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <User className="h-12 w-12 text-white/90" />
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Welcome, {guardProfile?.name || "Warden"}!
            </h2>
            <p className="text-sm text-white/80">
              {guardProfile?.email}{" "}
              {/* <span className="font-medium capitalize">{guardProfile?.gender}</span> */}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowConcernModal(true)}
            className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-5 py-2 rounded-full backdrop-blur-md transition"
          >
            Register Concern
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 bg-white bg-opacity-20 hover:bg-opacity-30 px-5 py-2 rounded-full backdrop-blur-md transition"
          >
            <LogOut className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Logout</span>
          </button>
        </div>
      </header>

      {/* Error message display */}
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Main content section: Tabs and Application Table */}
      <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
        {/* Tab navigation buttons */}
        <div className="flex flex-wrap gap-3 mb-6 border-b border-gray-200 pb-4">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === "pending"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Pending Departures
          </button>
          <button
            onClick={() => setActiveTab("departed")}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === "departed"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Guard Approved (Awaiting Return)
          </button>
          <button
            onClick={() => setActiveTab("returned")}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === "returned"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Returned / Completed
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-2 rounded-full font-medium transition ${
              activeTab === "all"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Applications
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by student name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3 border border-gray-300 rounded-full shadow-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
        </div>

        {/* Display applications based on active tab and search query */}
        {currentApplications.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No applications found for this category or search.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {/* Render table headers based on active tab */}
                  {getTableHeaders(activeTab).map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentApplications.map((app) => (
                  <tr
                    key={app._id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => openModal(app)} // Open detail modal on row click
                  >
                    <td className="px-6 py-4 text-gray-600">
                      {app._id.slice(-6)} {/* Display last 6 chars of ID */}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {app.student.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatDateTime(app.startDate)} →{" "}
                      {formatDateTime(app.endDate)}
                    </td>
                    {/* Conditional rendering for columns based on active tab */}
                    {activeTab === "departed" || activeTab === "returned" ? (
                      <>
                        {/* Departure Time column for 'departed' and 'returned' tabs */}
                        <td className="px-6 py-4 text-gray-600">
                          {formatDateTime(app.guardStatus.decidedAt)}
                        </td>
                        {/* Return Time column only for 'returned' tab */}
                        {activeTab === "returned" && (
                          <td className="px-6 py-4 text-gray-600">
                            {formatDateTime(app.returnDateTime)}
                          </td>
                        )}
                        <td className="px-6 py-4 text-gray-600">
                          {app.reason}
                        </td>
                        {/* Actions column only for 'departed' tab */}
                        {activeTab === "departed" && (
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => handleMarkReturn(e, app._id)}
                              disabled={markingReturnAppIds.has(app._id)} // Disable button when marking return
                              className="px-4 py-2 rounded-lg text-white text-sm bg-blue-600 hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {markingReturnAppIds.has(app._id)
                                ? "Marking..."
                                : "Mark Returned"}
                            </button>
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Columns for 'pending' and 'all' tabs */}
                        <td className="px-6 py-4 text-gray-600">
                          {app.reason}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={app.parentStatus.status} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={app.wardenStatus.status} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={app.guardStatus.status} />
                        </td>
                        <td className="px-6 py-4">
                          {app.adminStatus.status === "stopped" ? (
                            <StatusBadge status="stopped" />
                          ) : (
                            <span className="italic text-gray-500">
                              No interference
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 flex space-x-2">
                          {/* Allow Exit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDepartureDecision(app._id, "approved");
                            }}
                            // Button disabled if not pending guard decision or stopped by admin or already processing
                            disabled={
                              app.guardStatus.status !== "pending" ||
                              app.adminStatus.status === "stopped" ||
                              approvingAppIds.has(app._id) ||
                              rejectingAppIds.has(app._id)
                            }
                            className={`flex-1 py-1 rounded-lg text-sm font-medium text-white shadow-md ${
                              app.guardStatus.status !== "pending" ||
                              app.adminStatus.status === "stopped" ||
                              approvingAppIds.has(app._id) ||
                              rejectingAppIds.has(app._id)
                                ? "bg-green-300 cursor-not-allowed"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {approvingAppIds.has(app._id)
                              ? "Approving..."
                              : "Allow Exit"}
                          </button>
                          {/* Deny Exit button */}
                          <button
                            onClick={(e) => openReasonModal(e, app._id)}
                            // Button disabled if not pending guard decision or stopped by admin or already processing
                            disabled={
                              app.guardStatus.status !== "pending" ||
                              app.adminStatus.status === "stopped" ||
                              approvingAppIds.has(app._id) ||
                              rejectingAppIds.has(app._id)
                            }
                            className={`flex-1 py-1 rounded-lg text-sm font-medium text-white shadow-md ${
                              app.guardStatus.status !== "pending" ||
                              app.adminStatus.status === "stopped" ||
                              approvingAppIds.has(app._id) ||
                              rejectingAppIds.has(app._id)
                                ? "bg-red-300 cursor-not-allowed"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                          >
                            {rejectingAppIds.has(app._id)
                              ? "Denying..."
                              : "Deny Exit"}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Details Modal */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
          onClick={closeModal} // Close modal when clicking outside
        >
          <div
            className="relative bg-white rounded-3xl max-h-[90vh] overflow-auto no-scrollbar shadow-lg w-full max-w-lg p-8 transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking inside
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={markingReturnAppIds.has(selectedApp._id)} // Disable close button when marking return
            >
              &times; {/* Close button */}
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Application Details{" "}
              <span className="text-gray-500 text-sm ml-2">
                ID: {selectedApp._id.slice(-6)}
              </span>
            </h2>

            {/* Student & Parents Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Student</p>
                <p className="text-gray-900 font-medium">
                  {selectedApp.student.name} - {selectedApp.student.batch}
                  <br />
                  <a
                    href={`mailto:${selectedApp.student.email}`}
                    className="text-indigo-600 underline hover:text-indigo-800 transition"
                  >
                    {selectedApp.student.email}
                  </a>
                  <p>{selectedApp.student.gender}</p>
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">
                  Parent(s)
                </p>
                {selectedApp.student.parents?.length ? (
                  <ul className="space-y-2 text-gray-900">
                    {selectedApp.student.parents.map((p, i) => (
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

            {/* Departure & Return Details */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 uppercase mb-2">
                Departure & Return
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-gray-600 text-sm">Departure Date</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(selectedApp.startDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">Return Due Date</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(selectedApp.endDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">
                    Actual Departure Time (Guard)
                  </dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(selectedApp.guardStatus.decidedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-600 text-sm">Actual Return Time</dt>
                  <dd className="text-gray-900 font-medium">
                    {formatDateTime(selectedApp.returnDateTime)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-600 text-sm">Reason for Leave</dt>
                  <dd className="text-gray-900 font-medium">
                    {selectedApp.reason}
                  </dd>
                </div>
                {selectedApp.documentUrl && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-600 text-sm">
                      Supporting Document
                    </dt>
                    <dd className="text-gray-900 font-medium">
                      <a
                        href={`/api/drive/${selectedApp.documentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 underline hover:text-indigo-800 transition"
                      >
                        View Document
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <hr className="border-gray-200 mb-6" />

            {/* Approval Timeline */}
            <div className="space-y-4 mb-6">
              <p className="text-xs text-gray-500 uppercase mb-2">
                Approval Status Timeline
              </p>
              {[
                ["Parent", selectedApp.parentStatus],
                ["Warden", selectedApp.wardenStatus],
                ["Guard", selectedApp.guardStatus],
                ["Admin", selectedApp.adminStatus],
              ].map(([label, st]) => (
                <div key={label} className="flex justify-between items-start">
                  <span className="text-gray-700 font-medium">{label}:</span>
                  <div className="flex flex-col items-end">
                    {/* Special handling for Admin status 'No interference' */}
                    {label === "Admin" && st.status !== "stopped" ? (
                      <span className="italic text-gray-500 text-sm">
                        No interference
                      </span>
                    ) : (
                      <StatusBadge status={st.status} />
                    )}
                    {st.decidedAt && (
                      <p className="mt-1 text-[10px] text-gray-500">
                        {formatDateTime(st.decidedAt)}
                      </p>
                    )}
                    {st.reason &&
                      (st.status === "rejected" || st.status === "stopped") && (
                        <p className="text-xs text-gray-600 mt-1 max-w-xs text-right break-words">
                          (Reason: {st.reason})
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions for 'Departed awaiting return' from modal view */}
            {selectedApp.guardStatus.status === "approved" &&
              !selectedApp.returnDateTime && (
                <button
                  onClick={(e) => handleMarkReturn(e, selectedApp._id)}
                  disabled={markingReturnAppIds.has(selectedApp._id)} // Disable button when marking return
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-2xl hover:bg-blue-700 transition shadow-md mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markingReturnAppIds.has(selectedApp._id)
                    ? "Marking Returned..."
                    : "Mark Returned to Campus"}
                </button>
              )}
            <button
              onClick={closeModal}
              className={`w-full py-3 ${
                selectedApp.guardStatus.status === "approved" &&
                !selectedApp.returnDateTime
                  ? "bg-indigo-500 hover:bg-indigo-600" // Slightly different color if 'Mark Returned' is also present
                  : "bg-indigo-600 hover:bg-indigo-700"
              } text-white font-medium rounded-2xl transition shadow-md`}
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4"
          onClick={closeReasonModal}
        >
          <div
            className="relative bg-white rounded-3xl shadow-lg w-full max-w-md p-8 transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeReasonModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={rejectingAppIds.has(currentRejectingAppId)} // Disable close button when rejecting
            >
              &times;
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-4">
              Provide Denial Reason (Optional)
            </h2>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 mb-6 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-y"
              placeholder="e.g., Pending dues, disciplinary hold…"
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              disabled={rejectingAppIds.has(currentRejectingAppId)} // Disable textarea when rejecting
            />
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={closeReasonModal}
                className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition shadow-md"
                disabled={rejectingAppIds.has(currentRejectingAppId)} // Disable cancel button when rejecting
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={rejectingAppIds.has(currentRejectingAppId)} // Disable confirm button when rejecting
                className="px-5 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectingAppIds.has(currentRejectingAppId)
                  ? "Denying..."
                  : "Confirm Deny Exit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Concern Modal */}
      {showConcernModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={() => setShowConcernModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-lg w-full max-w-md p-8 transform transition-all duration-300 scale-100 opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowConcernModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={submittingConcern} // Disable close button when submitting
            >
              &times;
            </button>
            <h2 className="text-2xl font-semibold mb-6 border-b pb-4">
              Register a Concern
            </h2>
            <form onSubmit={submitConcern} className="space-y-5">
              {/* Batch selector */}
              <div>
                <label
                  htmlFor="batch"
                  className="block text-sm font-medium text-gray-700"
                >
                  Batch
                </label>
                <select
                  id="batch"
                  name="batch"
                  value={concernForm.batch}
                  onChange={handleConcernChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-indigo-400 disabled:opacity-50"
                  disabled={submittingConcern} // Disable select when submitting
                >
                  <option value="">Select batch…</option>
                  {batchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student selector — only enabled once a batch is chosen */}
              <div>
                <label
                  htmlFor="studentName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Student Name
                </label>
                <select
                  id="studentName"
                  name="studentName"
                  value={concernForm.studentId}
                  onChange={(e) => {
                    const studentId = e.target.value;
                    const student = studentsList.find(
                      (s) => s._id === studentId
                    );
                    setConcernForm((f) => ({
                      ...f,
                      studentId,
                      studentName: student ? student.name : "",
                    }));
                  }}
                  required
                  disabled={!concernForm.batch || submittingConcern} // Disable select when submitting or no batch selected
                  className="w-full px-4 py-2 border rounded-lg focus:ring-indigo-400 disabled:opacity-50"
                >
                  <option value="">
                    {concernForm.batch
                      ? "Choose student…"
                      : "Select batch first"}
                  </option>
                  {studentsList
                    .filter((s) => s.batch === concernForm.batch)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={concernForm.description}
                  onChange={handleConcernChange}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-400 focus:outline-none resize-y disabled:opacity-50"
                  disabled={submittingConcern} // Disable textarea when submitting
                />
              </div>
              <div>
                <label
                  htmlFor="imageUpload"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Upload Image (optional)
                </label>
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleConcernFile}
                  className="w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
                  disabled={submittingConcern} // Disable file input when submitting
                />
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConcernModal(false)}
                  className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submittingConcern} // Disable cancel button when submitting
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConcern}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                  {submittingConcern ? "Submitting…" : "Submit Concern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
