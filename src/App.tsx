import CareerApp from './game/career/CareerApp';
import { CareerErrorBoundary } from './game/career/CareerErrorBoundary';

function App() {
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-transparent">
      <CareerErrorBoundary>
        <CareerApp />
      </CareerErrorBoundary>
    </div>
  );
}

export default App;
