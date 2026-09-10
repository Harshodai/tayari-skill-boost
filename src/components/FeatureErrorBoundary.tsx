import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">
              {this.props.fallbackTitle || (this.props.sectionName ? `${this.props.sectionName} failed to load` : "Something went wrong")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            This section encountered an error. Try refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
