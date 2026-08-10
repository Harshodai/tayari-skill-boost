import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <Layout>
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-6xl font-bold">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">This page drifted off the map.</p>
        <div className="flex gap-3">
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">Contact support</Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
