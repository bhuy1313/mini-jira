type Listener = () => void;

const listeners = new Set<Listener>();

export function startNavigation() {
  for (const listener of listeners) listener();
}

export function subscribeNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}