// PredictManager is a SHARED object — it cannot be found via getOwnedObjects.
// Discover it by querying the PredictManagerCreated event emitted at creation.
const MANAGER_CREATED_TYPE = "::predict_manager::PredictManagerCreated";

/** Minimal shape shared by dapp-kit SuiClient and SuiJsonRpcClient. */
export interface EventQueryClient {
  queryEvents(input: {
    query: { Sender: string };
    limit?: number;
    order?: "ascending" | "descending";
  }): Promise<{ data: Array<{ type?: string; parsedJson?: unknown }> }>;
}

/**
 * Return the latest PredictManager ID created by `owner`, or null if none.
 * Uses the creation event because the manager is a shared object.
 */
export async function findManagerId(
  client: EventQueryClient,
  owner: string
): Promise<string | null> {
  const events = await client.queryEvents({
    query: { Sender: owner },
    limit: 50,
    order: "descending",
  });
  const managerEvent = events.data.find(
    (e) => typeof e.type === "string" && e.type.includes(MANAGER_CREATED_TYPE)
  );
  const parsed = managerEvent?.parsedJson as { manager_id?: string } | undefined;
  return parsed?.manager_id ?? null;
}
