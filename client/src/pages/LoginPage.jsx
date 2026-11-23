// src/pages/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const role = params.get("userRole");
    if (token && role) {
      localStorage.setItem("token", token);
      localStorage.setItem("userRole", role);
      window.history.replaceState({}, "", window.location.pathname);
      navigate(`/${role}`, { replace: true });
    }
  }, [navigate]);
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("userRole");
  if (token && userRole) {
    // If user is already logged in, redirect to their role page
    window.location.href = `/${userRole}`;
    return null;
  }
  // Kick off Google OAuth
  const handleGoogleLogin = () => {
    setLoading(true);
    toast.loading("Redirecting to Google…", { id: "oauth" });
    if (process.env.NODE_ENV === "development") {
      // In development, redirect to local server
      window.location.href = `http://localhost:5000/api/auth/google`;
      return;
    }
    window.location.href = `/api/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4">
      <Toaster position="top-right" />
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">PIMS Leave</h1>
          <p className="text-gray-500 mt-2">
            Admin • Warden • Guard Login via Google
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center border border-gray-300 py-3 rounded-lg hover:shadow-lg transition"
        >
          <svg className="w-6 h-6" viewBox="0 0 533.5 544.3" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M533.5 278.4c0-17.5-1.6-34.3-4.7-50.7H272v95.9h146.9c-6.3 32.1-25 59.3-53.2 77.3v64.2h86c50.2-46.1 79-114.3 79-196.7z"
            />
            <path
              fill="#34A853"
              d="M272 544.3c72.6 0 133.6-24.1 178.2-65.3l-86-64.2c-23.9 16.1-54.6 25.6-92.2 25.6-70.9 0-131-47.8-152.4-112.1H30.6v70.6c44.4 87.2 134.4 145.4 241.4 145.4z"
            />
            <path
              fill="#FBBC05"
              d="M119.6 324.3c-10.6-31.9-10.6-66.3 0-98.2v-70.6H30.6c-44.4 87.2-44.4 190 0 277.2z"
            />
            <path
              fill="#EA4335"
              d="M272 109.3c38.5 0 73.1 13.3 100.4 39.3l75.3-75.3C405.5 24.9 345 0 272 0 165 0 75 58.2 30.6 145.4l89 70.6C141 157.1 201.1 109.3 272 109.3z"
            />
          </svg>
          <span className="ml-3 text-gray-700 font-medium">
            {loading ? "Redirecting…" : "Sign in with Google"}
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-gray-200" />
          <span className="mx-3 text-xs text-gray-400 uppercase tracking-wide">Get the App</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* App Links */}
        <div className="flex gap-3">
          {/* Google Play Store */}
          <a
            href="https://play.google.com/store/apps/details?id=com.pims.pims_app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl hover:bg-gray-900 transition"
          >
            <div className="leading-tight text-left">
              <div className="text-[9px] opacity-70">GET IT ON</div>
              <div className="text-xs font-semibold">Google Play</div>
            </div>
          </a>

          {/* Apple App Store */}
          <a
            href="https://apps.apple.com/us/app/ease-exit/id6749087386"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-3 rounded-xl hover:bg-gray-900 transition"
          >
            <div className="leading-tight text-left">
              <div className="text-[9px] opacity-70">DOWNLOAD ON THE</div>
              <div className="text-xs font-semibold">App Store</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
