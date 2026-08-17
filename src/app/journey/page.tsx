import type { Metadata } from 'next'
import { JourneyWorkspace } from '@/components/journey/JourneyWorkspace'
import { resolveJourneyServerUrl } from '@/lib/journey/server-url'

export const metadata: Metadata = {
  title: 'CubeSmart — Guided Move-In Journey',
  description:
    'A guided, narrative demo of an AI-native self-storage tenant experience across RCS, SMS and voice.',
}

export default function JourneyPage() {
  return <JourneyWorkspace serverUrl={resolveJourneyServerUrl()} />
}
