import { Pool, RowDataPacket } from "mysql2/promise";
import { getDb } from "../config/database";
import { 
  listActiveAutoBids, 
  getActiveBidsTotalForBuyer, 
  getUnpaidTotalForBuyer, 
  lockBuyerForUpdate, 
  lockAutoBidsForBuyer 
} from "../modules/auto_bid/auto_bid.dao";
import { 
  lockVehicleForUpdate, 
  getCurrentMaxBidForVehicle, 
  getBuyerCurrentMaxOnVehicle, 
  insertSurrogateBid, 
  clearTopBidFlags, 
  setTopBidFlag 
} from "../modules/buyer_bids/buyer_bids.dao";
import { extendAuctionEndTime } from "../modules/vehicles/vehicle.dao";
import { getRedis } from "../config/redis";
import { getIO } from "../config/socket";

export function startAutoBidRunner() {
  const intervalMs = 10_000;
  
  setInterval(async () => {
    try {
      // 1) Fetch candidate auto-bids (SQL A from spec)
      const candidates = await listActiveAutoBids();
      
      if (candidates.length === 0) {
        return;
      }

      // 2) Group by buyer_id
      const groups = new Map<number, any[]>();
      for (const candidate of candidates) {
        const buyerId = Number(candidate.buyer_id);
        if (!groups.has(buyerId)) {
          groups.set(buyerId, []);
        }
        groups.get(buyerId)!.push(candidate);
      }

      let totalProcessed = 0;
      let totalBidsPlaced = 0;
      
      // 3) Process each buyer in a separate transaction
      for (const [buyerId, buyerCandidates] of groups) {
        const db: Pool = getDb();
        
        try {
          // Start transaction
          await db.query('START TRANSACTION');
          
          // (A) Lock buyer row FOR UPDATE
          const buyer = await lockBuyerForUpdate(buyerId);
          if (!buyer) {
            await db.query('COMMIT');
            continue;
          }

          // (B) Compute pending_limit inside TX
          const activeBidsTotal = await getActiveBidsTotalForBuyer(buyerId);
          const unpaidTotal = await getUnpaidTotalForBuyer(buyerId);
          const bidLimit = Number(buyer.bid_limit) || 0;
          let pendingLimit = bidLimit - (activeBidsTotal + unpaidTotal);
          
          if (pendingLimit <= 0) {
            await db.query('COMMIT');
            continue;
          }

          // (C) Lock all candidate auto_bid rows for this buyer FOR UPDATE
          const lockedAutoBids = await lockAutoBidsForBuyer(buyerId);

          // Process each locked auto-bid (only once per cycle)
          const processedVehicles = new Set<number>();
          let bidsPlacedThisCycle = 0;
          
          for (const ab of lockedAutoBids) {
            const vehicleId = Number(ab.vehicle_id);
            
            // Skip if we already processed this vehicle in this cycle
            if (processedVehicles.has(vehicleId)) {
              continue;
            }
            
            // Only process one auto-bid per cycle to prevent multiple bids
            if (bidsPlacedThisCycle >= 1) {
              break;
            }
            
            processedVehicles.add(vehicleId);
            
            const stepAmt = Number(ab.step_amt);
            const lastBidAmt = Number(ab.last_bid_amt);
            const pendingSteps = Number(ab.pending_steps);
            const maxBidAmt = Number(ab.max_bid_amt);
            const bidStartAmt = Number(ab.bid_start_amt);

            // (D) Lock vehicle FOR UPDATE
            const vehicle = await lockVehicleForUpdate(vehicleId);
            if (!vehicle) {
              continue;
            }

            // (E) Recompute canonical current_max for the vehicle
            const currentMax = await getCurrentMaxBidForVehicle(vehicleId);
            const topBidderId = Number(vehicle.top_bidder_id) || null;
            const maxPrice = Number(vehicle.max_price) || Number.MAX_SAFE_INTEGER;

            // If buyer already top, skip
            if (topBidderId === buyerId) {
              continue;
            }

            // (F) Compute next bid amount based on current state
            let nextAmt: number;
            let isInitialBid = false;
            
            // Calculate owner_current according to test case rules:
            // The auto-bid should ALWAYS start from its own bid_start_amt, not from buyer's existing bids
            let ownerCurrent: number;
            
            if (lastBidAmt === null || lastBidAmt === undefined) {
              // First bid: use bid_start_amt
              ownerCurrent = bidStartAmt;
              isInitialBid = true;
            } else {
              // Subsequent bids: use last_bid_amt (from auto-bid table, not buyer's current max)
              ownerCurrent = lastBidAmt;
            }
            
            // Calculate next bid amount
            if (isInitialBid) {
              // For initial bids, use max(bid_start_amt, base_price)
              const basePrice = Number(vehicle.base_price) || 0;
              nextAmt = Math.max(bidStartAmt, basePrice);
            } else {
              // Regular step case: ownerCurrent + stepAmt
              nextAmt = ownerCurrent + stepAmt;
            }

            // Guard check: for non-initial bids, ensure last_bid_amt < current_max
            if (!isInitialBid && lastBidAmt >= currentMax) {
              continue;
            }

            // Adjust nextAmt if it exceeds limits
            if (nextAmt > maxBidAmt) {
              // Set pending_steps to 0 to stop further attempts
              await db.query(
                `UPDATE auto_bid SET pending_steps = 0 WHERE vehicle_id = ? AND buyer_id = ?`,
                [vehicleId, buyerId]
              );
              continue;
            }
            if (nextAmt > maxPrice) {
              // Set pending_steps to 0 to stop further attempts
              await db.query(
                `UPDATE auto_bid SET pending_steps = 0 WHERE vehicle_id = ? AND buyer_id = ?`,
                [vehicleId, buyerId]
              );
              continue;
            }
            
            // If nextAmt equals ownerCurrent, no point in placing the same bid
            if (nextAmt <= ownerCurrent) {
              continue;
            }
            
            // Additional check: if buyer already has a bid at this amount or higher, skip
            const buyerCurrentOnVehicle = await getBuyerCurrentMaxOnVehicle(buyerId, vehicleId);
            if (buyerCurrentOnVehicle >= nextAmt) {
              continue;
            }

            // (G) Compute delta using ownerCurrent
            const delta = nextAmt - ownerCurrent;

            if (delta <= 0) {
              continue;
            }

            // (H) Check pending_limit
            if (delta > pendingLimit) {
              continue;
            }

            // (I) Insert surrogate auto bid
            
            // Determine if this bid becomes top (only if > current_max, not equal)
            const becomesTop = nextAmt > currentMax;
            
            const newBidId = await insertSurrogateBid({
              vehicle_id: vehicleId,
              buyer_id: buyerId,
              bid_amt: nextAmt,
              is_surrogate: 1,
              bid_mode: 'A',
              top_bid_at_insert: becomesTop ? 1 : 0,
              user_id: 0
            });

            // (J) If next_amt > current_max then update top flags
            if (becomesTop) {
              // Clear old top flags
              await clearTopBidFlags(vehicleId);
              
              // Set new top flag
              await setTopBidFlag(newBidId);
            }

            // (K) Update auto_bid: last_bid_amt & pending_steps--
            // If we reached max_bid_amt, set pending_steps to 0 to stop further attempts
            const newPendingSteps = (nextAmt >= maxBidAmt) ? 0 : pendingSteps - 1;
            
            // Convert to proper data types to avoid database errors
            const lastBidAmtValue = Math.floor(nextAmt); // Ensure integer
            const pendingStepsValue = Math.max(0, newPendingSteps); // Ensure non-negative
            
            await db.query(
              `UPDATE auto_bid SET last_bid_amt = ?, pending_steps = ? WHERE vehicle_id = ? AND buyer_id = ?`,
              [lastBidAmtValue, pendingStepsValue, vehicleId, buyerId]
            );

            // (L) Update vehicles counters and top fields
            if (becomesTop) {
              // Update top_bidder_id and increment counters
              await db.query(
                `UPDATE vehicles SET top_bidder_id = ?, bids_count = bids_count + 1, bidders_count = CASE WHEN ? NOT IN (SELECT DISTINCT buyer_id FROM buyer_bids WHERE vehicle_id = ? AND buyer_id != ?) THEN bidders_count + 1 ELSE bidders_count END WHERE vehicle_id = ?`,
                [buyerId, buyerId, vehicleId, buyerId, vehicleId]
              );
            } else {
              // Just increment bids_count
              await db.query(
                `UPDATE vehicles SET bids_count = bids_count + 1 WHERE vehicle_id = ?`,
                [vehicleId]
              );
            }

            // (M) Reduce pending_limit by delta
            pendingLimit = pendingLimit - delta;

            // (N) Extend auction_end_dttm
            await extendAuctionEndTime(vehicleId);

            // Get updated auction end time after extension
            const [updatedVehicleRows] = await db.query<RowDataPacket[]>(
              `SELECT auction_end_dttm FROM vehicles WHERE vehicle_id = ?`,
              [vehicleId]
            );
            const updatedAuctionEndDttm = updatedVehicleRows[0]?.auction_end_dttm;

            // Redis publish and Socket.IO emit
            try {
              const redis = getRedis();
              const payload = {
                vehicleId,
                buyerId,
                bidAmt: nextAmt,
                isTopBidder: becomesTop,
                auctionEndDttm: updatedAuctionEndDttm,
              };
            
              await redis.publish("vehicle:bid:update", JSON.stringify(payload));
            
              // Socket.IO emit
              const io = getIO();
              if (becomesTop) {
                io.to(String(buyerId)).emit('isWinning', { vehicleId, auctionEndDttm: updatedAuctionEndDttm });
                if (topBidderId && topBidderId !== buyerId) {
                  io.to(String(topBidderId)).emit('isLosing', { vehicleId, auctionEndDttm: updatedAuctionEndDttm });
                }
              }
              
              // Emit vehicle:endtime:update
              io.emit('vehicle:endtime:update', { vehicleId, auctionEndDttm: updatedAuctionEndDttm });
              
            } catch (notifyErr) {
              // Silent error handling
            }

            totalBidsPlaced++;
            bidsPlacedThisCycle++;
            
            // Break after placing one bid per cycle to prevent multiple bids
            break;
          }

          // Commit transaction
          await db.query('COMMIT');
          totalProcessed++;
          
        } catch (error) {
          await db.query('ROLLBACK');
        }
      }
      
    } catch (e) {
      // Silent error handling
    }
  }, intervalMs);
}