import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');
  const role  = localStorage.getItem('userRole');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(role)) {
    return <div style={{padding:20}}>403 — Not allowed</div>;
  }
  return children;
}
