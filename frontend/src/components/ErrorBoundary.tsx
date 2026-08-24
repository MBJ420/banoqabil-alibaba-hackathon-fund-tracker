import React from 'react';

interface Props {
    children: React.ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error(`ErrorBoundary (${this.props.name || 'route'}):`, error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-full p-8">
                    <div className="flex flex-col items-center gap-4 text-center max-w-md">
                        <div className="p-4 bg-danger/10 rounded-full">
                            <span className="text-danger text-2xl font-bold">!</span>
                        </div>
                        <h3 className="text-xl font-bold text-text-primary">Something went wrong</h3>
                        <p className="text-text-secondary text-sm">
                            {this.props.name || 'This section'} failed to load. The rest of the app is still available.
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="mt-2 px-4 py-2 bg-surface border border-[var(--color-white-10)] rounded-lg hover:bg-[var(--color-white-5)] text-text-primary text-sm transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
