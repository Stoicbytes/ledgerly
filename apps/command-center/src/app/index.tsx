import { Redirect } from 'expo-router';

// On the deployed web site `/` is the public portfolio (vercel.json sends it to
// api/site.mjs), so this route is reached only in the phone apps and local development:
// it opens the dashboard, which asks for sign-in when Supabase is configured.
export default function Index() {
  return <Redirect href="/dashboard" />;
}
