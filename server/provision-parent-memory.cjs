/**
 * One-off provisioning: creates a Memory Store + a Conversation Orchestrator
 * configuration (voice + SMS/RCS capture rules) on the PARENT Twilio account,
 * mirroring what already exists on the subaccount.
 *
 * Run:  node server/provision-parent-memory.cjs
 */

const fs = require('node:fs');

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
const KEY = env.FLEX_PARENT_API_KEY;
const SECRET = env.FLEX_PARENT_API_SECRET;
const ACCOUNT_SID = env.FLEX_PARENT_ACCOUNT_SID;
const STORE_PHONE = env.CUBESMART_STORE_PHONE;

if (!KEY || !SECRET || !ACCOUNT_SID) {
  console.error('Missing FLEX_PARENT_API_KEY / FLEX_PARENT_API_SECRET / FLEX_PARENT_ACCOUNT_SID');
  process.exit(1);
}
if (!STORE_PHONE) {
  console.error('Missing CUBESMART_STORE_PHONE — needed for the voice/SMS capture rules');
  process.exit(1);
}

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

const MEMORY = 'https://memory.twilio.com/v1';
const CONV = 'https://conversations.twilio.com/v2/ControlPlane';

const STORE_NAME = 'cubesmart-parent';

async function ensureMemoryStore() {
  const list = await call('GET', `${MEMORY}/ControlPlane/Stores`);
  console.log('  DEBUG list:', JSON.stringify(list));
  const existing = (list.stores || []).find((s) => s.displayName === STORE_NAME);
  if (existing) {
    console.log(`  reusing memory store ${existing.id}`);
    return existing.id;
  }

  // Store creation is async — the POST only returns {message, statusUrl}.
  const created = await call('POST', `${MEMORY}/ControlPlane/Stores`, {
    displayName: STORE_NAME,
    description: 'CubeSmart tenant profiles — parent account',
  });
  console.log('  DEBUG create:', JSON.stringify(created));

  if (created.statusUrl) {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = await call('GET', created.statusUrl).catch(() => null);
      console.log('  DEBUG status:', JSON.stringify(status));
      if (status && (status.status === 'COMPLETED' || status.status === 'SUCCEEDED')) break;
    }
  }

  const again = await call('GET', `${MEMORY}/ControlPlane/Stores`);
  console.log('  DEBUG list again:', JSON.stringify(again));
  const found = (again.stores || []).find((s) => s.displayName === STORE_NAME);
  if (!found) throw new Error('Memory store was not found after creation');
  console.log(`  created memory store ${found.id}`);
  return found.id;
}

async function ensureConversationConfiguration(memoryStoreId) {
  const list = await call('GET', `${CONV}/Configurations`);
  const found = (list.configurations || []).find((c) => c.displayName === STORE_NAME);

  const payload = {
    displayName: STORE_NAME,
    description: 'CubeSmart guided move-in journey — parent account',
    conversationGroupingType: 'GROUP_BY_PARTICIPANT_ADDRESSES_AND_CHANNEL_TYPE',
    memoryStoreId,
    memoryExtractionEnabled: true,
    channelSettings: {
      SMS: {
        statusTimeouts: { inactive: 10, closed: 30 },
        captureRules: [
          { from: STORE_PHONE, to: '*' },
          { from: '*', to: STORE_PHONE },
        ],
      },
      VOICE: {
        statusTimeouts: { inactive: 5, closed: 30 },
        captureRules: [
          { from: STORE_PHONE, to: '*' },
          { from: '*', to: STORE_PHONE },
        ],
      },
    },
  };

  if (found) {
    const updated = await call('PUT', `${CONV}/Configurations/${found.id}`, payload);
    console.log(`  updated conversation configuration ${found.id}`);
    return updated.id || found.id;
  }

  const created = await call('POST', `${CONV}/Configurations`, payload);
  console.log(`  created conversation configuration ${created.id}`);
  return created.id;
}

(async () => {
  console.log(`Provisioning on parent account ${ACCOUNT_SID}\n`);

  console.log('1. Memory Store');
  const memoryStoreId = await ensureMemoryStore();

  console.log('\n2. Conversation Orchestrator configuration');
  const configId = await ensureConversationConfiguration(memoryStoreId);

  console.log('\n--- env values ---');
  console.log(`TWILIO_MEMORY_STORE_ID=${memoryStoreId}`);
  console.log(`TWILIO_CONVERSATION_CONFIGURATION_ID=${configId}`);
})().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
