declare module 'react' {
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useState<T>(value: T): [T, (value: T) => void];
  export const StrictMode: any;
}

declare module 'react-dom/client' {
  export function createRoot(element: HTMLElement): {
    render(node: any): void;
  };
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
