import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useCareerStore } from './store';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * A render crash used to white-screen the whole PWA. Recover to the menu
 * without wiping the save so Continue can be tried again after a fix ships.
 */
export class CareerErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Career render failed', error, info.componentStack);
  }

  private returnToMenu = () => {
    try {
      useCareerStore.getState().returnToMenu();
    } catch (err) {
      console.error('Could not return to menu', err);
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
        <p className="text-sm text-white/70">This career could not load.</p>
        <p className="max-w-xs text-xs text-white/40">
          Your save is still here. Open the menu, then continue after a refresh.
        </p>
        <button
          type="button"
          onClick={this.returnToMenu}
          className="text-sm text-emerald-300 underline underline-offset-2"
        >
          Menu
        </button>
      </div>
    );
  }
}
