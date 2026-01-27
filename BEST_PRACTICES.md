# Development Best Practices & Guidelines

This document outlines the coding standards and best practices for the MedResidency Prep project. Following these guidelines ensures code maintainability, performance, and scalability.

## 1. Code Structure & Organization

*   **Colocation:** Keep related files close. If a component is complex, give it its own folder with a `ComponentName.tsx` and related sub-components.
*   **Absolute Imports:** Always use the `@/` alias for internal imports to clarify dependencies.
    *   ✅ `import Button from "@/components/ui/button"`
    *   ❌ `import Button from "../../components/ui/button"`
*   **Barrel Exports:** Use `index.ts` files sparingly to group related exports (e.g., in `components/ui` or `lib`), but avoid extensive barrel files that can hurt tree-shaking.

## 2. React & Components

*   **Functional Components:** Write all components as functional components with strictly typed props.
*   **Composition over Inheritance:** Use `children` prop and slots to build flexible components rather than adding excessive conditional props.
*   **Encapsulation:** Logic specific to a component should live in a custom hook (e.g., `useAuthForm`) rather than cluttering the UI component.
*   **Fragments:** Use `<>` and `</>` instead of `<div>` when no extra DOM node is needed.

## 3. TypeScript Guidelines

*   **No Explicit `any`:** Avoid `any` at all costs. Use `unknown` or specific types (interfaces/types) to maintain type safety.
*   **Prop Types:** Define interface for Component Props.
    ```tsx
    interface UserCardProps {
      name: string;
      role?: 'admin' | 'user'; // Optional prop with union type
    }
    ```
*   **Strict Mode:** Aim to respect strict null checks. Handle `null` and `undefined` explicitly.

## 4. Performance

*   **Lazy Loading:** Use `React.lazy()` and `Suspense` for route-level splitting to reduce initial bundle size.
*   **Image Optimization:** Use modern formats (WebP) and define explicit width/height to prevent layout shift (CLS).
*   **Memoization:** use `useMemo` and `useCallback` only when necessary (e.g., heavy calculations or passing props to memoized child components). Don't premature optimize.

## 5. State Management

*   **Server State:** Use `TanStack Query` for all async data fetching. Do not store API data in `useEffect` + `useState` manually.
*   **Client State:** Keep state as local as possible. Lift state up only when siblings need to share data. Use Context for global app-wide state (Auth, Theme).

## 6. Styling (Tailwind CSS)

*   **Utility First:** Use utility classes for layout, spacing, and sizing.
*   **Consistency:** Use the theme variables (e.g., `bg-primary`, `text-destructive`) defined in `tailwind.config.ts` rather than hardcoded hex values. This ensures dark mode compatibility.
*   **CN Utility:** Use the `cn()` helper for conditional class merging.
    ```tsx
    <div className={cn("base-class", isActive && "active-class")} />
    ```

## 7. Git & Workflow

*   **Commit Messages:** Write clear, imperative commit messages (e.g., "Add login form", "Fix nav spacing").
*   **Clean PRs:** Review your own code before submitting. Remove `console.log` and commented-out code.

---

# Current Technical Stack Analysis

## Core Stack
*   **Frontend Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite (using SWC)
*   **Styling:** Tailwind CSS v3, PostCSS, `tailwindcss-animate`

## UI Components
*   **Radix UI:** Headless, accessible primitives
*   **Lucide React:** Iconography
*   **Shadcn/ui:** Component library pattern

## State & Routing
*   **Routing:** React Router DOM v6
*   **Server State:** TanStack Query (React Query) v5
*   **Client State:** React Context (`AuthProvider`)

## Backend & Integration
*   **BaaS:** Supabase (Auth, Database)
*   **Forms:** React Hook Form + Zod

## Testing & Quality
*   **Testing:** Vitest + React Testing Library
*   **Linting:** ESLint v9

---

# Specific Project Improvements

1.  **Lazy Loading Implementation**
    *   Transition from direct imports in `App.tsx` to `React.lazy()` + `Suspense`.
    *   Goal: Reduce initial bundle load time.

2.  **Type Safety Enhancements**
    *   Gradually strictness: Enable `strictNullChecks: true` in `tsconfig.json`.

3.  **Layout Pattern**
    *   Abstract repeated structures (Navbar, Footer) into a `MainLayout` component using `<Outlet />`.

4.  **SEO Management**
    *   Integrate `react-helmet-async` for managing `<title>` and `<meta>` tags dynamically per page.

5.  **Error Handling**
    *   Implement a global Error Boundary to gracefully handle runtime crashes.
