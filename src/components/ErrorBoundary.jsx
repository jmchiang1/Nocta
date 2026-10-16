/* Nocta — if one part of the app throws, show a calm recovery message there
 * instead of a blank screen. `onReset` (e.g. close the sheet) is offered as
 * the way out; reloading is always offered too. */
import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Nocta] a screen failed to draw', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { onReset, label = 'Close' } = this.props;
    return (
      <div className="err-box" role="alert">
        <h3>Something went wrong here</h3>
        <p>This part of Nocta couldn’t load. Your data is safe on this device.</p>
        <div className="err-actions">
          {onReset && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                this.setState({ error: null });
                onReset();
              }}
            >
              {label}
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
