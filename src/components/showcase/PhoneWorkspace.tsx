'use client'

import { useTwilioDevice } from '@/hooks/use-webrtc'
import { BrowserCallDemo } from './BrowserCallDemo'
import { ConversationIntelligencePanel } from './ConversationIntelligencePanel'

export function PhoneWorkspace() {
  const { isReady, callStatus, handleCall, handleHangup, sendDigit } = useTwilioDevice()

  return (
    <>
      <BrowserCallDemo
        isReady={isReady}
        callStatus={callStatus}
        onCall={handleCall}
        onHangup={handleHangup}
        onSendDigit={sendDigit}
      />
      <ConversationIntelligencePanel callStatus={callStatus} />
    </>
  )
}
