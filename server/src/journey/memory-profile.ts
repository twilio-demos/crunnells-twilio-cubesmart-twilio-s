import { getMemoryAuthHeader } from "../memory.js";

const MEMORY_BASE_URL = "https://memory.twilio.com";

function storeId(): string | undefined {
  return process.env.TWILIO_MEMORY_STORE_ID;
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: getMemoryAuthHeader(),
  };
}

export interface ProfileSnapshot {
  profileId?: string;
  traits: { group: string; name: string; value: unknown; updatedAt?: string }[];
  observations: { id: string; content: string; source?: string; occurredAt?: string }[];
  summaries: { id: string; summary: string; createdAt?: string }[];
}

const TRAIT_GROUP = "Membership";

/**
 * The Memory store is shared with earlier demos, so it still carries trait
 * groups from those (Patient, Appointment, ...). Only surface the groups that
 * belong to this guided move-in journey.
 */
const VISIBLE_TRAIT_GROUPS = ["Contact", TRAIT_GROUP];

function isVisibleGroup(group: string): boolean {
  const normalized = (group || "").trim().toLowerCase();
  return VISIBLE_TRAIT_GROUPS.some((g) => g.toLowerCase() === normalized);
}

const MEMBERSHIP_TRAITS: Record<string, string> = {
  homeStudio: "The tenant's home store location",
  membershipTier: "Unit type currently leased",
  membershipStatus: "active or extended-access",
  holdStartDate: "First day of an extended gate access window",
  holdEndDate: "Last day of an extended gate access window",
  paymentStatus: "current or expired",
  cardOnFile: "Masked card on file",
  consentStatus: "Marketing messaging consent",
  lineType: "Twilio Lookup line type",
  carrier: "Twilio Lookup carrier",
  rcsCapable: "Whether the handset can receive RCS",
  usualSupplyOrder: "Preferred packing-supply bundle",
  lastInstructorRating: "Most recent move-in staff rating out of 5",
  classesBooked: "Total move-in appointments booked to date",
  lastClassBooked: "Most recently booked move-in appointment",
};

let ensuredGroups = false;

/** Make sure the Membership trait group exists with all the traits we write. */
async function ensureMembershipGroup(): Promise<void> {
  if (ensuredGroups) return;
  const store = storeId();
  if (!store) return;

  const traits: Record<string, { dataType: string; description: string }> = {};
  for (const [name, description] of Object.entries(MEMBERSHIP_TRAITS)) {
    traits[name] = { dataType: "STRING", description };
  }

  try {
    const existing = await fetch(
      `${MEMORY_BASE_URL}/v1/ControlPlane/Stores/${store}/TraitGroups/${TRAIT_GROUP}?includeTraits=true`,
      { headers: headers() }
    );
    if (existing.ok) {
      await fetch(
        `${MEMORY_BASE_URL}/v1/ControlPlane/Stores/${store}/TraitGroups/${TRAIT_GROUP}`,
        { method: "PATCH", headers: headers(), body: JSON.stringify({ traits }) }
      );
    } else {
      await fetch(`${MEMORY_BASE_URL}/v1/ControlPlane/Stores/${store}/TraitGroups`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          displayName: TRAIT_GROUP,
          description: "CubeSmart tenant lease state",
          traits,
        }),
      });
    }
    ensuredGroups = true;
  } catch (err) {
    console.error("[journey/memory] ensure trait group failed", err);
  }
}

/** Create (or resolve) the tenant profile. Phone is promoted to an identifier. */
export async function createMemberProfile(input: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<string | undefined> {
  const store = storeId();
  if (!store) return undefined;
  await ensureMembershipGroup();

  try {
    const res = await fetch(`${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        traits: {
          Contact: {
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            city: "Fort Worth",
            state: "TX",
            country: "US",
          },
          [TRAIT_GROUP]: {
            homeStudio: "West 7th — Fort Worth",
            membershipTier: "10x10 Climate-Controlled Unit",
            membershipStatus: "active",
            paymentStatus: "current",
            cardOnFile: "Visa •••• 4417 exp 09/26",
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("[journey/memory] create profile failed", res.status, await res.text());
      return undefined;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const profileId =
      (data.profileId as string) ||
      (data.id as string) ||
      ((data.profile as Record<string, unknown> | undefined)?.id as string);
    return profileId;
  } catch (err) {
    console.error("[journey/memory] create profile error", err);
    return undefined;
  }
}

export async function lookupProfileIdByPhone(phone: string): Promise<string | undefined> {
  const store = storeId();
  if (!store) return undefined;
  try {
    const res = await fetch(`${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles/Lookup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ idType: "phone", value: phone }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { profiles?: string[] };
    return data.profiles?.[0];
  } catch {
    return undefined;
  }
}

export async function patchMembershipTraits(
  profileId: string,
  traits: Record<string, string>
): Promise<void> {
  const store = storeId();
  if (!store || !profileId) return;
  await ensureMembershipGroup();
  try {
    await fetch(`${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles/${profileId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ traits: { [TRAIT_GROUP]: traits } }),
    });
  } catch (err) {
    console.error("[journey/memory] patch traits failed", err);
  }
}

/** Events in this demo are written to Memory as observations. */
export async function writeObservation(
  profileId: string | undefined,
  content: string,
  source = "CubeSmart"
): Promise<void> {
  const store = storeId();
  if (!store || !profileId) return;
  try {
    const res = await fetch(
      `${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles/${profileId}/Observations`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          observations: [
            {
              content,
              occurredAt: new Date().toISOString(),
              source,
            },
          ],
        }),
      }
    );
    if (!res.ok) {
      console.error("[journey/memory] observation failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[journey/memory] observation error", err);
  }
}

export async function deleteMemberProfile(phone: string): Promise<boolean> {
  const store = storeId();
  if (!store) return false;
  const profileId = await lookupProfileIdByPhone(phone);
  if (!profileId) return false;
  try {
    const res = await fetch(
      `${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles/${profileId}`,
      { method: "DELETE", headers: headers() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchProfileSnapshot(
  profileId: string | undefined
): Promise<ProfileSnapshot> {
  const store = storeId();
  const empty: ProfileSnapshot = { profileId, traits: [], observations: [], summaries: [] };
  if (!store || !profileId) return empty;

  const get = async (path: string) => {
    try {
      const res = await fetch(
        `${MEMORY_BASE_URL}/v1/Stores/${store}/Profiles/${profileId}/${path}`,
        { headers: headers() }
      );
      if (!res.ok) return {} as Record<string, unknown>;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  };

  const [traitsRes, obsRes, sumRes] = await Promise.all([
    get("Traits?pageSize=100"),
    get("Observations?pageSize=50"),
    get("ConversationSummaries?pageSize=20"),
  ]);

  const rawTraits = (traitsRes.traits as Record<string, unknown>[]) || [];
  const rawObs = (obsRes.observations as Record<string, unknown>[]) || [];
  const rawSums = (sumRes.summaries as Record<string, unknown>[]) || [];

  return {
    profileId,
    traits: rawTraits
      .map((t) => ({
        group: (t.traitGroup as string) || "",
        name: (t.name as string) || (t.traitName as string) || "",
        value: t.value ?? t.traitValue,
        updatedAt: (t.updatedAt as string) || (t.createdAt as string),
      }))
      .filter((t) => isVisibleGroup(t.group)),
    observations: rawObs.map((o) => ({
      id: (o.id as string) || (o.observationId as string) || "",
      content: (o.content as string) || (o.observation as string) || "",
      source: o.source as string | undefined,
      occurredAt: (o.occurredAt as string) || (o.createdAt as string),
    })),
    summaries: rawSums.map((s) => ({
      id: (s.id as string) || (s.summaryId as string) || "",
      summary: (s.summary as string) || (s.content as string) || "",
      createdAt: s.createdAt as string | undefined,
    })),
  };
}
