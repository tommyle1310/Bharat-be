import { listActiveAutoBids } from '../modules/auto_bid/auto_bid.dao';
import { getVehicleById } from '../modules/vehicles/vehicle.dao';
import { getTopBidForVehicle, insertBuyerBid } from '../modules/buyer_bids/buyer_bids.dao';
import { Pool } from 'mysql2/promise';
import { getDb } from '../config/database';

export function startAutoBidRunner() {
  const intervalMs = 10_000;
  setInterval(async () => {
    try {
      const records = await listActiveAutoBids();
      for (const ab of records as any[]) {
        const vehicleId = Number(ab.vehicle_id);
        const buyerId = Number(ab.buyer_id);
        const stepAmt = Number(ab.step_amt);
        const maxBidAmt = Number(ab.max_bid_amt);
        let pendingSteps = Number(ab.pending_steps);
        let lastBidAmt = Number(ab.last_bid_amt);

        const vehicle = await getVehicleById(vehicleId);
        if (!vehicle) continue;

        const top = await getTopBidForVehicle(vehicleId);
        const topAmt = top ? top.amount : Number(vehicle.base_price ?? 0);

        let processed = false;
        const maxAllowed = Number(vehicle.max_price ?? Number.MAX_SAFE_INTEGER);

        while (
          lastBidAmt < topAmt &&
          lastBidAmt + stepAmt <= maxBidAmt &&
          pendingSteps > 0 &&
          lastBidAmt + stepAmt < maxAllowed
        ) {
          processed = true;
          pendingSteps -= 1;
          lastBidAmt = lastBidAmt + stepAmt;

          await insertBuyerBid({
            vehicle_id: vehicleId,
            buyer_id: buyerId,
            bid_amt: lastBidAmt,
            is_surrogate: 1,
            bid_mode: 'A',
            top_bid_at_insert: topAmt,
            user_id: 0,
          });
        }

        if (processed) {
          const db: Pool = getDb();
          await db.query(
            `UPDATE auto_bid SET pending_steps = ?, last_bid_amt = ? WHERE vehicle_id = ? AND buyer_id = ?`,
            [pendingSteps, lastBidAmt, vehicleId, buyerId]
          );
        }
      }
    } catch (e) {
      console.error('[auto-bid-runner] error', (e as any).message);
    }
  }, intervalMs);
}


