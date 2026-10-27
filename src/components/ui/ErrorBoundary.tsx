"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "An unexpected interface error occurred.",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] h-full w-full flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04]">
            <AlertTriangle className="h-5 w-5 text-zinc-200" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Workspace interrupted
          </h2>
          <p className="mt-1.5 max-w-sm text-xs text-zinc-400 leading-relaxed">
            {this.state.message}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-5"
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.reload();
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload workspace
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
