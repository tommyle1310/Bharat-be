import { listActiveAutoBids } from '../modules/auto_bid/auto_bid.dao';
import { getVehicleById } from '../modules/vehicles/vehicle.dao';
import { getTopBidForVehicle, insertBuyerBid } from '../modules/buyer_bids/buyer_bids.dao';
import { Pool } from 'mysql2/promise';
import { getDb } from '../config/database';

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

        const top = await getTopBidForVehicle(vehicleId);
        let topAmt = top ? top.amount : Number(vehicle.base_price ?? 0);
        const topBidderId = top ? top.buyer_id : null;

        console.log(`[AUTO-BID-RUNNER] Vehicle ${vehicleId} details:`);
        console.log(`  - Base price: ${vehicle.base_price}`);
        console.log(`  - Max price: ${vehicle.max_price}`);
        console.log(`  - Current top bid: ${topAmt} (by buyer ${topBidderId})`);

        let processed = false;
        let bidsPlaced = 0;
        const maxAllowed = Number(vehicle.max_price ?? Number.MAX_SAFE_INTEGER);

        console.log(`[AUTO-BID-RUNNER] ===== DETAILED CONDITION ANALYSIS FOR BUYER ${buyerId} =====`);
        console.log(`[AUTO-BID-RUNNER] Current Values:`);
        console.log(`  - lastBidAmt: ${lastBidAmt} (type: ${typeof lastBidAmt})`);
        console.log(`  - topAmt: ${topAmt} (type: ${typeof topAmt})`);
        console.log(`  - stepAmt: ${stepAmt} (type: ${typeof stepAmt})`);
        console.log(`  - maxBidAmt: ${maxBidAmt} (type: ${typeof maxBidAmt})`);
        console.log(`  - pendingSteps: ${pendingSteps} (type: ${typeof pendingSteps})`);
        console.log(`  - maxAllowed: ${maxAllowed} (type: ${typeof maxAllowed})`);
        console.log(`[AUTO-BID-RUNNER] Calculated Values:`);
        console.log(`  - lastBidAmt + stepAmt: ${lastBidAmt + stepAmt}`);
        console.log(`  - maxBidAmt - lastBidAmt: ${maxBidAmt - lastBidAmt}`);
        console.log(`  - maxAllowed - lastBidAmt: ${maxAllowed - lastBidAmt}`);
        console.log(`[AUTO-BID-RUNNER] Condition Evaluation:`);
        console.log(`  - Condition 1: lastBidAmt < topAmt`);
        console.log(`    * ${lastBidAmt} < ${topAmt} = ${lastBidAmt < topAmt}`);
        console.log(`    * Reason: ${lastBidAmt < topAmt ? 'PASS - Need to outbid current top bid' : 'FAIL - Already at or above top bid'}`);
        console.log(`  - Condition 2: lastBidAmt + stepAmt <= maxBidAmt`);
        console.log(`    * ${lastBidAmt} + ${stepAmt} <= ${maxBidAmt} = ${lastBidAmt + stepAmt <= maxBidAmt}`);
        console.log(`    * Reason: ${lastBidAmt + stepAmt <= maxBidAmt ? 'PASS - Next bid within max budget' : 'FAIL - Next bid would exceed max budget'}`);
        console.log(`  - Condition 3: pendingSteps > 0`);
        console.log(`    * ${pendingSteps} > 0 = ${pendingSteps > 0}`);
        console.log(`    * Reason: ${pendingSteps > 0 ? 'PASS - Has remaining bid steps' : 'FAIL - No more bid steps available'}`);
        console.log(`  - Condition 4: lastBidAmt + stepAmt < maxAllowed`);
        console.log(`    * ${lastBidAmt} + ${stepAmt} < ${maxAllowed} = ${lastBidAmt + stepAmt < maxAllowed}`);
        console.log(`    * Reason: ${lastBidAmt + stepAmt < maxAllowed ? 'PASS - Next bid within vehicle max price' : 'FAIL - Next bid would exceed vehicle max price'}`);
        console.log(`[AUTO-BID-RUNNER] Overall Condition Result:`);
        const condition1 = lastBidAmt < topAmt;
        const condition2 = lastBidAmt + stepAmt <= maxBidAmt;
        const condition3 = pendingSteps > 0;
        const condition4 = lastBidAmt + stepAmt < maxAllowed;
        const overallResult = condition1 && condition2 && condition3 && condition4;
        console.log(`  - ALL CONDITIONS: ${condition1} && ${condition2} && ${condition3} && ${condition4} = ${overallResult}`);
        console.log(`  - Will ${overallResult ? 'ENTER' : 'SKIP'} bid loop`);
        console.log(`[AUTO-BID-RUNNER] ===== END CONDITION ANALYSIS =====`);

        while (
          lastBidAmt < topAmt &&
          lastBidAmt + stepAmt <= maxBidAmt &&
          pendingSteps > 0 &&
          lastBidAmt + stepAmt < maxAllowed
        ) {
          processed = true;
          pendingSteps -= 1;
          lastBidAmt = lastBidAmt + stepAmt;
          bidsPlaced++;

          console.log(`[AUTO-BID-RUNNER] ===== BID LOOP ITERATION #${bidsPlaced} =====`);
          console.log(`[AUTO-BID-RUNNER] Before bid placement:`);
          console.log(`  - Previous lastBidAmt: ${lastBidAmt - stepAmt}`);
          console.log(`  - New lastBidAmt: ${lastBidAmt}`);
          console.log(`  - Previous pendingSteps: ${pendingSteps + 1}`);
          console.log(`  - New pendingSteps: ${pendingSteps}`);
          console.log(`  - Current topAmt: ${topAmt}`);

          try {
            // Determine if this bid will be the new top bid
            const willBeTopBid = lastBidAmt > topAmt;
            const topBidAtInsert = willBeTopBid ? 1 : 0;
            
            console.log(`[AUTO-BID-RUNNER] Attempting to place bid with data:`);
            console.log(`  - vehicle_id: ${vehicleId}`);
            console.log(`  - buyer_id: ${buyerId}`);
            console.log(`  - bid_amt: ${lastBidAmt}`);
            console.log(`  - is_surrogate: 1`);
            console.log(`  - bid_mode: 'A'`);
            console.log(`  - top_bid_at_insert: ${topBidAtInsert} (will be top bid: ${willBeTopBid})`);
            console.log(`  - user_id: 0`);
            console.log(`  - Current top bid: ${topAmt}`);
            console.log(`  - New bid amount: ${lastBidAmt}`);
            console.log(`  - Comparison: ${lastBidAmt} > ${topAmt} = ${willBeTopBid}`);
            
            await insertBuyerBid({
              vehicle_id: vehicleId,
              buyer_id: buyerId,
              bid_amt: lastBidAmt,
              is_surrogate: 1,
              bid_mode: 'A',
              top_bid_at_insert: topBidAtInsert,
              user_id: 0,
            });
            console.log(`[AUTO-BID-RUNNER] ✅ Successfully placed bid ${lastBidAmt} for buyer ${buyerId} on vehicle ${vehicleId}`);
            
            // If this bid becomes the new top bid, update other buyer bids
            if (willBeTopBid) {
              console.log(`[AUTO-BID-RUNNER] This bid becomes the new top bid, updating other buyer bids...`);
              try {
                const { updateOtherBuyerBidsTopBidStatus } = await import('../modules/buyer_bids/buyer_bids.dao');
                await updateOtherBuyerBidsTopBidStatus(vehicleId, buyerId);
                console.log(`[AUTO-BID-RUNNER] ✅ Successfully updated other buyer bids to set top_bid_at_insert = 0`);
              } catch (updateError) {
                console.error(`[AUTO-BID-RUNNER] ❌ Failed to update other buyer bids:`, updateError);
              }
            }
          } catch (bidError) {
            console.error(`[AUTO-BID-RUNNER] ❌ Failed to place bid for buyer ${buyerId} on vehicle ${vehicleId}:`, bidError);
            console.error(`[AUTO-BID-RUNNER] Error details:`, {
              message: (bidError as any).message,
              code: (bidError as any).code,
              errno: (bidError as any).errno,
              sqlState: (bidError as any).sqlState,
              sqlMessage: (bidError as any).sqlMessage
            });
            break; // Stop processing this auto-bid if we can't place bids
          }

          // Update top bid info after each bid
          console.log(`[AUTO-BID-RUNNER] Fetching updated top bid information...`);
          const newTop = await getTopBidForVehicle(vehicleId);
          const newTopAmt = newTop ? newTop.amount : Number(vehicle.base_price ?? 0);
          const newTopBidderId = newTop ? newTop.buyer_id : null;
          
          console.log(`[AUTO-BID-RUNNER] Top bid update:`);
          console.log(`  - Previous topAmt: ${topAmt}`);
          console.log(`  - New topAmt: ${newTopAmt}`);
          console.log(`  - Previous topBidderId: ${topBidderId}`);
          console.log(`  - New topBidderId: ${newTopBidderId}`);
          console.log(`  - Top bid changed: ${topAmt !== newTopAmt ? 'YES' : 'NO'}`);
          
          // Update topAmt for next iteration
          topAmt = newTopAmt;
          
          console.log(`[AUTO-BID-RUNNER] ===== END BID LOOP ITERATION #${bidsPlaced} =====`);
        }

        if (processed) {
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
            totalBidsPlaced += bidsPlaced;
          } catch (updateError) {
            console.error(`[AUTO-BID-RUNNER] Failed to update auto-bid record:`, updateError);
          }
        } else {
          console.log(`[AUTO-BID-RUNNER] ===== NO BIDS PLACED - CONDITION ANALYSIS =====`);
          console.log(`[AUTO-BID-RUNNER] Final condition check for buyer ${buyerId} on vehicle ${vehicleId}:`);
          console.log(`  - Condition 1: lastBidAmt(${lastBidAmt}) < topAmt(${topAmt}) = ${lastBidAmt < topAmt}`);
          console.log(`  - Condition 2: lastBidAmt(${lastBidAmt}) + stepAmt(${stepAmt}) <= maxBidAmt(${maxBidAmt}) = ${lastBidAmt + stepAmt <= maxBidAmt}`);
          console.log(`  - Condition 3: pendingSteps(${pendingSteps}) > 0 = ${pendingSteps > 0}`);
          console.log(`  - Condition 4: lastBidAmt(${lastBidAmt}) + stepAmt(${stepAmt}) < maxAllowed(${maxAllowed}) = ${lastBidAmt + stepAmt < maxAllowed}`);
          console.log(`[AUTO-BID-RUNNER] Reasons for no bids:`);
          if (!(lastBidAmt <= topAmt)) {
            console.log(`  ❌ Already at or above top bid (${lastBidAmt} > ${topAmt})`);
          }
          if (!(lastBidAmt + stepAmt <= maxBidAmt)) {
            console.log(`  ❌ Next bid would exceed max budget (${lastBidAmt + stepAmt} > ${maxBidAmt})`);
          }
          if (!(pendingSteps > 0)) {
            console.log(`  ❌ No more bid steps available (${pendingSteps} <= 0)`);
          }
          if (!(lastBidAmt + stepAmt < maxAllowed)) {
            console.log(`  ❌ Next bid would exceed vehicle max price (${lastBidAmt + stepAmt} >= ${maxAllowed})`);
          }
          console.log(`[AUTO-BID-RUNNER] ===== END NO BIDS ANALYSIS =====`);
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


