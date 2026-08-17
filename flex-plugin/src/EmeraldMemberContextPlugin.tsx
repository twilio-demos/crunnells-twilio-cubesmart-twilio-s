import React from 'react'
import * as Flex from '@twilio/flex-ui'
import { FlexPlugin } from '@twilio/flex-plugin'
import { MemberContextPanel } from './components/MemberContextPanel'
import { MemberSummary } from './components/MemberSummary'

const PLUGIN_NAME = 'CubeSmartTenantContextPlugin'

export class CubeSmartTenantContextPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME)
  }

  init(flex: typeof Flex): void {
    // The big empty panel beside the call becomes the tenant's record.
    flex.CRMContainer.Content.replace(<MemberContextPanel key="cubesmart-tenant-context" />)

    // And a condensed version rides along in the task's Info tab.
    flex.TaskInfoPanel.Content.add(<MemberSummary key="cubesmart-tenant-summary" />, {
      sortOrder: -1,
    })
  }
}

// Kept as an alias so the old import name still resolves.
export const EmeraldMemberContextPlugin = CubeSmartTenantContextPlugin
