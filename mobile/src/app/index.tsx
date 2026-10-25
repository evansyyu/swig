import { Redirect } from 'expo-router';

import { useAppState } from '@/data/store';

/** Entry point: send the session to the right place (the groups themselves are guarded). */
export default function Index() {
  const signedIn = useAppState((s) => s.token !== null);
  const onboarded = useAppState((s) => s.onboarded);
  return <Redirect href={!signedIn ? '/sign-up' : onboarded ? '/today' : '/goal'} />;
}
