import { Component, type ReactNode } from 'react';

/** Lỗi ở một khu vực không làm hỏng toàn bộ giao diện (NFR-10). */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="notice error" role="alert">
            Đã xảy ra lỗi khi hiển thị phần này. <button className="btn small" onClick={() => this.setState({ error: null })}>Thử lại</button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
