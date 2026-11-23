import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import WardenPage from "./pages/WardenPage";
import GuardPage from "./pages/GuardPage";
import ProtectedRoute from "./components/ProtectedRoute";
import IosPage from "./pages/IosPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/ioslogin" element={<IosPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/warden"
        element={
          <ProtectedRoute allowedRoles={["warden"]}>
            <WardenPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/guard"
        element={
          <ProtectedRoute allowedRoles={["guard"]}>
            <GuardPage />
          </ProtectedRoute>
        }
      />

      {/* <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}><StudentPage/></ProtectedRoute>
        }/> */}

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
