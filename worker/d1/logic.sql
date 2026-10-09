-- Business logic that lived in Postgres triggers, re-expressed as SQLite triggers for the generated D1 tables.
-- Idempotent (IF NOT EXISTS). Apply AFTER the data copy: replaying INSERTs on t_volunteers would bump counters.
-- Apply: wrangler d1 execute <db> --remote --file worker/d1/logic.sql

-- ramadan_days.registered_count follows volunteers (was update_registered_count())
CREATE TRIGGER IF NOT EXISTS t_volunteers_count_ins AFTER INSERT ON t_volunteers
BEGIN
  UPDATE t_ramadan_days SET registered_count = registered_count + 1 WHERE id = NEW.day_id;
END;
CREATE TRIGGER IF NOT EXISTS t_volunteers_count_del AFTER DELETE ON t_volunteers
BEGIN
  UPDATE t_ramadan_days SET registered_count = registered_count - 1 WHERE id = OLD.day_id;
END;
CREATE TRIGGER IF NOT EXISTS t_volunteers_count_upd AFTER UPDATE OF day_id ON t_volunteers
WHEN OLD.day_id != NEW.day_id
BEGIN
  UPDATE t_ramadan_days SET registered_count = registered_count - 1 WHERE id = OLD.day_id;
  UPDATE t_ramadan_days SET registered_count = registered_count + 1 WHERE id = NEW.day_id;
END;

-- stock can never go negative (was RAISE EXCEPTION in inventory_upsert_balance); aborts the whole D1 batch
CREATE TRIGGER IF NOT EXISTS t_inv_balance_nonneg BEFORE UPDATE OF quantity_on_hand ON t_inventory_stock_balances
WHEN NEW.quantity_on_hand < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock insuffisant');
END;
