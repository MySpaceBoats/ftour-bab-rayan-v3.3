ALTER TABLE `volunteers` RENAME COLUMN `qrCode` TO `qrToken`;--> statement-breakpoint
ALTER TABLE `volunteers` DROP INDEX `volunteers_qrCode_unique`;--> statement-breakpoint
ALTER TABLE `volunteers` ADD `qrStatus` enum('generated','validated','expired','invalid') DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE `volunteers` ADD CONSTRAINT `volunteers_qrToken_unique` UNIQUE(`qrToken`);