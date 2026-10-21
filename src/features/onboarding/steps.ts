import type { UserTab, WatcherTab } from '../../store';

export interface OnboardingStep {
  id: string;
  tab: UserTab | WatcherTab;
  target: string;
  title: string;
  body: string;
}

export const USER_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'map',
    tab: 'map',
    target: 'user-map',
    title: 'Your night, at a glance',
    body: 'Your map shows your location and meet-up spot. Start a Night Out here to share your location with your Night Buddies and get check-ins.',
  },
  {
    id: 'buddies',
    tab: 'buddies',
    target: 'user-buddies',
    title: 'Stay connected with your buddies',
    body: 'See who is in your session and their latest status. Your location is shared with Night Buddies only during an active Night Out.',
  },
  {
    id: 'drinks',
    tab: 'drinks',
    target: 'user-drinks',
    title: 'Keep track of your drinks',
    body: 'Log a drink manually or scan it with your camera. Your totals and pace help you keep an eye on the evening.',
  },
  {
    id: 'me',
    tab: 'me',
    target: 'user-me',
    title: 'Your safety settings',
    body: 'Set a quick status and choose your check-in interval here. During a Night Out, SafeSip can check that you are okay, and the SOS button is ready if you need help.',
  },
];

export const WATCHER_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'map',
    tab: 'map',
    target: 'watcher-map',
    title: 'See how their night is going',
    body: 'The map and session card show a linked person’s location and well-being during a Night Out. When they are not out, their location stays private.',
  },
  {
    id: 'updates',
    tab: 'map',
    target: 'watcher-updates',
    title: 'Get the updates that matter',
    body: 'Quiet updates cover session changes, while emergency alerts always sound—even when the phone is on silent. This list may be empty when things are quiet.',
  },
  {
    id: 'me',
    tab: 'me',
    target: 'watcher-me',
    title: 'Manage your notifications',
    body: 'Quiet Updates can be switched off. Emergency Alerts stay on so you can respond if someone needs help.',
  },
];

export function onboardingStepsFor(role: 'user' | 'watcher') {
  return role === 'user' ? USER_ONBOARDING_STEPS : WATCHER_ONBOARDING_STEPS;
}
