import React, { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ---- IST helpers ----
const IST_OFFSET_MS = 0; // +5:30

// Default YYYY-MM-DD string for "today" in IST (independent of host TZ)
const todayIstYmd = () => {
  const now = new Date();
  const nowIst = new Date(now.getTime() + IST_OFFSET_MS);
  const y = nowIst.getUTCFullYear();
  const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(nowIst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Given a YYYY-MM-DD, return [startUTC, endUTC) that represent that **IST** day.
const istDayBounds = (ymd) => {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const startUtcMs = Date.UTC(y, m - 1, d) - IST_OFFSET_MS; // 00:00 IST as UTC
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(endUtcMs) };
};

// Display formatter (force IST)
const formatIST = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "N/A";

// (kept your original for the existing exports)
const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

// ---- PDF styles (unchanged) ----
const styles = StyleSheet.create({
  page: { flexDirection: "column", backgroundColor: "#FFFFFF", padding: 20 },
  header: { fontSize: 20, textAlign: "center", marginBottom: 15, fontWeight: "bold", color: "#262626" },
  subheader: { fontSize: 9, textAlign: "center", marginBottom: 20, color: "#666666" },
  table: { display: "table", width: "auto", marginBottom: 10, borderStyle: "solid", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, overflow: "hidden" },
  tableRow: { flexDirection: "row", borderBottomColor: "#EFF3F8", borderBottomWidth: 1 },
  tableColBase: { borderStyle: "solid", borderLeftWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, borderRightWidth: 1, borderColor: "#E2E8F0", padding: 3, textAlign: "left", color: "#333333", flexGrow: 1, flexShrink: 1 },
  tableColHeaderBase: { backgroundColor: "#4338CA", color: "white", fontWeight: "bold", borderColor: "#3B30AB", padding: 5, fontSize: 6, textTransform: "uppercase", textAlign: "left", flexGrow: 1, flexShrink: 1 },
  tableRowEven: { backgroundColor: "#F8FAFC" },
  tableRowOdd: { backgroundColor: "white" },
  footer: { fontSize: 7, textAlign: "center", marginTop: 20, color: "#888888" },
});

const DownloadApplicationsButton = ({ applications }) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingLeftExcel, setIsExportingLeftExcel] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIstYmd()); // <-- IST date picker

  const getApplicationsForPdf = () => {
    if (!applications || !Array.isArray(applications)) return [];
    return applications.map((app) => ({
      "Student Name": app.student?.name || "N/A",
      "Student Email": app.student?.email || "N/A",
      Reason: app.reason || "N/A",
      "From Date": formatDateTime(app.startDate),
      "To Date": formatDateTime(app.endDate),
      "Admin Status": app.adminStatus?.status || "Pending",
      "Warden Status": app.wardenStatus?.status || "Pending",
      "Parent Status": app.parentStatus?.status || "Pending",
      "Guard Status": app.guardStatus?.status || "Pending",
      "Return Time": formatDateTime(app.returnDateTime),
      "Cancellation Reason": app.cancellationReason || "N/A",
    }));
  };

  const getApplicationsForExcel = () => {
    if (!applications || !Array.isArray(applications)) return [];
    return applications.map((app) => ({
      "Application ID": app._id,
      "Student ID": app.student?._id || "N/A",
      "Student Name": app.student?.name || "N/A",
      "Student Email": app.student?.email || "N/A",
      "Student Batch": app.student?.batch || "N/A",
      "Student Gender": app.student?.gender || "N/A",
      "Parent Names":
        app.student?.parents?.length
          ? app.student.parents.map((p) => p.name).join(", ")
          : "N/A",
      "Parent Emails":
        app.student?.parents?.length
          ? app.student.parents.map((p) => p.email).join(", ")
          : "N/A",
      Reason: app.reason || "N/A",
      "From Date Time": formatIST(app.startDate),
      "To Date Time": formatIST(app.endDate),
      "Admin Status": app.adminStatus?.status || "Pending",
      "Admin Decision At": formatIST(app.adminStatus?.decidedAt),
      "Admin Reason": app.adminStatus?.reason || "N/A",
      "Warden Status": app.wardenStatus?.status || "Pending",
      "Warden Decision At": formatIST(app.wardenStatus?.decidedAt),
      "Warden Reason": app.wardenStatus?.reason || "N/A",
      "Parent Status": app.parentStatus?.status || "Pending",
      "Parent Decision At": formatIST(app.parentStatus?.decidedAt),
      "Parent Reason": app.parentStatus?.reason || "N/A",
      "Guard Status": app.guardStatus?.status || "Pending",
      "Guard Decision At": formatIST(app.guardStatus?.decidedAt),
      "Guard Reason": app.guardStatus?.reason || "N/A",
      "Return Date Time": formatIST(app.returnDateTime),
      "Cancellation Reason": app.cancellationReason || "N/A",
      "Document URL": app.documentUrl || "N/A",
      "Created At": formatIST(app.createdAt),
      "Updated At": new Date(new Date(app.updatedAt) - 0 * 60 * 1000).toLocaleString(),
    }));
  };

  // ---- NEW: Left-by-date (IST) Excel export ----
  const handleDownloadLeftExcel = () => {
    if (!applications || !applications.length) {
      toast.error("No applications available.");
      return;
    }
    setIsExportingLeftExcel(true);
    try {
      const { start, end } = istDayBounds(selectedDate);

      const leftToday = applications.filter((a) => {
        if (a?.guardStatus?.status !== "approved" || !a?.guardStatus?.decidedAt)
          return false;
        const t = new Date(a.guardStatus.decidedAt);
        return t >= start && t < end; // in [00:00, 24:00) IST window (as UTC)
      });

      if (!leftToday.length) {
        toast.error("No left applications for the selected date.");
        return;
      }

      const rows = leftToday.map((app) => ({
        "Student Name": app.student?.name || "N/A",
        "Student Email": app.student?.email || "N/A",
        Batch: app.student?.batch || "N/A",
        "Left (Guard Approved At)": new Date(new Date(app.guardStatus.decidedAt) - 330 * 60 * 1000).toLocaleString(),
        "From Date": formatIST(app.startDate),
        "To Date": formatIST(app.endDate),
        Reason: app.reason || "N/A",
        "Application ID": app._id,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Left (IST)");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buf], {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `left_applications_${selectedDate}.xlsx`
      );
      toast.success("Left applications downloaded (Excel).");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export left applications.");
    } finally {
      setIsExportingLeftExcel(false);
    }
  };

  const handleDownloadExcel = () => {
    if (typeof XLSX === "undefined" || typeof saveAs === "undefined") {
      toast.error("Spreadsheet libs not loaded.");
      return;
    }
    setIsExportingExcel(true);
    try {
      const dataToExport = getApplicationsForExcel();
      if (!dataToExport.length) {
        toast.error("No application data to export to Excel.");
        return;
      }
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Applications");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(data, "student_applications_report.xlsx");
      toast.success("Applications report downloaded (Excel).");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to download Excel file.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const applicationsForPdf = getApplicationsForPdf();
      if (!applicationsForPdf.length) {
        toast.error("No application data to export to PDF.");
        return;
      }

      const headers = Object.keys(applicationsForPdf[0]);
      const data = applicationsForPdf.map((app) => Object.values(app));
      const finalColumnWidths = [50, 70, 45, 50, 50, 38, 38, 38, 38, 50, 40];

      const MyDocument = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.header}>Student Leave Applications Report</Text>
            <Text style={styles.subheader}>
              Report generated on{" "}
              {new Date().toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              })}
            </Text>
            <View style={styles.table}>
              <View style={styles.tableRow}>
                {headers.map((header, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tableColHeaderBase,
                      { width: finalColumnWidths[i] },
                    ]}
                  >
                    <Text>{header}</Text>
                  </View>
                ))}
              </View>
              {data.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  style={[
                    styles.tableRow,
                    rowIndex % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                  ]}
                >
                  {row.map((cell, cellIndex) => (
                    <View
                      key={cellIndex}
                      style={[
                        styles.tableColBase,
                        { width: finalColumnWidths[cellIndex] },
                      ]}
                    >
                      <Text style={{ fontSize: 6, wordWrap: "break-word" }}>
                        {String(cell)}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <Text
              style={styles.footer}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
              fixed
            />
          </Page>
        </Document>
      );

      const blob = await pdf(<MyDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student_applications_report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Applications report downloaded (PDF).");
    } catch (error) {
      console.error("Error exporting applications to PDF:", error);
      toast.error("Failed to download applications report: " + error.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 py-8 mt-4">
      {/* NEW: IST date picker for Left-by-date */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Date (IST):</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white"
        />
      </div>

      <button
        onClick={handleDownloadLeftExcel}
        disabled={isExportingLeftExcel}
        className="px-5 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingLeftExcel ? "Exporting..." : "Download Left (Excel, by date)"}
      </button>

      <button
        onClick={handleDownloadExcel}
        disabled={isExportingExcel}
        className="px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingExcel ? "Exporting Excel..." : "Download Applications (Excel)"}
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={isExportingPdf}
        className="px-5 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExportingPdf ? "Exporting PDF..." : "Download Applications (PDF)"}
      </button>

      <div style={{ display: "none" }} />
    </div>
  );
};

export default DownloadApplicationsButton;
