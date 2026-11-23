// src/pages/WardenPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { User, LogOut } from "lucide-react";
// small reusable badge
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

const formatDateTime = (date) =>
  new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function WardenPage() {
  const [activeTab, setActiveTab] = useState("applications");
  const [activeSubTab, setActiveSubTab] = useState("warden-pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [applications, setApplications] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingConcerns, setLoadingConcerns] = useState(true);
  const [loadErrorApps, setLoadErrorApps] = useState("");
  const [loadErrorConcerns, setLoadErrorConcerns] = useState("");
  const [modalId, setModalId] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageToShow, setImageToShow] = useState("");
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentRejectingAppId, setCurrentRejectingAppId] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  // Renamed for clarity and consistency
  const [approvingAppIds, setApprovingAppIds] = useState(new Set()); // Track applications being approved
  const [rejectingAppIds, setRejectingAppIds] = useState(new Set()); // Track applications being rejected
  const [isConfirmingReject, setIsConfirmingReject] = useState(false); // For the rejection confirmation modal button
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [wardenDetails, setWardenDetails] = useState(null);

  const fetchWardenProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/warden/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load profile");
      }
      const { user } = await res.json();
      setWardenDetails(user);
    } catch (err) {
      console.error("Profile fetch error:", err);
      toast.error(`Profile Error: ${err.message}`);
    }
  }, [token]);

  const fetchApplications = useCallback(async () => {
    setLoadingApps(true);
    setLoadErrorApps("");
    try {
      const res = await fetch("/api/warden/applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch applications");
      }
      const { leaves } = await res.json();
      setApplications(leaves);
    } catch (err) {
      console.error(err);
      setLoadErrorApps(`Applications Error: ${err.message}`);
      toast.error(`Could not load applications: ${err.message}`);
    } finally {
      setLoadingApps(false);
    }
  }, [token]);

  const fetchConcerns = useCallback(async () => {
    setLoadingConcerns(true);
    setLoadErrorConcerns("");
    try {
      const res = await fetch("/api/warden/concerns", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load concerns");
      }
      const { concerns } = await res.json();
      setConcerns(concerns);
    } catch (err) {
      console.error(err);
      setLoadErrorConcerns(`Concerns Error: ${err.message}`);
      toast.error(`Could not load concerns: ${err.message}`);
    } finally {
      setLoadingConcerns(false);
    }
  }, [token]);

  useEffect(() => {
    fetchApplications();
    fetchConcerns();
    fetchWardenProfile();
  }, [fetchApplications, fetchConcerns, fetchWardenProfile]);

  const handleDecision = async (id, decision, rejectionReason = "") => {
    if (decision === "approved") {
      setApprovingAppIds((prev) => new Set(prev).add(id));
    } else {
      setRejectingAppIds((prev) => new Set(prev).add(id));
    }

    try {
      const res = await fetch(`/api/warden/applications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, rejectionReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Decision failed");
      }
      await fetchApplications();
      toast.success(
        decision === "approved"
          ? "Application approved ✅"
          : "Application rejected ❌"
      );
      closeReasonModal();
    } catch (err) {
      console.error(err);
      toast.error(`Decision Error: ${err.message}`);
    } finally {
      // Reset loading states for the specific application ID
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
      setIsConfirmingReject(false); // Also reset this for safety, though primarily handled in confirmReject
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const openModal = (id) => {
    setModalId(id);
    setModalLoading(true);
    setModalError("");
    fetch(`/api/warden/applications/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((err) => {
            throw new Error(err.message || "Failed to fetch details");
          });
        }
        return r.json();
      })
      .then((data) => setModalData(data.leave))
      .catch((err) => {
        console.error(err);
        setModalError(`Details Error: ${err.message}`);
        toast.error(`Could not load application details: ${err.message}`);
      })
      .finally(() => setModalLoading(false));
  };
  const closeModal = () => {
    setModalId(null);
    setModalData(null);
    setModalError("");
  };

  const openReasonModal = (e, appId) => {
    e.stopPropagation();
    setCurrentRejectingAppId(appId);
    setRejectionReasonInput("");
    setShowReasonModal(true);
  };
  const closeReasonModal = () => {
    setShowReasonModal(false);
    setCurrentRejectingAppId(null);
    setRejectionReasonInput("");
  };
  const confirmReject = () => {
    if (currentRejectingAppId) {
      setIsConfirmingReject(true); // Set loading state for the confirmation button
      handleDecision(currentRejectingAppId, "rejected", rejectionReasonInput);
    }
  };

  // bucket definitions for sub-tabs
  const buckets = {
    "warden-pending": applications.filter(
      (app) =>
        app.parentStatus.status === "approved" &&
        app.wardenStatus.status === "pending" &&
        app.adminStatus.status !== "stopped"
    ),
    all: applications.slice(),
    "parent-pending": applications.filter(
      (app) =>
        app.parentStatus.status === "pending" &&
        app.adminStatus.status !== "stopped"
    ),
    "parent-rejected": applications.filter(
      (app) =>
        app.parentStatus.status === "rejected" &&
        app.adminStatus.status !== "stopped"
    ),
    "warden-rejected": applications.filter(
      (app) =>
        app.wardenStatus.status === "rejected" &&
        app.adminStatus.status !== "stopped"
    ),
    "warden-approved-guard-pending": applications.filter(
      (app) =>
        app.wardenStatus.status === "approved" &&
        app.guardStatus.status === "pending" &&
        app.adminStatus.status !== "stopped"
    ),
    "guard-rejected": applications.filter(
      (app) =>
        app.guardStatus.status === "rejected" &&
        app.adminStatus.status !== "stopped"
    ),
    "guard-out": applications.filter(
      (app) =>
        app.guardStatus.status === "approved" &&
        !app.returnDateTime &&
        app.adminStatus.status !== "stopped"
    ),
    "guard-returned": applications.filter(
      (app) =>
        app.guardStatus.status === "approved" &&
        !!app.returnDateTime &&
        app.adminStatus.status !== "stopped"
    ),
    "admin-stopped": applications.filter(
      (app) => app.adminStatus.status === "stopped"
    ),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Toaster position="top-right" />

      <header className="relative bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-3xl p-8 shadow-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <User className="h-12 w-12 text-white/90" />
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              Welcome, {wardenDetails?.name || "Warden"}!
            </h2>
            <p className="text-sm text-white/80">
              {wardenDetails?.email} &#183;{" "}
              <span className="font-medium capitalize">
                {wardenDetails?.gender}
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

      {/* Main Tabs */}
      <nav className="flex space-x-6 mb-8 border-b-2 border-gray-200">
        {["applications", "concerns"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-lg font-medium ${
              activeTab === tab
                ? "border-b-4 border-indigo-600 text-indigo-600"
                : "text-gray-600 hover:text-indigo-500"
            }`}
          >
            {tab === "applications" ? "Applications" : "Raised Concerns"}
          </button>
        ))}
      </nav>

      {/* Applications Section */}
      {activeTab === "applications" && (
        <section className="bg-white rounded-3xl shadow-lg p-6 mb-8">
          {/* Sub-Tabs */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              ["warden-pending", "Warden Pending"],
              ["all", "All"],
              ["parent-pending", "Parent Pending"],
              ["parent-rejected", "Parent Rejected"],
              ["warden-rejected", "Warden Rejected"],
              ["warden-approved-guard-pending", "Warden Approved"],
              ["guard-rejected", "Guard Rejected"],
              ["guard-out", "Guard Out"],
              ["guard-returned", "Guard Returned"],
              ["admin-stopped", "Admin Stopped"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveSubTab(key)}
                className={`px-4 py-1 text-sm rounded-full font-medium ${
                  activeSubTab === key
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by student name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          {/* Table */}
          {loadingApps ? (
            <p className="text-center text-gray-500 py-8">
              Loading applications…
            </p>
          ) : loadErrorApps ? (
            <p className="text-center text-red-600 py-8">{loadErrorApps}</p>
          ) : (
            (() => {
              const filtered = buckets[activeSubTab].filter((app) =>
                searchQuery.trim()
                  ? app.student.name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  : true
              );
              if (!filtered.length) {
                return (
                  <p className="text-center text-gray-500 py-8">
                    No applications in this category.
                  </p>
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        {[
                          "ID",
                          "Student",
                          "Dates",
                          "Reason",
                          "Parent",
                          "Warden",
                          "Guard",
                          "Admin",
                          "Actions",
                        ].map((col) => (
                          <th
                            key={col}
                            className="px-6 py-3 text-center font-semibold text-gray-700 uppercase"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filtered.map((app) => {
                        const isDisabled =
                          app.parentStatus.status !== "approved" ||
                          app.wardenStatus.status !== "pending" ||
                          app.adminStatus.status === "stopped" ||
                          approvingAppIds.has(app._id) || // Disable if this app is being approved
                          rejectingAppIds.has(app._id); // Disable if this app is being rejected

                        return (
                          <tr
                            key={app._id}
                            className="hover:bg-gray-50 transition cursor-pointer"
                            onClick={() => openModal(app._id)}
                          >
                            <td className="px-6 py-4 text-gray-600">
                              {app._id.slice(-6)}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-800">
                              {app.student.name}
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {formatDateTime(app.startDate)} →{" "}
                              {formatDateTime(app.endDate)}
                            </td>
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
                            <td className="px-6 py-4 whitespace-nowrap flex space-x-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecision(app._id, "approved");
                                }}
                                disabled={isDisabled}
                                className={`flex-1 p-2 rounded-lg text-sm font-medium text-white ${
                                  isDisabled
                                    ? "bg-green-300 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700"
                                }`}
                              >
                                {approvingAppIds.has(app._id)
                                  ? "Approving..."
                                  : "Approve"}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReasonModal(e, app._id);
                                }}
                                disabled={isDisabled}
                                className={`flex-1 p-2 rounded-lg text-sm font-medium text-white ${
                                  isDisabled
                                    ? "bg-red-300 cursor-not-allowed"
                                    : "bg-red-600 hover:bg-red-700"
                                }`}
                              >
                                {rejectingAppIds.has(app._id)
                                  ? "Rejecting..."
                                  : "Reject"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </section>
      )}

      {/* Concerns Section */}
      {activeTab === "concerns" && (
        <section className="bg-white rounded-3xl shadow-lg p-6">
          {loadingConcerns ? (
            <p className="text-center text-gray-500 py-8">Loading concerns…</p>
          ) : loadErrorConcerns ? (
            <p className="text-center text-red-600 py-8">{loadErrorConcerns}</p>
          ) : !concerns.length ? (
            <p className="text-center text-gray-500 py-8">
              No concerns have been raised yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {["Student", "Batch", "Description", "Image", "Date"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-6 py-3 text-left font-semibold text-gray-700 uppercase"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {concerns.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => {
                        if (c.documentUrl) {
                          setImageToShow(`/api/drive/${c.documentUrl}`);
                          setShowImageModal(true);
                        }
                      }}
                    >
                      <td className="px-6 py-4 font-medium text-gray-800">
                        {c.studentName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{c.batch}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {c.description}
                      </td>
                      <td className="px-6 py-4">
                        {c.documentUrl ? (
                          <img
                            src={`/api/drive/${c.documentUrl}`}
                            alt="concern"
                            className="h-12 w-12 object-cover rounded-lg shadow-sm"
                          />
                        ) : (
                          <span className="italic text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(c.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Application Details Modal */}
      {modalId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative bg-white rounded-3xl max-h-[80vh] no-scrollbar shadow-lg w-full max-w-lg p-8 animate-modalPop"
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <p className="text-center text-gray-500 py-12">
                Loading details…
              </p>
            ) : modalError ? (
              <p className="text-center text-red-600 py-12">{modalError}</p>
            ) : (
              <>
                <button
                  onClick={closeModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
                >
                  &times;
                </button>
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                  Application Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
                      Student
                    </h3>
                    <p className="text-gray-900">
                      {modalData.student.name} - {modalData.student.batch}
                      <br />
                      <a
                        href={`mailto:${modalData.student.email}`}
                        className="text-indigo-600 underline"
                      >
                        {modalData.student.email}
                      </a>
                      <p>{modalData.student.gender}</p>
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
                      Parent(s)
                    </h3>
                    {modalData.student.parents?.length ? (
                      <ul className="space-y-2">
                        {modalData.student.parents.map((p, i) => (
                          <li key={i} className="text-gray-900">
                            {p.name}
                            <br />
                            <a
                              href={`mailto:${p.email}`}
                              className="text-indigo-600 underline"
                            >
                              {p.email}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">None on record</p>
                    )}
                  </div>
                </div>

                <hr className="border-gray-200 mb-6" />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
                      Leave Information
                    </h3>
                    <p>
                      <strong>From:</strong>{" "}
                      {formatDateTime(modalData.startDate)}
                    </p>
                    <p>
                      <strong>To:</strong> {formatDateTime(modalData.endDate)}
                    </p>
                    <p>
                      <strong>Reason:</strong> {modalData.reason}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Supporting Document
                    </p>
                    {modalData.documentUrl ? (
                      <img
                        src={`/api/drive/${modalData.documentUrl}`}
                        alt="Supporting Document"
                        className="rounded-2xl cursor-pointer object-cover w-40 h-40 hover:opacity-90 transition"
                        onClick={() => {
                          setImageToShow(`/api/drive/${modalData.documentUrl}`);
                          setShowImageModal(true);
                        }}
                      />
                    ) : (
                      <p className="italic text-gray-400">
                        No document provided
                      </p>
                    )}
                  </div>
                </div>

                {modalData.returnDateTime && (
                  <div className="space-y-3 mb-6">
                    <hr className="border-gray-200 mb-3" />
                    <h3 className="text-xs font-medium text-gray-500 uppercase">
                      Return Information
                    </h3>
                    <p className="text-sm text-gray-700">
                      <strong>Return Time:</strong>{" "}
                      {formatDateTime(modalData.returnDateTime)}
                    </p>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  {[
                    ["Parents", modalData.parentStatus],
                    ["Warden", modalData.wardenStatus],
                    ["Guard", modalData.guardStatus],
                    ["Admin", modalData.adminStatus],
                  ].map(([label, st]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center"
                    >
                      <span className="text-gray-700">{label}:</span>
                      <div className="flex flex-col items-end">
                        {label === "Admin" && st.status !== "stopped" ? (
                          <span className="italic text-gray-500 text-sm">
                            No admin interference
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
                          (st.status === "rejected" ||
                            st.status === "stopped") && (
                            <p className="text-xs text-gray-600 mt-1 max-w-xs text-right break-words">
                              (Reason: {st.reason})
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-indigo-600 text-white font-medium rounded-2xl hover:bg-indigo-700 transition"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showReasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={closeReasonModal}
        >
          <div
            className="relative bg-white rounded-3xl shadow-lg w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeReasonModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
              disabled={isConfirmingReject} // Disable close button when confirming reject
            >
              &times;
            </button>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Provide Rejection Reason (Optional)
            </h2>
            <textarea
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 mb-6 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-y"
              placeholder="e.g. Not enough notice…"
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              disabled={isConfirmingReject} // Disable textarea when confirming reject
            />
            <div className="flex justify-end space-x-4">
              <button
                onClick={closeReasonModal}
                className="px-5 py-2 bg-gray-200 rounded-full hover:bg-gray-300 transition"
                disabled={isConfirmingReject} // Disable cancel button when confirming reject
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={isConfirmingReject} // Disable confirm button during API call
                className={`px-5 py-2 rounded-full font-medium text-white ${
                  isConfirmingReject
                    ? "bg-red-300 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isConfirmingReject ? "Rejecting..." : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
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
