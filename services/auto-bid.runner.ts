import { Pool } from "mysql2/promise";
import { getDb } from "../config/database";
import { listActiveAutoBids } from "../modules/auto_bid/auto_bid.dao";
import { getVehicleById } from "../modules/vehicles/vehicle.dao";
import { getTopBidForVehicle, insertBuyerBid, updateOtherBuyerBidsTopBidStatus, getLatestBuyerBidForVehicle, getBuyerLimitInfo } from "../modules/buyer_bids/buyer_bids.dao";
import { getRedis } from "../config/redis";
import { getIO } from "../config/socket";

export function startAutoBidRunner() {
  const intervalMs = 10_000;
  console.log(`[AUTO-BID-RUNNER] Starting auto-bid runner with ${intervalMs}ms interval`);
  
  setInterval(async () => {
    const startTime = Date.now();
    console.log(`[AUTO-BID-RUNNER] === Starting auto-bid cycle at ${new Date().toISOString()} ===`);
    
    try {
      const records = await listActiveAutoBids();
      console.log(`[AUTO-BID-RUNNER] Found ${records.length} active auto-bid records`);
      
      if (records.length === 0) {
        console.log(`[AUTO-BID-RUNNER] No active auto-bids found, skipping cycle`);
        return;
      }

      let totalProcessed = 0;
      let totalBidsPlaced = 0;
      
      for (const ab of records as any[]) {
        const vehicleId = Number(ab.vehicle_id);
        const buyerId = Number(ab.buyer_id);
        const stepAmt = Number(ab.step_amt);
        const maxBidAmt = Number(ab.max_bid_amt);
        let pendingSteps = Number(ab.pending_steps);
        let lastBidAmt = Number(ab.last_bid_amt);

        console.log(`[AUTO-BID-RUNNER] Processing auto-bid for buyer ${buyerId}, vehicle ${vehicleId}:`);
        console.log(`  - Step amount: ${stepAmt}`);
        console.log(`  - Max bid amount: ${maxBidAmt}`);
        console.log(`  - Pending steps: ${pendingSteps}`);
        console.log(`  - Last bid amount: ${lastBidAmt}`);

        const vehicle = await getVehicleById(vehicleId);
        if (!vehicle) {
          console.log(`[AUTO-BID-RUNNER] Vehicle ${vehicleId} not found, skipping`);
          continue;
        }

        // IST helper
        const parseIst = (ts?: any): Date | null => {
          if (!ts) return null;
          const parts = String(ts).split(' ');
          const d = parts[0];
          const t = parts[1];
          if (!d || !t) return null;
          const dSegs = d.split('-');
          const tSegs = t.split(':');
          const y = Number(dSegs[0] ?? 0);
          const mo = Number(dSegs[1] ?? 1);
          const da = Number(dSegs[2] ?? 1);
          const hh = Number(tSegs[0] ?? 0);
          const mi = Number(tSegs[1] ?? 0);
          const ss = Number(tSegs[2] ?? 0);
          const utcMs = Date.UTC(y, mo - 1, da, hh - 5, mi - 30, ss);
          return new Date(utcMs);
        };
        const formatIst = (dateUtc: Date): string => {
          const ist = new Date(dateUtc.getTime() + 330 * 60 * 1000);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}`;
        };

        // All timestamps in DB are IST; rely on DB for time comparisons and updates
        let payloadAuctionEnd: string | null | undefined = undefined;
        try {
          const db = getDb();
          // 1) If time is up, skip auto-bid
          const [timeRows] = await db.query<any[]>(
            `SELECT auction_end_dttm, final_expiry_dttm, (auction_end_dttm <= NOW()) AS ended,
                    TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) AS secs_to_end
             FROM vehicles WHERE vehicle_id = ?`,
            [vehicleId]
          );
          const ended = Boolean(timeRows?.[0]?.ended);
          const secsToEnd = Number(timeRows?.[0]?.secs_to_end ?? null);
          console.log('[AUTO-BID-RUNNER][TIME][DB] vehicle_id=', vehicleId, 'auction_end_dttm=', timeRows?.[0]?.auction_end_dttm, 'final_expiry_dttm=', timeRows?.[0]?.final_expiry_dttm, 'ended=', ended, 'secs_to_end=', secsToEnd);
          if (ended) {
            console.log(`[AUTO-BID-RUNNER] Time is up for vehicle ${vehicleId}, skipping auto-bid.`);
            continue;
          }
          // 2) If in last 5 minutes, extend by min(delta, 5m)
          const [upd] = await db.query<any>(
            `UPDATE vehicles
             SET auction_end_dttm = CASE
               WHEN TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) > 0
                AND TIMESTAMPDIFF(SECOND, NOW(), auction_end_dttm) <= 300
               THEN DATE_ADD(auction_end_dttm, INTERVAL LEAST(GREATEST(TIMESTAMPDIFF(SECOND, auction_end_dttm, final_expiry_dttm), 0), 300) SECOND)
               ELSE auction_end_dttm
             END
             WHERE vehicle_id = ?`,
            [vehicleId]
          );
          console.log('[AUTO-BID-RUNNER][EXTEND][DB] UPDATE vehicles affectedRows=', upd?.affectedRows);
          // 3) Re-read latest end time and emit regardless to keep clients in sync
          const [after] = await db.query<any[]>(`SELECT auction_end_dttm FROM vehicles WHERE vehicle_id = ?`, [vehicleId]);
          const latestEnd = after?.[0]?.auction_end_dttm ?? (vehicle as any).auction_end_dttm;
          const changed = String(latestEnd) !== String(timeRows?.[0]?.auction_end_dttm);
          payloadAuctionEnd = changed ? String(latestEnd) : null;
          (vehicle as any).auction_end_dttm = latestEnd;
          const io = getIO();
          io.emit('vehicle:endtime:update', { vehicleId, auctionEndDttm: latestEnd });
          console.log('[AUTO-BID-RUNNER][EXTEND][DB] Emitted vehicle:endtime:update auctionEndDttm=', latestEnd);
        } catch (timeErr) {
          console.error('[AUTO-BID-RUNNER][EXTEND][DB] Error handling time/extension', timeErr);
        }

        const top = await getTopBidForVehicle(vehicleId);
        let topAmt = top ? top.amount : Number(vehicle.base_price ?? 0);
        let topBidderId = top ? top.buyer_id : null;

        console.log(`[AUTO-BID-RUNNER] Vehicle ${vehicleId} details:`);
        console.log(`  - Base price: ${vehicle.base_price}`);
        console.log(`  - Max price: ${vehicle.max_price}`);
        console.log(`  - Current top bid: ${topAmt} (by buyer ${topBidderId})`);

        // Initialization: ensure a buyer_bids row exists for this auto-bid
        try {
          const existingBuyerLastBid = await getLatestBuyerBidForVehicle(buyerId, vehicleId);
          if (existingBuyerLastBid == null) {
            const startAmt = Number(ab.bid_start_amt);
            const vehicleBase = Number(vehicle.base_price ?? 0);
            const vehicleMaxAllowed = Number(vehicle.max_price ?? Number.MAX_SAFE_INTEGER);
            const initialBidAmt = Math.max(startAmt, vehicleBase);

            console.log(`[AUTO-BID-RUNNER][INIT] No existing buyer_bids found for buyer ${buyerId}, vehicle ${vehicleId}`);
            console.log(`[AUTO-BID-RUNNER][INIT] Will attempt initial insert with amount ${initialBidAmt}`);

            // Validate within buyer's budget and vehicle constraints
            if (initialBidAmt > maxBidAmt) {
              console.log(`[AUTO-BID-RUNNER][INIT] Skip initial insert: initialBidAmt(${initialBidAmt}) > maxBidAmt(${maxBidAmt})`);
            } else if (initialBidAmt > vehicleMaxAllowed) {
              console.log(`[AUTO-BID-RUNNER][INIT] Skip initial insert: initialBidAmt(${initialBidAmt}) > vehicle max allowed (${vehicleMaxAllowed})`);
            } else {
              // Check if initial bid amount exceeds buyer's pending limit
              // This ensures buyers don't exceed their available bidding limit
              try {
                const limitInfo = await getBuyerLimitInfo(buyerId);
                if (initialBidAmt > limitInfo.pending_limit) {
                  console.log(`[AUTO-BID-RUNNER][INIT] Skip initial insert: initialBidAmt(${initialBidAmt}) > pending_limit(${limitInfo.pending_limit})`);
                } else {
                  const willBeTopBid = initialBidAmt > topAmt || (initialBidAmt === topAmt && topBidderId !== buyerId);
                  const topBidAtInsert = willBeTopBid ? 1 : 0;

            await insertBuyerBid({
                    vehicle_id: vehicleId,
                    buyer_id: buyerId,
                    bid_amt: initialBidAmt,
                    is_surrogate: 1,
                    bid_mode: 'A',
                    top_bid_at_insert: topBidAtInsert,
                    user_id: 0,
            }, payloadAuctionEnd);
                  totalBidsPlaced++;
                  console.log(`[AUTO-BID-RUNNER][INIT] ✅ Inserted initial auto-bid ${initialBidAmt} for buyer ${buyerId} on vehicle ${vehicleId} (top at insert: ${topBidAtInsert})`);

                  // Update vehicle bidders_count and top_bidder_id
                  try {
                    const { updateVehicleBidderInfo } = await import('../modules/vehicles/vehicle.dao');
                    const currentTopBidAfterBid = await getTopBidForVehicle(vehicleId);
                    const topBidderId = currentTopBidAfterBid ? currentTopBidAfterBid.buyer_id : null;
                    await updateVehicleBidderInfo(vehicleId, topBidderId);
                    console.log(`[AUTO-BID-RUNNER][INIT] ✅ Updated vehicle bidder info`);
                  } catch (updateError) {
                    console.error(`[AUTO-BID-RUNNER][INIT] ❌ Failed to update vehicle bidder info:`, updateError);
                  }

                  if (willBeTopBid) {
                    try {
                      await updateOtherBuyerBidsTopBidStatus(vehicleId, buyerId);
                      console.log(`[AUTO-BID-RUNNER][INIT] ✅ Updated other buyer bids to set top_bid_at_insert = 0`);
                    } catch (updateError) {
                      console.error(`[AUTO-BID-RUNNER][INIT] ❌ Failed to update other buyer bids:`, updateError);
                    }
                  }

                  lastBidAmt = initialBidAmt;

                  const refreshedTop = await getTopBidForVehicle(vehicleId);
                  topAmt = refreshedTop ? refreshedTop.amount : Number(vehicle.base_price ?? 0);
                  topBidderId = refreshedTop ? refreshedTop.buyer_id : null;
                }
              } catch (limitError) {
                console.error(`[AUTO-BID-RUNNER][INIT] Error checking buyer limits for buyer ${buyerId}:`, limitError);
              }
            }
          }
        } catch (initErr) {
          console.error(`[AUTO-BID-RUNNER][INIT] Error during initialization for buyer ${buyerId}, vehicle ${vehicleId}:`, initErr);
        }

        let processed = false;
        let bidsPlaced = 0;
        const maxAllowed = Number(vehicle.max_price ?? Number.MAX_SAFE_INTEGER);

        while (true) {
          const needToAct = (lastBidAmt < topAmt) || (lastBidAmt === topAmt && topBidderId !== buyerId);
          if (!needToAct) break;
          if (!(pendingSteps > 0)) break;

          // Always bid by one step
          const nextBidAmt = lastBidAmt + stepAmt;

          // Respect budget and vehicle limits
          if (nextBidAmt > maxBidAmt) break;
          if (nextBidAmt > maxAllowed) break;

          // Check if next bid amount exceeds buyer's pending limit
          // This ensures buyers don't exceed their available bidding limit
          try {
            const limitInfo = await getBuyerLimitInfo(buyerId);
            if (nextBidAmt > limitInfo.pending_limit) {
              console.log(`[AUTO-BID-RUNNER] Skip bid: nextBidAmt(${nextBidAmt}) > pending_limit(${limitInfo.pending_limit})`);
              break;
            }
          } catch (limitError) {
            console.error(`[AUTO-BID-RUNNER] Error checking buyer limits for buyer ${buyerId}:`, limitError);
            break;
          }

          processed = true;
          pendingSteps -= 1;

          console.log(`[AUTO-BID-RUNNER] ===== BID LOOP ITERATION #${bidsPlaced + 1} =====`);
          console.log(`[AUTO-BID-RUNNER] Before bid placement:`);
          console.log(`  - Previous lastBidAmt: ${lastBidAmt}`);
          console.log(`  - Next bid amount (one step): ${nextBidAmt}`);
          console.log(`  - Previous pendingSteps: ${pendingSteps + 1}`);
          console.log(`  - New pendingSteps: ${pendingSteps}`);
          console.log(`  - Current topAmt: ${topAmt}`);
          console.log(`  - Current topBidderId: ${topBidderId}`);

          try {
            const willBeTopBid = nextBidAmt > topAmt || (nextBidAmt === topAmt && topBidderId !== buyerId);
            const topBidAtInsert = willBeTopBid ? 1 : 0;
            
            await insertBuyerBid({
              vehicle_id: vehicleId,
              buyer_id: buyerId,
              bid_amt: nextBidAmt,
              is_surrogate: 1,
              bid_mode: 'A',
              top_bid_at_insert: topBidAtInsert,
              user_id: 0,
            }, payloadAuctionEnd);
            bidsPlaced++;
            console.log(`[AUTO-BID-RUNNER] ✅ Successfully placed bid ${nextBidAmt} for buyer ${buyerId} on vehicle ${vehicleId}`);

            // Update vehicle bidders_count and top_bidder_id
            try {
              const { updateVehicleBidderInfo } = await import('../modules/vehicles/vehicle.dao');
              const currentTopBidAfterBid = await getTopBidForVehicle(vehicleId);
              const topBidderId = currentTopBidAfterBid ? currentTopBidAfterBid.buyer_id : null;
              await updateVehicleBidderInfo(vehicleId, topBidderId);
              console.log(`[AUTO-BID-RUNNER] ✅ Updated vehicle bidder info`);
            } catch (updateError) {
              console.error(`[AUTO-BID-RUNNER] ❌ Failed to update vehicle bidder info:`, updateError);
            }

            // Notify realtime consumers via Redis key and possible winner change
            try {
              const redis = getRedis();
              const payload = {
                vehicleId,
                buyerId,
                bidAmt: nextBidAmt,
                isTopBidder: topBidAtInsert === 1,
                auctionEndDttm: (vehicle as any).auction_end_dttm,
              };
            
              await redis.publish("vehicle:bid:update", JSON.stringify(payload));
              console.log("[AUTO-BID-RUNNER] Published vehicle:bid:update", payload);
            
            } catch (notifyErr) {
              console.error("[AUTO-BID-RUNNER] Failed to publish Redis event vehicle:bid:update", notifyErr);
            }
            

            if (willBeTopBid) {
              try {
                await updateOtherBuyerBidsTopBidStatus(vehicleId, buyerId);
                console.log(`[AUTO-BID-RUNNER] ✅ Updated other buyer bids to set top_bid_at_insert = 0`);
              } catch (updateError) {
                console.error(`[AUTO-BID-RUNNER] ❌ Failed to update other buyer bids:`, updateError);
              }

              // Emit to winner/loser for instant feedback
              try {
                const io = getIO();
                io.to(String(buyerId)).emit('isWinning', { vehicleId, auctionEndDttm: (vehicle as any).auction_end_dttm });
                if (topBidderId && topBidderId !== buyerId) {
                  io.to(String(topBidderId)).emit('isLosing', { vehicleId, auctionEndDttm: (vehicle as any).auction_end_dttm });
                }
              } catch (e) {
                console.error('[AUTO-BID-RUNNER] Failed to emit isWinning/isLosing via Socket.IO', e);
              }
            }

            // Update last amount
            lastBidAmt = nextBidAmt;
          } catch (bidError) {
            console.error(`[AUTO-BID-RUNNER] ❌ Failed to place bid for buyer ${buyerId} on vehicle ${vehicleId}:`, bidError);
            break;
          }

          // Refresh top bid after each placement
          const newTop = await getTopBidForVehicle(vehicleId);
          const newTopAmt = newTop ? newTop.amount : Number(vehicle.base_price ?? 0);
          const newTopBidderId = newTop ? newTop.buyer_id : null;

          console.log(`[AUTO-BID-RUNNER] Top bid update:`);
          console.log(`  - Previous topAmt: ${topAmt}`);
          console.log(`  - New topAmt: ${newTopAmt}`);
          console.log(`  - Previous topBidderId: ${topBidderId}`);
          console.log(`  - New topBidderId: ${newTopBidderId}`);

          topAmt = newTopAmt;
          topBidderId = newTopBidderId;

          // If winner changed, publish event so server can forward via Socket.IO
          try {
            if (newTopBidderId && newTopBidderId !== buyerId) {
              const redis = getRedis();
              await redis.publish('vehicle:winner:update', JSON.stringify({
                vehicleId,
                winnerBuyerId: newTopBidderId,
                loserBuyerId: buyerId,
                auctionEndDttm: (vehicle as any).auction_end_dttm,
              }));
            } else if (newTopBidderId === buyerId) {
              const redis = getRedis();
              await redis.publish('vehicle:winner:update', JSON.stringify({
                vehicleId,
                winnerBuyerId: buyerId,
                loserBuyerId: null,
                auctionEndDttm: (vehicle as any).auction_end_dttm,
              }));
            }
          } catch (pubErr) {
            console.error('[AUTO-BID-RUNNER] Failed to publish vehicle:winner:update', pubErr);
          }

          console.log(`[AUTO-BID-RUNNER] ===== END BID LOOP ITERATION #${bidsPlaced} =====`);
        }

        if (processed || bidsPlaced > 0) {
          console.log(`[AUTO-BID-RUNNER] Updating auto-bid record for buyer ${buyerId}, vehicle ${vehicleId}:`);
          console.log(`  - New pending steps: ${pendingSteps}`);
          console.log(`  - New last bid amount: ${lastBidAmt}`);
          
          try {
            const db: Pool = getDb();
            await db.query(
              `UPDATE auto_bid SET pending_steps = ?, last_bid_amt = ? WHERE vehicle_id = ? AND buyer_id = ?`,
              [pendingSteps, lastBidAmt, vehicleId, buyerId]
            );
            console.log(`[AUTO-BID-RUNNER] Successfully updated auto-bid record`);
            totalProcessed++;
          } catch (updateError) {
            console.error(`[AUTO-BID-RUNNER] Failed to update auto-bid record:`, updateError);
          }
        } else {
          console.log(`[AUTO-BID-RUNNER] ===== NO BIDS PLACED - CONDITION ANALYSIS =====`);
          console.log(`[AUTO-BID-RUNNER] Final state for buyer ${buyerId} on vehicle ${vehicleId}: lastBidAmt=${lastBidAmt}, topAmt=${topAmt}, topBidderId=${topBidderId}, pendingSteps=${pendingSteps}`);
        }
        
        console.log(`[AUTO-BID-RUNNER] Completed processing auto-bid for buyer ${buyerId}, vehicle ${vehicleId}`);
        console.log(`[AUTO-BID-RUNNER] ---`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[AUTO-BID-RUNNER] === Auto-bid cycle completed in ${duration}ms ===`);
      console.log(`[AUTO-BID-RUNNER] Summary: ${totalProcessed} auto-bids processed, ${totalBidsPlaced} total bids placed`);
      
    } catch (e) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.error(`[AUTO-BID-RUNNER] Error in auto-bid cycle (${duration}ms):`, (e as any).message);
      console.error(`[AUTO-BID-RUNNER] Stack trace:`, (e as any).stack);
    }
  }, intervalMs);
}


