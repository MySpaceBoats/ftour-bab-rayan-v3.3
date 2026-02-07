ALTER TABLE `orders` ADD `deliveryMode` varchar(20) DEFAULT 'pickup' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryFee` decimal(10,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryAddress` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryInstructions` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryNotes` text;