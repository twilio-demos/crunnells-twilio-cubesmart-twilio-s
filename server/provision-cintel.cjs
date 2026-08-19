/**
 * One-off provisioning for the CubeSmart real-time Conversation Intelligence layer.
 *
 * Creates (idempotently, by display name):
 *   1. An Enterprise Knowledge base + the store's retention / save playbook as raw text
 *   2. Three custom Language Operators — call reason, churn risk, next best action
 *   3. An intelligence configuration with two rules that post results to the journey service
 *   4. Appends that configuration to the live conversation configuration (append only)
 *
 * Run:  node server/provision-cintel.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

/* ------------------------------------------------------------------ *
 * Env
 * ------------------------------------------------------------------ */

function loadEnv() {
  const out = {};
  for (const file of ['/home/project/.env', '/home/project/server/.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in out)) out[key] = value;
    }
  }
  return out;
}

const env = loadEnv();
const KEY = env.TWILIO_API_KEY;
const SECRET = env.TWILIO_API_SECRET;
const DOMAIN = env.TWILIO_VOICE_PUBLIC_DOMAIN;
const CONV_CONFIG_ID = env.TWILIO_CONVERSATION_CONFIGURATION_ID;

if (!KEY || !SECRET) {
  console.error('Missing TWILIO_API_KEY / TWILIO_API_SECRET');
  process.exit(1);
}
if (!DOMAIN) {
  console.error('Missing TWILIO_VOICE_PUBLIC_DOMAIN — needed for the results webhook URL');
  process.exit(1);
}

const WEBHOOK_URL = `https://${DOMAIN}/journey/cintel`;
const AUTH = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: AUTH,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status} ${text}`);
  }
  return json;
}

const INTEL = 'https://intelligence.twilio.com/v3/ControlPlane';
const KNOW = 'https://knowledge.twilio.com/v2';
const CONV = 'https://conversations.twilio.com/v2/ControlPlane';

/* ------------------------------------------------------------------ *
 * 1. Enterprise Knowledge — the store's own retention playbook
 * ------------------------------------------------------------------ */

const KB_NAME = 'cubesmart-storage';
// Knowledge sources are created by name and reused, so the playbook is versioned:
// bump the suffix whenever the policy text changes. Older versions are removed so
// the operators are never grounded in two contradictory playbooks at once.
const SOURCE_NAME = 'retention-playbook-v1';
const SOURCE_PREFIX = 'retention-';

const PLAYBOOK = `# CubeSmart — Tenant Retention & Save Playbook
West 7th store, Denver. Effective this season. Applies to every tenant conversation on
voice, SMS and RCS, and to both the AI voice agent and the store team.

## 1. Extended after-hours gate access
- Tenants locked out after hours may be granted extended gate access for 1 day (tonight only),
  7 days (this week), or a standing 30 days. No other lengths are offered.
- Standard rent still applies during an extended access window — this is an access accommodation,
  not a billing change.
- The access end date must be read back out loud and confirmed before it is granted.

## 2. Checking in on an account / autopay
- If the card on file has expired or a rent charge is declined, staff must NEVER take card details
  over the phone. The tenant is warm-transferred to the store team, who take payment on a secure
  terminal or send a secure payment link.
- Never tell a tenant to call back later or during business hours. Somebody handles it now.

## 3. Approved save offers — store team and above
These may be offered by a human team member. The AI voice agent must NOT offer them; it hands the
tenant to the store team with the recommendation attached.
- 20% RENT DISCOUNT: 20% off monthly rent for the next 3 months. Approved for any tenant checking in
  on autopay who mentions a competitor or a cheaper rate, any tenant who says they are not sure the
  unit is worth the money, and any tenant showing signs of moving out.
- UNIT DOWNSIZE: a free move to a smaller unit (e.g. 10x10 to 5x10) at the smaller unit's rate,
  waiving the standard transfer fee. Approved for tenants who say they have less to store than they
  thought, or who are choosing between downsizing and leaving entirely.
- The 20% discount and the unit downsize are ALTERNATIVES, not a bundle — offer the discount first
  unless the tenant has clearly said she wants a smaller unit. Tenants offered a meaningful discount
  or a right-sized unit renew at materially higher rates than tenants given no offer at all.
- FEE WAIVER: a declined-payment or late fee may be waived once per lease year at the store's
  discretion.

## 4. Never offered
- No discount deeper than 20% off, and never for longer than 3 months, without a manager.
- No refunds for elapsed months.
- No free months of rent outright (the 20% discount and unit downsize are the only two levers).
- No promises about specific unit availability beyond what is confirmed in the CubeSmart Management Platform.
- No guarantees about insurance claims — refer tenants to the insurance provider for claim
  questions.

## 5. What raises retention risk
- Naming a competitor or a cheaper storage option down the street.
- Any statement that they are not using the unit, not sure it is worth it, or thinking about
  moving out.
- A second extended-access request inside the same lease year.
- A failed or declined autopay charge, especially combined with any of the above.
- Rent increases mentioned negatively by the tenant.
- Risk of 60 or more out of 100 is the point at which the store treats the tenant as an active
  churn risk, records it against their profile, and expects the store team to make the standard
  save.

## 6. Tone
- Lead with the good news, then the blocker. Never open with a problem.
- Acknowledge frustration in the tenant's own words before offering anything.
- One or two sentences at a time. Never read a policy number out loud to a tenant.
`;

async function ensureKnowledge() {
  const bases = await call('GET', `${KNOW}/ControlPlane/KnowledgeBases`);
  let base = (bases.knowledgeBases || []).find((b) => b.displayName === KB_NAME);

  if (!base) {
    const created = await call('POST', `${KNOW}/ControlPlane/KnowledgeBases`, {
      displayName: KB_NAME,
      description: 'CubeSmart store policies, retention playbook and approved save offers.',
    });
    base = created && created.id ? created : created?.knowledgeBase;
    if (!base?.id) {
      const again = await call('GET', `${KNOW}/ControlPlane/KnowledgeBases`);
      base = (again.knowledgeBases || []).find((b) => b.displayName === KB_NAME);
    }
    console.log(`  created knowledge base ${base.id}`);
  } else {
    console.log(`  reusing knowledge base ${base.id}`);
  }

  const sources = await call('GET', `${KNOW}/KnowledgeBases/${base.id}/Knowledge`);
  const existingSources = sources.knowledge || sources.items || [];
  let source = existingSources.find((s) => s.name === SOURCE_NAME);

  // Retire any earlier version of the playbook so the operators only ever see one.
  for (const stale of existingSources) {
    if (!stale?.name || !stale.id) continue;
    if (stale.name === SOURCE_NAME) continue;
    if (!stale.name.startsWith(SOURCE_PREFIX)) continue;
    try {
      await call('DELETE', `${KNOW}/KnowledgeBases/${base.id}/Knowledge/${stale.id}`);
      console.log(`  retired old playbook ${stale.name}`);
    } catch (err) {
      console.log(`  could not retire ${stale.name}: ${err.message}`);
    }
  }

  if (!source) {
    const attempts = [
      { type: 'Text', content: PLAYBOOK },
      { content: PLAYBOOK },
    ];
    let lastError = null;
    for (const src of attempts) {
      try {
        const created = await call('POST', `${KNOW}/KnowledgeBases/${base.id}/Knowledge`, {
          name: SOURCE_NAME,
          description:
            'Access windows, autopay rules, approved save offers (20% rent discount or unit downsize), what is never offered, and the store risk signals.',
          source: src,
        });
        source = created && created.id ? created : created?.knowledge;
        if (!source?.id) {
          const again = await call('GET', `${KNOW}/KnowledgeBases/${base.id}/Knowledge`);
          source = (again.knowledge || again.items || []).find((s) => s.name === SOURCE_NAME);
        }
        if (source?.id) break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!source) throw lastError ?? new Error('Knowledge source was not created');
    console.log(`  created knowledge source ${source.id}`);
  } else {
    console.log(`  reusing knowledge source ${source.id}`);
  }

  return { baseId: base.id, sourceId: source.id };
}

/* ------------------------------------------------------------------ *
 * 2. Custom operators
 * ------------------------------------------------------------------ */

const REASON_LABELS = [
  'Locked out / gate access',
  'Check in on account',
  'Payment or autopay problem',
  'Book a move-in',
  'Move or cancel a reservation',
  'Thinking about moving out',
  'Unit or pricing question',
  'Supply Shop order',
  'Something else',
  'Not clear yet',
];

const OPERATORS = [
  {
    displayName: 'CubeSmart Call Reason',
    description:
      'Resolves why the tenant is calling CubeSmart, as early in the conversation as possible.',
    outputFormat: 'JSON',
    context: { memory: { enabled: true }, knowledge: { enabled: false } },
    outputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: REASON_LABELS },
        confidence: {
          type: 'number',
          description: 'How certain you are, from 0 to 1.',
        },
        evidence: {
          type: 'string',
          description: 'The tenant\u2019s own words that told you. Empty if they have not said yet.',
        },
      },
    },
    prompt: `You are listening to a live conversation between a tenant of CubeSmart, a self-storage company, and the store's line.

Decide why the TENANT is making contact. Judge only what the tenant themselves has said. The agent asking a question, offering something, or reading anything back is never evidence of the tenant's reason.

Rules:
- Return "Not clear yet" with a confidence of 0 until the tenant has actually stated a need. A greeting, a hello, background noise, or a single word is not a reason.
- "Locked out / gate access" means they cannot get into the facility and need their gate code reset.
- "Check in on account" means they are calling to confirm their account or access status is normal.
- "Thinking about moving out" is only for an explicit intent to vacate or end the lease, not for general frustration.
- Never infer a reason from the agent's suggestions.
- Keep evidence to a short quote of the tenant's words. Leave it empty when the reason is "Not clear yet".`,
  },
  {
    displayName: 'CubeSmart Retention Risk',
    description:
      'Scores how likely this tenant is to leave CubeSmart, live, with the reasons behind the score.',
    outputFormat: 'JSON',
    context: { memory: { enabled: true }, knowledge: { enabled: true } },
    outputSchema: {
      type: 'object',
      properties: {
        score: {
          type: 'integer',
          description: 'Retention risk from 0 (no risk) to 100 (about to leave).',
        },
        band: { type: 'string', enum: ['low', 'watch', 'elevated', 'high'] },
        drivers: {
          type: 'array',
          description: 'Short phrases naming what is driving the score. Empty when the score is low.',
          items: { type: 'string' },
        },
        quote: {
          type: 'string',
          description: 'The single most telling thing the tenant said. Empty if nothing yet.',
        },
        trend: { type: 'string', enum: ['rising', 'steady', 'falling'] },
      },
    },
    prompt: `You are scoring live retention risk for a tenant of CubeSmart, a self-storage company, while they are still on the phone.

The conversation may be with an AI agent or with a human store team member. Score it exactly the same way either way.

Score from 0 to 100, where 0 is a happy engaged tenant and 100 is a tenant about to leave. Bands: 0-24 low, 25-49 watch, 50-74 elevated, 75-100 high.

Raise the score for things the TENANT says or that are true of their record:
- Saying they found a cheaper unit, a better rate, or naming a competitor down the street.
- Saying they are not sure the unit is worth the money, or are not really using it.
- Asking about moving out, vacating, or ending the lease.
- Complaining about a rent increase.
- A failed or declined autopay charge, especially combined with any of the above.
- A second extended-access request within the same lease year.
- Audible frustration, resignation or repeated dissatisfaction.

Do not raise the score for:
- A routine after-hours access request with a clear practical reason such as a late move.
- A single logistical question, a reservation change, or ordinary small talk.
- Anything the agent said, human or AI. Only the tenant's own words and record count.

Floors you must not go below once the tenant has said it, even if she is polite about it:
- She mentions cancelling, moving out, vacating or not renewing her lease, or asks how to end it: at least 75. Explicit move-out talk is a high-risk tenant, no matter how calm she sounds.
- She names a competitor, a cheaper unit, or says she is not sure it is worth the money: at least 60.
- These floors are permanent for the rest of the call. Never lower the score back down because a later part of the conversation went smoothly, and never let a helpful agent or a resolved payment reduce it.

Start low and only move as evidence appears. Set trend by comparing with how the conversation opened. Keep each driver under eight words, phrased as a fact about the tenant. Return an empty drivers list and an empty quote ONLY while the score is still in the low band — from 25 upwards you must always name at least one driver and quote the tenant's own words that moved the score.`,
  },
  {
    displayName: 'CubeSmart Next Best Action',
    description:
      'Recommends the save offer a human should make, grounded in the store retention playbook.',
    outputFormat: 'JSON',
    context: { memory: { enabled: true }, knowledge: { enabled: true } },
    outputSchema: {
      type: 'object',
      properties: {
        recommend: {
          type: 'boolean',
          description: 'True only when there is a genuine reason to make an offer right now.',
        },
        headline: {
          type: 'string',
          description: 'Six words or fewer naming the save, e.g. "20% discount for 3 months".',
        },
        offer: {
          type: 'string',
          description: 'Exactly what to offer, in words the agent could say out loud.',
        },
        rationale: {
          type: 'string',
          description: 'One sentence on why this tenant, right now.',
        },
        policy_source: {
          type: 'string',
          description: 'The part of the store playbook this comes from.',
        },
        urgency: { type: 'string', enum: ['now', 'before the call ends', 'follow up later'] },
      },
    },
    prompt: `You are the live co-pilot for the CubeSmart store team. A tenant is on the phone right now, either with the AI agent or already with a human team member. Recommend the single next best SAVE OFFER a human team member should make.

You recommend GOODWILL, never PROCEDURE. The store team already knows how to do its job.

THE ONLY THING YOU MAY EVER RECOMMEND is an approved save offer from the "Approved save offers" section of the store playbook available to you as knowledge. In practice that means EITHER the 20% RENT DISCOUNT for 3 months OR a free UNIT DOWNSIZE — never both at once, offer the discount first unless she has clearly said she wants a smaller unit. A fee waiver may be added when a payment fee is involved. If no approved save offer applies, set recommend to false and return empty strings. There is no third option.

NEVER recommend any of the following, under any wording. These are process, not a save, and recommending them is a failure:
- Transferring, warm transferring, bringing her to the store team, or connecting her to anyone.
- Taking a card, updating a card, a secure terminal, a payment link, re-running a charge, or collecting payment in any form.
- Resetting, extending or releasing gate access, or granting a new access window.
- Calling her back, following up later, or noting anything on her account.
- Anything the playbook lists as never offered: discounts deeper than 20%, refunds, free months outright, insurance claim guarantees.

An expired card or a failed autopay charge is PROCEDURE on its own — it is not a reason to recommend anything. It only matters as an extra risk factor alongside something the tenant actually said.

Recommend the standard save (20% discount for 3 months, or a unit downsize) as soon as ANY of these is true:
- She names a competitor, a cheaper unit, or a better rate down the street.
- She says she is not sure the unit is worth the money, or is not really using it.
- She mentions moving out, vacating, or ending her lease.
- She says she has less to store than she thought and is considering downsizing.

Rules:
- Set recommend to false, with empty strings, whenever the conversation is routine. A tenant asking for after-hours gate access for a late move is ROUTINE. A tenant checking in on her account and simply needing her card updated, with no complaint about price or competitors, is ALSO ROUTINE — recommend nothing. Do not manufacture a save.
- policy_source must name the approved save offers section of the playbook in plain words. Never cite the access-window rules or the autopay rules as the source of a save.
- The offer must be goodwill a human at the store can say and honour immediately.
- Keep the offer to two sentences at most. No greetings, no sign-offs, no markdown.`,
  },
];

async function ensureOperators() {
  const existing = await call('GET', `${INTEL}/Operators?PageSize=50`);
  const byName = new Map((existing.items || []).map((o) => [o.displayName, o]));
  const ids = {};

  for (const spec of OPERATORS) {
    const found = byName.get(spec.displayName);
    if (found) {
      const updated = await call('PUT', `${INTEL}/Operators/${found.id}`, {
        ...spec,
        author: 'SELF',
        version: found.version,
      }).catch((err) => {
        console.log(`  could not update ${spec.displayName}: ${err.message}`);
        return found;
      });
      ids[spec.displayName] = updated.id || found.id;
      console.log(`  reusing operator ${spec.displayName} → ${ids[spec.displayName]}`);
      continue;
    }
    const created = await call('POST', `${INTEL}/Operators`, { ...spec, author: 'SELF' });
    ids[spec.displayName] = created.id;
    console.log(`  created operator ${spec.displayName} → ${created.id}`);
  }

  return ids;
}

/* ------------------------------------------------------------------ *
 * 3. Intelligence configuration
 * ------------------------------------------------------------------ */

const CONFIG_NAME = 'cubesmart-realtime';
const TWILIO_SENTIMENT = 'intelligence_operator_01kcrvw16kfa88qvgrfmr7y151';

function buildRules(operatorIds, knowledge) {
  const action = { type: 'WEBHOOK', method: 'POST', url: WEBHOOK_URL };
  const memoryOnly = { memory: { enabled: true } };
  const withKnowledge = {
    memory: { enabled: true },
    knowledge: { bases: [knowledge.baseId] },
  };

  return [
    {
      // Fast signals — resolve the reason and read the room on every turn.
      operators: [
        { id: operatorIds['CubeSmart Call Reason'] },
        { id: TWILIO_SENTIMENT },
      ],
      triggers: [{ on: 'COMMUNICATION', parameters: { count: 1 } }],
      actions: [action],
      context: memoryOnly,
    },
    {
      // Heavier signals — risk and the recommended play, grounded in the playbook.
      operators: [
        { id: operatorIds['CubeSmart Retention Risk'] },
        { id: operatorIds['CubeSmart Next Best Action'] },
      ],
      triggers: [{ on: 'COMMUNICATION', parameters: { count: 2 } }],
      actions: [action],
      context: withKnowledge,
    },
  ];
}

async function ensureConfiguration(operatorIds, knowledge) {
  const list = await call('GET', `${INTEL}/Configurations`);
  const found = (list.items || []).find((c) => c.displayName === CONFIG_NAME);
  const payload = {
    displayName: CONFIG_NAME,
    description: 'Live call reason, sentiment, retention risk and next best action for the CubeSmart guided move-in journey.',
    rules: buildRules(operatorIds, knowledge),
  };

  if (found) {
    const updated = await call('PUT', `${INTEL}/Configurations/${found.id}`, payload);
    console.log(`  updated intelligence configuration ${found.id}`);
    return updated.id || found.id;
  }

  const created = await call('POST', `${INTEL}/Configurations`, payload);
  console.log(`  created intelligence configuration ${created.id}`);
  return created.id;
}

/* ------------------------------------------------------------------ *
 * 4. Attach to the live conversation configuration (append only)
 * ------------------------------------------------------------------ */

async function attachToConversationConfiguration(configId) {
  if (!CONV_CONFIG_ID) {
    console.log('  no TWILIO_CONVERSATION_CONFIGURATION_ID set — skipping attach');
    return false;
  }

  const list = await call('GET', `${CONV}/Configurations`);
  const current = (list.configurations || []).find((c) => c.id === CONV_CONFIG_ID);
  if (!current) {
    console.log(`  conversation configuration ${CONV_CONFIG_ID} not found — skipping attach`);
    return false;
  }

  const before = current.intelligenceConfigurationIds || [];
  console.log('  before:', JSON.stringify(before));

  if (before.includes(configId)) {
    console.log('  already attached, nothing to do');
    return true;
  }

  const body = {
    displayName: current.displayName,
    description: current.description,
    conversationGroupingType: current.conversationGroupingType,
    memoryStoreId: current.memoryStoreId,
    memoryExtractionEnabled: current.memoryExtractionEnabled,
    channelSettings: current.channelSettings,
    statusCallbacks: current.statusCallbacks,
    intelligenceConfigurationIds: [...before, configId],
  };
  if (current.conversationsV1Bridge) body.conversationsV1Bridge = current.conversationsV1Bridge;

  const updated = await call('PUT', `${CONV}/Configurations/${CONV_CONFIG_ID}`, body);
  console.log('  after: ', JSON.stringify(updated.intelligenceConfigurationIds || []));
  return true;
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

(async () => {
  console.log(`Results webhook: ${WEBHOOK_URL}\n`);

  console.log('1. Enterprise Knowledge');
  const knowledge = await ensureKnowledge();

  console.log('\n2. Language Operators');
  const operatorIds = await ensureOperators();

  console.log('\n3. Intelligence configuration');
  const configId = await ensureConfiguration(operatorIds, knowledge);

  console.log('\n4. Conversation configuration');
  await attachToConversationConfiguration(configId);

  console.log('\n--- env values ---');
  console.log(`CUBESMART_INTEL_CONFIG_ID=${configId}`);
  console.log(`CUBESMART_KNOWLEDGE_BASE_ID=${knowledge.baseId}`);
  console.log(`CUBESMART_OP_CALL_REASON=${operatorIds['CubeSmart Call Reason']}`);
  console.log(`CUBESMART_OP_RETENTION_RISK=${operatorIds['CubeSmart Retention Risk']}`);
  console.log(`CUBESMART_OP_NEXT_BEST_ACTION=${operatorIds['CubeSmart Next Best Action']}`);
  console.log(`CUBESMART_OP_SENTIMENT=${TWILIO_SENTIMENT}`);
})().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
