/**
 * Smoke test for the Flex plugin bundle.
 *
 * Stubs the two globals Flex provides (window.React and window.Twilio.Flex),
 * loads the bundle, then walks the component tree it registers with a realistic
 * task payload. Catches runtime errors in the render path without needing Flex.
 */
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('/tmp/emerald-flex-plugin.js', 'utf8');

const captured = { pluginClass: null, crm: null, info: null };

function createElement(type, props) {
  const children = Array.prototype.slice.call(arguments, 2);
  return { type, props: props || {}, children };
}

const flexStub = {
  withTaskContext: (c) => c,
  Plugins: {
    init: (PluginClass) => {
      captured.pluginClass = PluginClass;
    },
  },
  CRMContainer: { Content: { replace: (el) => (captured.crm = el) } },
  TaskInfoPanel: { Content: { add: (el) => (captured.info = el) } },
};

const windowStub = {
  React: { createElement },
  Twilio: { Flex: flexStub },
  console,
};
windowStub.window = windowStub;

vm.runInNewContext(source, windowStub);

if (!captured.pluginClass) throw new Error('Plugin never called Twilio.Flex.Plugins.init');

const instance = new captured.pluginClass();
instance.init(flexStub);

if (!captured.crm) throw new Error('Plugin did not replace the CRM container');
if (!captured.info) throw new Error('Plugin did not add to the task info panel');

const task = {
  taskSid: 'WT00000000000000000000000000000000',
  attributes: {
    type: 'inbound',
    direction: 'inbound',
    name: 'John Ellison',
    customerName: 'John Ellison',
    from: '+18325551234',
    called: '+18668144982',
    customers: { phone: '+18325551234', name: 'John Ellison' },
    escalated_by: 'Emerald Fitness voice AI',
    escalation_reason: 'Card on file expired, cannot reinstate membership on this line',
    ai_summary:
      'John is back in town and wants off his 60 day hold. The Visa on file expired so the reinstatement charge failed. He needs a new card taken by a human.',
    emerald: {
      studio: 'Emerald Fitness — West 7th, Denver',
      membership_tier: 'Emerald Unlimited',
      membership_status: 'on-hold',
      hold_start: 'Monday, Aug 4',
      hold_end: 'Friday, Oct 3',
      hold_days: 60,
      payment_status: 'expired',
      card_on_file: 'Visa •••• 4417 exp 09/26',
      failed_charge: '$189.00',
      classes_booked: 2,
      class_history: [
        'SURGE 45 · Tuesday Aug 5 6:00 AM (attended)',
        'RISE + LIFT 50 · Thursday Aug 7 5:30 PM (cancelled)',
      ],
      favourite_shake: 'Emerald Recovery',
      last_instructor_rating: 5,
      memory_profile_id: 'prof_abc123',
      memory_store_id: 'mem_store_abc',
    },
    recent_transcript: [
      'John: Hey, I am back in town, can you take my membership off hold?',
      'Voice AI: That is great news, welcome back.',
    ],
    intelligence: {
      call_reason: 'Come off hold',
      call_reason_confidence: 92,
      call_reason_evidence: 'can you take my membership off hold',
      sentiment: 'negative',
      sentiment_trail: ['positive', 'neutral', 'negative'],
      retention_risk_score: 71,
      retention_risk_band: 'elevated',
      retention_risk_drivers: [
        'Says she is not using it',
        'Not seeing results',
        'Payment declined',
      ],
      retention_risk_quote: 'Honestly I am not sure it is worth it, I barely go',
      retention_risk_trend: 'rising',
      next_best_action: {
        headline: 'Win back with a free class',
        offer:
          'Offer one complimentary class plus a fifteen minute coaching reset with a lead instructor, booked together before she hangs up.',
        rationale:
          'She is coming off a hold, attendance is low and she has just had a payment decline.',
        policy_source: 'Approved save offers — win-back class and coaching reset',
        urgency: 'before the call ends',
      },
      operator_runs: 9,
      last_operator: 'Emerald Retention Risk',
      last_latency_ms: 1840,
    },
  },
};

/** Depth-first render of the stub element tree, invoking function components. */
let nodes = 0;
const textFound = [];

function render(node, depth) {
  if (node === null || node === undefined || node === false) return;
  if (depth > 60) throw new Error('Render depth exceeded — probable infinite recursion');
  if (typeof node === 'string' || typeof node === 'number') {
    textFound.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => render(n, depth + 1));
    return;
  }
  if (!node.type) return;
  nodes += 1;
  if (typeof node.type === 'function') {
    const props = Object.assign({}, node.props, { task });
    if (node.children && node.children.length) props.children = node.children;
    render(node.type(props), depth + 1);
    return;
  }
  render(node.children, depth + 1);
}

render(captured.crm, 0);
const crmNodes = nodes;
render(captured.info, 0);

const joined = textFound.join(' | ');
const mustContain = [
  'John Ellison',
  'Emerald Unlimited',
  'On hold',
  'Visa •••• 4417 exp 09/26',
  '$189.00',
  'Emerald Recovery',
  '60 days',
  'Friday, Oct 3',
  'SURGE 45 · Tuesday Aug 5 6:00 AM (attended)',
  'Come off hold',
  'Elevated risk · rising',
  '71',
  'Not seeing results',
  'Win back with a free class',
  'Approved save offers — win-back class and coaching reset',
];

const missing = mustContain.filter((s) => joined.indexOf(s) === -1);
if (missing.length) {
  console.error('Rendered text:\n', joined);
  throw new Error('Panel did not render: ' + missing.join(', '));
}

// And the no-task state must not explode.
const emptyTask = null;
function renderEmpty(node, depth) {
  if (!node || typeof node !== 'object') return;
  if (depth > 40) throw new Error('depth');
  if (typeof node.type === 'function') {
    renderEmpty(node.type(Object.assign({}, node.props, { task: emptyTask })), depth + 1);
    return;
  }
  (node.children || []).forEach((c) => renderEmpty(c, depth + 1));
}
renderEmpty(captured.crm, 0);
renderEmpty(captured.info, 0);

console.log('plugin uniqueName :', instance.uniqueName);
console.log('plugin version   :', instance.version);
console.log('CRM panel nodes  :', crmNodes);
console.log('info panel nodes :', nodes - crmNodes);
console.log('PLUGIN_RENDER_OK');
