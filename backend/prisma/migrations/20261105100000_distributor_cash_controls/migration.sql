-- DropIndex
DROP INDEX "CashHandover_srId_businessDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "CashHandover_srId_distributorId_businessDate_key" ON "CashHandover"("srId", "distributorId", "businessDate");
