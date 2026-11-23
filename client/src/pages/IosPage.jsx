/* global AppleID */
import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";

const RegisterForIOS = () => {
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  // This function is triggered after a successful Apple Sign-In.
  // It logs the user's details and sends the token to your backend.
  const handleAppleLogin = async (appleAuthResponse) => {
    setLoading(true);
    toast.loading("Verifying with server...", { id: "apple-login" });

    try {
      // Log the user's details to the console for your reference
      console.log("Apple Auth Response:", appleAuthResponse);
      if (appleAuthResponse.user) {
        console.log("User Details (First Time Login):", appleAuthResponse.user);
      }
      
      const idToken = appleAuthResponse.authorization.id_token;
      if (idToken) {
        const appleUserId = JSON.parse(atob(idToken.split('.')[1])).sub;
        console.log("Apple User ID (sub):", appleUserId);
      }

      // Console log the data being sent to the backend via the POST request.
      console.log("Data being sent to backend:", appleAuthResponse.authorization);

      // Send the secure 'authorization' object to your backend.
      const response = await fetch("/api/auth/ios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(appleAuthResponse),
      });

      if (response.ok) {
        toast.dismiss("apple-login");
        toast.success("Registration Successful!", {
          id: "apple-success",
        });
        // Switch to the success screen
        setIsRegistered(true);
      } else {
        throw new Error("Failed to register with the server.");
      }
    } catch (error) {
      toast.dismiss("apple-login");
      toast.error("An error occurred during registration.", {
        id: "apple-error",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // This useEffect hook initializes the Apple Sign-In functionality.
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.defer = true;

    const onSuccess = (event) => {
      handleAppleLogin(event.detail);
    };
    const onFailure = (event) => {
      console.error("Apple Sign-In Error:", event.detail.error);
      toast.error("Sign-in failed. Please try again.");
      setLoading(false);
    };

    script.onload = () => {
      try {
        if (typeof AppleID === 'undefined') return;
        AppleID.auth.init({
          clientId: "com.pimsApple.signin", // Your actual Service ID
          scope: "name email",
          redirectURI: "https://college-leave-backend.onrender.com/ioslogin", // Your actual Redirect URI
          usePopup: true,
        });
        document.addEventListener("AppleIDSignInOnSuccess", onSuccess);
        document.addEventListener("AppleIDSignInOnFailure", onFailure);
      } catch (error) {
        console.error("Error initializing Apple Sign-In:", error);
      }
    };
    document.body.appendChild(script);

    return () => {
      document.removeEventListener('AppleIDSignInOnSuccess', onSuccess);
      document.removeEventListener('AppleIDSignInOnFailure', onFailure);
      const appleScript = document.querySelector('script[src*="appleid.auth.js"]');
      if (appleScript) document.body.removeChild(appleScript);
    };
  }, []);

  // This function is called by your button's onClick.
  const triggerAppleSignIn = () => {
    if (typeof AppleID !== 'undefined') {
      setLoading(true);
      AppleID.auth.signIn();
    } else {
      toast.error("Apple Sign-In is not ready. Please wait and try again.");
    }
  };

  return (
    <div className="relative min-h-screen w-full font-sans">
      <Toaster position="top-center" />
      
      {/* Background with app screenshots */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ 
          backgroundImage: "url('https://placehold.co/1200x800/e2e8f0/64748b?text=App+Screenshots+Here')",
          filter: 'blur(4px) brightness(0.9)'
        }}
      ></div>
      
      {/* Overlay to darken the background slightly */}
      <div className="absolute inset-0 bg-black bg-opacity-20 z-10"></div>

      {/* Main content container */}
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-end p-8">
        {!isRegistered ? (
          // ----- INITIAL VIEW -----
          <button
            type="button"
            onClick={triggerAppleSignIn}
            disabled={loading}
            className="bg-black bg-opacity-80 text-white font-semibold py-4 px-8 rounded-full shadow-lg hover:bg-opacity-100 transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Register for the App"}
          </button>
        ) : (
          // ----- SUCCESS VIEW -----
          <div className="bg-white bg-opacity-95 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in">
            <div className="mx-auto bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Registration Complete!</h1>
            <p className="text-gray-600 mt-2 mb-6">You're all set. Get the beta version from TestFlight.</p>
            <a
              href="https://testflight.apple.com/join/SxMFvSDj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-md"
            >
              Join TestFlight
            </a>
          </div>
        )}
      </div>
      
      {/* Adding a simple fade-in animation for the success card */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RegisterForIOS;
