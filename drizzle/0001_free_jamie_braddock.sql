CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`subject` varchar(300),
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`repliedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`donationReference` varchar(20) NOT NULL,
	`donorName` varchar(200) NOT NULL,
	`donorEmail` varchar(320) NOT NULL,
	`donorPhone` varchar(20),
	`amount` decimal(10,2) NOT NULL,
	`paymentMethod` enum('transfer','on_site') NOT NULL,
	`message` text,
	`isAnonymous` boolean NOT NULL DEFAULT false,
	`acceptsUpdates` boolean NOT NULL DEFAULT false,
	`donationStatus` enum('promised','pending','received','cancelled') NOT NULL DEFAULT 'promised',
	`emailSent` boolean NOT NULL DEFAULT false,
	`processedBy` int,
	`processedAt` timestamp,
	`receivedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `donations_id` PRIMARY KEY(`id`),
	CONSTRAINT `donations_donationReference_unique` UNIQUE(`donationReference`)
);
--> statement-breakpoint
CREATE TABLE `faq_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`category` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faq_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goodie_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goodieId` int NOT NULL,
	`size` varchar(20),
	`color` varchar(50),
	`sku` varchar(50),
	`stock` int NOT NULL DEFAULT 0,
	`priceModifier` decimal(10,2) DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goodie_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goodies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`imageUrl` text,
	`category` varchar(100),
	`isBestSeller` boolean NOT NULL DEFAULT false,
	`isNew` boolean NOT NULL DEFAULT false,
	`isRamadanEdition` boolean NOT NULL DEFAULT false,
	`totalStock` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `goodies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_gallery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200),
	`description` text,
	`mediaUrl` text NOT NULL,
	`mediaType` varchar(20) NOT NULL,
	`thumbnailUrl` text,
	`year` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_gallery_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`goodieId` int NOT NULL,
	`variantId` int,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` decimal(10,2) NOT NULL,
	`totalPrice` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderReference` varchar(20) NOT NULL,
	`customerName` varchar(200) NOT NULL,
	`customerEmail` varchar(320) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`totalAmount` decimal(10,2) NOT NULL,
	`orderStatus` enum('reserved','confirmed','paid','delivered','cancelled') NOT NULL DEFAULT 'reserved',
	`pickupDate` timestamp,
	`pickupLocation` text,
	`emailSent` boolean NOT NULL DEFAULT false,
	`processedBy` int,
	`processedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderReference_unique` UNIQUE(`orderReference`)
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`logoUrl` text,
	`websiteUrl` text,
	`description` text,
	`category` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ramadan_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` timestamp NOT NULL,
	`dayNumber` int NOT NULL,
	`maxCapacity` int NOT NULL DEFAULT 50,
	`currentCount` int NOT NULL DEFAULT 0,
	`isClosed` boolean NOT NULL DEFAULT false,
	`location` text,
	`startTime` varchar(10),
	`endTime` varchar(10),
	`instructions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ramadan_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`volunteerId` int NOT NULL,
	`scannedBy` int NOT NULL,
	`action` varchar(50) NOT NULL,
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(200) NOT NULL,
	`authorRole` varchar(100),
	`content` text NOT NULL,
	`avatarUrl` text,
	`rating` int,
	`isApproved` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testimonials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`city` varchar(100),
	`dayId` int NOT NULL,
	`qrCode` varchar(64) NOT NULL,
	`volunteerStatus` enum('registered','confirmed','present','absent','cancelled') NOT NULL DEFAULT 'registered',
	`scannedAt` timestamp,
	`scannedBy` int,
	`acceptedTerms` boolean NOT NULL DEFAULT false,
	`emailSent` boolean NOT NULL DEFAULT false,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `volunteers_id` PRIMARY KEY(`id`),
	CONSTRAINT `volunteers_qrCode_unique` UNIQUE(`qrCode`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','super_admin','admin_ops','admin_boutique','admin_dons','scanner') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);