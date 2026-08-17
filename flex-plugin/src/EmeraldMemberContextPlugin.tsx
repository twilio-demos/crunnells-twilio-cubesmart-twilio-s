import React from 'react'
import * as Flex from '@twilio/flex-ui'
import { FlexPlugin } from '@twilio/flex-plugin'
import { MemberContextPanel } from './components/MemberContextPanel'
import { MemberSummary } from './components/MemberSummary'

const PLUGIN_NAME = 'EmeraldMemberContextPlugin'

export class EmeraldMemberContextPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME)
  }

  init(flex: typeof Flex): void {
    // The big empty panel beside the call becomes the member's record.
    flex.CRMContainer.Content.replace(<MemberContextPanel key="emerald-member-context" />)

    // And a condensed version rides along in the task's Info tab.
    flex.TaskInfoPanel.Content.add(<MemberSummary key="emerald-member-summary" />, {
      sortOrder: -1,
    })
  }
}
