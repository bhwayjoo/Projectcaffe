import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const access = localStorage.getItem("access");
  const location = useLocation();

  if (!access) {
    // Redirect to login page while saving the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
