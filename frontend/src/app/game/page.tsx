import { redirect } from 'next/navigation';

// Redirect /game → /dashboard since game requires an ID
export default function GameRedirectPage() {
  redirect('/dashboard');
}
