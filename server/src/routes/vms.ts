import {
  withClient,
  type AppContext,
} from "../app-context";
import { errorJson, json } from "../http";
import {
  listVms,
  mapTrueNasError,
  poweroffVm,
  restartVm,
  startVm,
} from "../truenas/vm-service";

function mappedError(err: unknown): Response {
  if (err instanceof Error && err.message === "NOT_ONBOARDED") {
    return errorJson(403, "NOT_ONBOARDED", "TrueNAS connection required");
  }
  const mapped = mapTrueNasError(
    err instanceof Error ? err : new Error("TrueNAS request failed"),
  );
  return errorJson(mapped.status, mapped.code, mapped.message);
}

export async function listVmsRoute(ctx: AppContext): Promise<Response> {
  try {
    const vms = await withClient(ctx, listVms);
    return json({ vms });
  } catch (err) {
    return mappedError(err);
  }
}

export async function vmPowerRoute(
  ctx: AppContext,
  idText: string,
  action: string,
): Promise<Response> {
  const id = Number(idText);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return errorJson(
      400,
      "INVALID_VM_ID",
      "VM id must be a positive integer",
    );
  }

  try {
    await withClient(ctx, async (client) => {
      if (action === "start") return startVm(client, id);
      if (action === "restart") return restartVm(client, id);
      return poweroffVm(client, id);
    });
    return json({ ok: true });
  } catch (err) {
    return mappedError(err);
  }
}
