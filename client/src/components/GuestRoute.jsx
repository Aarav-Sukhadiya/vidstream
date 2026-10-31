import { Navigate, useLocation, Outlet } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/useAuth';
import Spinner from './Spinner';

export default function GuestRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;
  if (user) {
    const from = location.state?.from;
    const destination = from ? `${from.pathname}${from.search || ''}` : '/';
    return <Navigate to={destination} replace />;
  }
  return children || <Outlet />;
}

GuestRoute.propTypes = {
  children: PropTypes.node,
};
