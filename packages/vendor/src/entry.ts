// Namespace import + destructuring, not named imports: react's CJS entry
// does a conditional `require()` for prod/dev builds, which Rollup can't
// statically verify named exports against. The namespace form is resolved
// at runtime instead, which @rollup/plugin-commonjs handles correctly.
import * as ReactNS from 'react';
import * as ReactDOMNS from 'react-dom';
import * as ReactDOMClientNS from 'react-dom/client';

const {
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = ReactNS;

const ReactExports = {
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
};

const { createPortal, flushSync } = ReactDOMNS;
const { createRoot, hydrateRoot } = ReactDOMClientNS;

const ReactDOMExports = {
  createPortal,
  flushSync,
  createRoot,
  hydrateRoot,
};

// Assigned via Object.assign rather than a `declare global` Window
// augmentation: @types/react's `export as namespace React` already
// creates an implicit global `React` binding, which TypeScript merges
// onto `Window` automatically — an explicit `interface Window { React }`
// here would collide with that and force this object to satisfy the
// *entire* React namespace's type instead of just this export list.
Object.assign(window, { React: ReactExports, ReactDOM: ReactDOMExports });
