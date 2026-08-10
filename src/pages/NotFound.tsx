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
          {/* ponytail: Button asChild renders the Link as the interactive element — avoids nested <a><button> (a11y violation) */}
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
