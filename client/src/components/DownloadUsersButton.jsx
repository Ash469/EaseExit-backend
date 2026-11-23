import React, { useState } from "react";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx"; // Import XLSX for Excel export
import { saveAs } from "file-saver"; // Import saveAs for file saving
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"; // Import @react-pdf/renderer components

// Helper function to format date and time for consistent display
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

// Create styles for the PDF document (similar to DownloadApplicationsButton)
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 20, // Reduced overall page padding slightly
  },
  header: {
    fontSize: 20, // Slightly smaller header to save space
    textAlign: "center",
    marginBottom: 15, // Reduced margin
    fontWeight: "bold",
    color: "#262626",
  },
  subheader: {
    fontSize: 9, // Slightly smaller subheader
    textAlign: "center",
    marginBottom: 20, // Reduced margin
    color: "#666666",
  },
  table: {
    display: "table",
    width: "auto",
    marginBottom: 10,
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: "#EFF3F8",
    borderBottomWidth: 1,
  },
  tableColBase: {
    borderStyle: "solid",
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderColor: "#E2E8F0", // Light border for body cells
    padding: 3, // Further reduced padding for cells
    textAlign: "left",
    color: "#333333",
    flexGrow: 1,
    flexShrink: 1,
  },
  tableColHeaderBase: {
    backgroundColor: "#4338CA", // Indigo-600
    color: "white",
    fontWeight: "bold",
    borderColor: "#3B30AB", // Darker border for header
    padding: 5, // Further reduced padding for headers
    fontSize: 6, // Further reduced font size for headers
    textTransform: "uppercase",
    textAlign: "left",
    flexGrow: 1,
    flexShrink: 1,
  },
  tableRowEven: {
    backgroundColor: "#F8FAFC",
  },
  tableRowOdd: {
    backgroundColor: "white",
  },
  footer: {
    fontSize: 7,
    textAlign: "center",
    marginTop: 20,
    color: "#888888",
  },
});

const DownloadUsersButton = ({ users }) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // pdfContentRef is no longer needed with @react-pdf/renderer

  const getStudentsForExport = () => {
    if (!users || !Array.isArray(users)) {
      console.error("Users prop is not a valid array:", users);
      return [];
    }
    return users
      .filter(user => user.role === 'student')
      .map(user => ({
        Name: user.name,
        Email: user.email,
        Batch: user.batch || 'N/A',
        Gender: user.gender || 'N/A',
        'Created At': formatDateTime(user.createdAt), // Use formatDateTime
        'Updated At': formatDateTime(user.updatedAt), // Use formatDateTime
        'Parent Names': user.parents && user.parents.length > 0 ? user.parents.map(p => p.name).join(', ') : 'N/A',
        'Parent Emails': user.parents && user.parents.length > 0 ? user.parents.map(p => p.email).join(', ') : 'N/A',
      }));
  };

  const handleDownloadExcel = () => {
    if (typeof XLSX === "undefined" || typeof saveAs === "undefined") {
      toast.error(
        "Spreadsheet functionalities are not loaded. Please ensure internet connectivity or refresh the page."
      );
      console.error(
        "XLSX or saveAs is not defined. Ensure CDN scripts are loaded."
      );
      return;
    }

    setIsExportingExcel(true);
    try {
      const dataToExport = getStudentsForExport();
      if (dataToExport.length === 0) {
        toast.error("No student data to export to Excel.");
        return;
      }
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const data = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(data, "student_data.xlsx");
      toast.success("Student data downloaded successfully as Excel!");
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
      const studentsForPdf = getStudentsForExport();

      if (studentsForPdf.length === 0) {
        toast.error("No student data to export to PDF.");
        return;
      }

      const headers = Object.keys(studentsForPdf[0]);
      const data = studentsForPdf.map((student) => Object.values(student));

      // Define widths for each specific column in points (pt).
      // There are 8 columns for student data.
      // A4 usable width is approx 481.894 pt (with 20pt padding).
      // Let's aim for a total table width slightly less than usable width, e.g., 470pt.
      const finalColumnWidths = [
        60,  // Name
        80,  // Email
        40,  // Batch
        40,  // Gender
        65,  // Created At
        65,  // Updated At
        70,  // Parent Names
        70,  // Parent Emails
      ];
      // Sum of finalColumnWidths = 60+80+40+40+65+65+70+70 = 490pt. This should fit well.


      const MyDocument = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={styles.header}>Student Portal Users Report</Text>
            <Text style={styles.subheader}>
              Report generated on{" "}
              {new Date().toLocaleDateString("en-IN", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>

            {/* Table */}
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableRow}>
                {headers.map((header, i) => (
                  <View key={i} style={[styles.tableColHeaderBase, { width: finalColumnWidths[i] }]}>
                    <Text>{header}</Text>
                  </View>
                ))}
              </View>
              {/* Table Body */}
              {data.map((row, rowIndex) => (
                <View
                  key={rowIndex}
                  style={[
                    styles.tableRow,
                    rowIndex % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                  ]}
                >
                  {row.map((cell, cellIndex) => (
                    <View key={cellIndex} style={[styles.tableColBase, { width: finalColumnWidths[cellIndex] }]}>
                      {/* Using break-word for text to ensure it wraps within the cell */}
                      <Text style={{ fontSize: 6, wordWrap: 'break-word' }}>{String(cell)}</Text>
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
      a.download = "student_data.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Student data downloaded successfully as PDF!");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to download PDF file: " + error.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
      <button
        onClick={handleDownloadExcel}
        disabled={isExportingExcel}
        className="px-5 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5 4a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2H5zm0 2h10v2H5V6zm0 4h10v2H5v-2zm0 4h10v2H5v-2z" clipRule="evenodd" />
        </svg>
        {isExportingExcel ? "Exporting Excel..." : "Download Students (Excel)"}
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={isExportingPdf}
        className="px-5 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0h8v12H6V4zm2 2a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm1 4a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
        {isExportingPdf ? "Exporting PDF..." : "Download Students (PDF)"}
      </button>

      {/* This div is no longer needed with @react-pdf/renderer and can be safely removed */}
      <div style={{ display: "none" }}></div>
    </div>
  );
};

export default DownloadUsersButton;
