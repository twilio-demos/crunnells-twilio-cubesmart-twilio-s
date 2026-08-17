/**
 * One-off provisioning for the Emerald Fitness real-time Conversation Intelligence layer.
 *
 * Creates (idempotently, by display name):
 *   1. An Enterprise Knowledge base + the studio's retention / save playbook as raw text
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
 * 1. Enterprise Knowledge — the studio's own playbook
 * ------------------------------------------------------------------ */

const KB_NAME = 'emerald-fitness';
// Knowledge sources are created by name and reused, so the playbook is versioned:
// bump the suffix whenever the policy text changes. Older versions are removed so
// the operators are never grounded in two contradictory playbooks at once.
const SOURCE_NAME = 'retention-playbook-v2';
const SOURCE_PREFIX = 'retention-';

const PLAYBOOK = `# Emerald Fitness — Membership Retention & Save Playbook
West 7th studio, Fort Worth. Effective this season. Applies to every member conversation on
voice, SMS and RCS, and to both the AI voice agent and the front desk team.

## 1. Membership holds
- Members may place their membership on hold for 30, 60 or 90 days. No other lengths are offered.
- Nothing bills during a hold and the member's original rate is locked for the duration.
- The hold end date must be read back out loud and confirmed before it is placed.
- A hold is always offered before a cancellation is processed. Holds retain roughly three times as
  many members as cancellations at this studio.

## 2. Coming off hold
- Reinstatement charges the member's card on file on the day the hold is released.
- If the card on file has expired or the charge is declined, staff must NEVER take card details
  over the phone. The member is warm-transferred to the front desk, who take payment on a secure
  terminal or send a secure payment link.
- Never tell a member to call back later or during business hours. Somebody handles it now.

## 3. Approved save offers — front desk and above
These may be offered by a human team member. The AI voice agent must NOT offer them; it hands the
member to the desk with the recommendation attached.
- ONE-TIME CLASS CREDIT: a single complimentary class credit, any format, valid 30 days. Approved for
  any member coming off hold, any member who has attended fewer than four classes in the last 60
  days, any member who says they are not getting value, and any member who was hurt in a class.
- PERSONAL COACHING CONSULTATION: a complimentary 15 minute one-to-one coaching consultation with a
  lead instructor, booked alongside the class credit. Approved for members who say they are not
  seeing results, are unsure what to book, picked up an injury and need their programming adjusted,
  or are new within their first 90 days.
- The one-time class credit and the 15 minute personal coaching consultation are offered TOGETHER as
  one gesture. Members who take both return at materially higher rates than members offered a
  discount. This pairing is the studio's standard save.
- FEE WAIVER: a declined-payment fee may be waived once per membership year at the desk's
  discretion.

## 4. Never offered
- No discounts on the monthly rate. Price is never the lever at this studio.
- No refunds for elapsed months.
- No free months of membership.
- No promises about class availability, instructor schedules or results.
- No medical advice, diagnosis, treatment plans or physiotherapy referrals. An injury is handled by
  adjusting programming with a coach, never by advising on the injury itself.

## 5. What raises retention risk
- Low or falling attendance, particularly fewer than one class a week.
- A second hold inside the same membership year.
- Any statement that they are not using it, not seeing results, or are not sure it is worth it.
- AN INJURY SUSTAINED IN CLASS. A member who was hurt training with us is a serious retention risk
  even when they do not say the word cancel — they usually just stop coming. Treat any mention of
  being hurt, injured, in pain, or sore for days as a strong risk signal on its own.
- A failed payment, especially combined with any of the above.
- Naming another studio or a cheaper alternative.
- Risk of 60 or more out of 100 is the point at which the studio treats the member as an active
  churn risk, records it against their profile, and expects the desk to make the standard save.

## 6. Tone
- Lead with the good news, then the blocker. Never open with a problem.
- Acknowledge frustration in the member's own words before offering anything.
- If a member mentions an injury, ask if they are alright before anything else.
- One or two sentences at a time. Never read a policy number out loud to a member.
`;

async function ensureKnowledge() {
  const bases = await call('GET', `${KNOW}/ControlPlane/KnowledgeBases`);
  let base = (bases.knowledgeBases || []).find((b) => b.displayName === KB_NAME);

  if (!base) {
    const created = await call('POST', `${KNOW}/ControlPlane/KnowledgeBases`, {
      displayName: KB_NAME,
      description: 'Emerald Fitness studio policies, retention playbook and approved save offers.',
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
            'Hold lengths, reinstatement rules, approved save offers (win-back class + 15 minute coaching reset), what is never offered, and the studio risk signals.',
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
  'Membership hold',
  'Come off hold',
  'Payment or billing problem',
  'Book a class',
  'Move or cancel a booking',
  'Thinking about cancelling',
  'Schedule or class question',
  'Fuel Bar order',
  'Something else',
  'Not clear yet',
];

const OPERATORS = [
  {
    displayName: 'Emerald Call Reason',
    description:
      'Resolves why the member is calling Emerald Fitness, as early in the conversation as possible.',
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
          description: 'The member\u2019s own words that told you. Empty if they have not said yet.',
        },
      },
    },
    prompt: `You are listening to a live conversation between a member of Emerald Fitness, a boutique fitness studio in Fort Worth, and the studio's line.

Decide why the MEMBER is making contact. Judge only what the member themselves has said. The agent asking a question, offering something, or reading anything back is never evidence of the member's reason.

Rules:
- Return "Not clear yet" with a confidence of 0 until the member has actually stated a need. A greeting, a hello, background noise, or a single word is not a reason.
- "Membership hold" means they want to pause, freeze or suspend an active membership.
- "Come off hold" means they want to restart or release a membership that is already on hold.
- "Thinking about cancelling" is only for an explicit intent to end the membership, not for general frustration.
- Never infer a reason from the agent's suggestions.
- Keep evidence to a short quote of the member's words. Leave it empty when the reason is "Not clear yet".`,
  },
  {
    displayName: 'Emerald Retention Risk',
    description:
      'Scores how likely this member is to leave Emerald Fitness, live, with the reasons behind the score.',
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
          description: 'The single most telling thing the member said. Empty if nothing yet.',
        },
        trend: { type: 'string', enum: ['rising', 'steady', 'falling'] },
      },
    },
    prompt: `You are scoring live retention risk for a member of Emerald Fitness, a boutique fitness studio, while they are still on the phone.

The conversation may be with an AI agent or with a human team member at the front desk. Score it exactly the same way either way.

Score from 0 to 100, where 0 is a happy engaged member and 100 is a member about to leave. Bands: 0-24 low, 25-49 watch, 50-74 elevated, 75-100 high.

Raise the score for things the MEMBER says or that are true of their record:
- Saying they are not really using it, not going, or too busy to come in.
- Saying they are not seeing results or are not sure it is worth the money.
- Asking about cancelling, or naming another studio or a cheaper option.
- BEING HURT OR INJURED IN A CLASS. This is one of the strongest signals there is. A member who was hurt training with us usually stops coming without ever saying the word cancel. Any mention of being hurt, injured, in pain, having tweaked or pulled something, or being sore for days must push the score into the elevated band on its own, and into high when combined with disengagement or a failed payment.
- A failed or declined payment, especially combined with any of the above.
- A second hold within the same membership year, or a long hold.
- Audible frustration, resignation or repeated dissatisfaction.

Do not raise the score for:
- A routine hold request with a clear practical reason such as travel or work.
- A single logistical question, a booking change, or ordinary small talk.
- Anything the agent said, human or AI. Only the member's own words and record count.

Floors you must not go below once the member has said it, even if she is polite about it:
- She mentions cancelling, quitting, ending or not renewing her membership, or asks how to cancel: at least 75. Explicit cancellation talk is a high-risk member, no matter how calm she sounds.
- She says she is not seeing results, not getting value, or is not sure it is worth the money: at least 60.
- She was hurt or injured in a class: at least 60, and at least 80 alongside any disengagement or a failed payment.
- These floors are permanent for the rest of the call. Never lower the score back down because a later part of the conversation went smoothly, and never let a helpful agent or a resolved payment reduce it.

Start low and only move as evidence appears. Set trend by comparing with how the conversation opened. Keep each driver under eight words, phrased as a fact about the member. Return an empty drivers list and an empty quote ONLY while the score is still in the low band — from 25 upwards you must always name at least one driver and quote the member's own words that moved the score.`,
  },
  {
    displayName: 'Emerald Next Best Action',
    description:
      'Recommends the save offer a human should make, grounded in the studio retention playbook.',
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
          description: 'Six words or fewer naming the save, e.g. "Class credit and coaching reset".',
        },
        offer: {
          type: 'string',
          description: 'Exactly what to offer, in words the agent could say out loud.',
        },
        rationale: {
          type: 'string',
          description: 'One sentence on why this member, right now.',
        },
        policy_source: {
          type: 'string',
          description: 'The part of the studio playbook this comes from.',
        },
        urgency: { type: 'string', enum: ['now', 'before the call ends', 'follow up later'] },
      },
    },
    prompt: `You are the live co-pilot for the Emerald Fitness front desk. A member is on the phone right now, either with the AI agent or already with a human team member. Recommend the single next best SAVE OFFER a human team member should make.

You recommend GOODWILL, never PROCEDURE. The desk already knows how to do its job.

THE ONLY THING YOU MAY EVER RECOMMEND is an approved save offer from the "Approved save offers" section of the studio playbook available to you as knowledge. In practice that means the ONE-TIME CLASS CREDIT offered together with the complimentary FIFTEEN MINUTE PERSONAL COACHING CONSULTATION, as one single gesture. A fee waiver may be added when a payment fee is involved. If no approved save offer applies, set recommend to false and return empty strings. There is no third option.

NEVER recommend any of the following, under any wording. These are process, not a save, and recommending them is a failure:
- Transferring, warm transferring, bringing her to the desk, or connecting her to anyone.
- Taking a card, updating a card, a secure terminal, a payment link, re-running a charge, or collecting payment in any form.
- Reactivating, restarting, releasing or lifting the membership hold, or placing a new hold.
- Calling her back, following up later, or noting anything on her account.
- Anything the playbook lists as never offered: rate discounts, refunds, free months, medical advice.

An expired card or a failed payment is PROCEDURE on its own — it is not a reason to recommend anything. It only matters as an extra risk factor alongside something the member actually said.

Recommend the standard save (class credit plus the fifteen minute coaching consultation) as soon as ANY of these is true:
- She says she is not really using it, not going, or too busy to come in.
- She says she is not seeing results, or is not sure it is worth the money.
- She mentions cancelling, quitting, ending her membership, or another studio.
- SHE WAS HURT OR INJURED IN A CLASS. This alone is enough. Do not wait for the word cancel — by the time she says it she has already gone. Say plainly that the coaching consultation is where her programming gets adjusted around the injury.

Rules:
- Set recommend to false, with empty strings, whenever the conversation is routine. A member putting her membership on hold for travel or work is ROUTINE. A member coming off hold and simply needing her card updated, with no complaint and no injury, is ALSO ROUTINE — recommend nothing. Do not manufacture a save.
- policy_source must name the approved save offers section of the playbook in plain words. Never cite the hold rules or the failed payment rules as the source of a save.
- The offer must be goodwill a human at the desk can say and honour immediately.
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

const CONFIG_NAME = 'emerald-fitness-realtime';
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
        { id: operatorIds['Emerald Call Reason'] },
        { id: TWILIO_SENTIMENT },
      ],
      triggers: [{ on: 'COMMUNICATION', parameters: { count: 1 } }],
      actions: [action],
      context: memoryOnly,
    },
    {
      // Heavier signals — risk and the recommended play, grounded in the playbook.
      operators: [
        { id: operatorIds['Emerald Retention Risk'] },
        { id: operatorIds['Emerald Next Best Action'] },
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
    description: 'Live call reason, sentiment, retention risk and next best action for the Emerald Fitness guided journey.',
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
  console.log(`EMERALD_INTEL_CONFIG_ID=${configId}`);
  console.log(`EMERALD_KNOWLEDGE_BASE_ID=${knowledge.baseId}`);
  console.log(`EMERALD_OP_CALL_REASON=${operatorIds['Emerald Call Reason']}`);
  console.log(`EMERALD_OP_RETENTION_RISK=${operatorIds['Emerald Retention Risk']}`);
  console.log(`EMERALD_OP_NEXT_BEST_ACTION=${operatorIds['Emerald Next Best Action']}`);
  console.log(`EMERALD_OP_SENTIMENT=${TWILIO_SENTIMENT}`);
})().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
