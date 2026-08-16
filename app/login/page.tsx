import { Suspense } from "react";
import LoginForm from "./login-form";

// useSearchParams() (read inside LoginForm, for the ?error=not_authorized
// redirect from requireAdmin()) opts the page out of static rendering
// unless wrapped in Suspense — without this, `next build` fails to
// prerender /login entirely.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
