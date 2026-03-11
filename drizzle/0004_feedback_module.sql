-- Feedback Module Migration

CREATE TABLE `feedback_forms` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `targetType` enum('global','volunteers','restaurant_clients','foodstore_clients') NOT NULL DEFAULT 'global',
  `isAnonymousAllowed` boolean NOT NULL DEFAULT true,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `feedback_forms_id` PRIMARY KEY(`id`)
);

CREATE TABLE `feedback_questions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `formId` int NOT NULL,
  `question` text NOT NULL,
  `type` enum('rating','text','multiple_choice','yes_no') NOT NULL,
  `options` json,
  `orderIndex` int NOT NULL DEFAULT 0,
  `required` boolean NOT NULL DEFAULT false,
  CONSTRAINT `feedback_questions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `feedback_responses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `formId` int NOT NULL,
  `userId` int,
  `userEmail` varchar(320),
  `userName` varchar(255),
  `isAnonymous` boolean NOT NULL DEFAULT false,
  `source` enum('public_page','email_campaign') NOT NULL DEFAULT 'public_page',
  `moderation` enum('pending','processed','to_analyze','important') NOT NULL DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `feedback_responses_id` PRIMARY KEY(`id`)
);

CREATE TABLE `feedback_answers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `responseId` int NOT NULL,
  `questionId` int NOT NULL,
  `answerText` text,
  `answerRating` int,
  `answerChoice` varchar(500),
  CONSTRAINT `feedback_answers_id` PRIMARY KEY(`id`)
);

CREATE TABLE `feedback_campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `targetGroup` enum('volunteers','restaurant_clients','foodstore_clients','all') NOT NULL,
  `formId` int NOT NULL,
  `emailSubject` varchar(500) NOT NULL,
  `emailContent` text NOT NULL,
  `status` enum('draft','scheduled','sent') NOT NULL DEFAULT 'draft',
  `sentAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `feedback_campaigns_id` PRIMARY KEY(`id`)
);

CREATE TABLE `feedback_campaign_recipients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaignId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `userId` int,
  `token` varchar(64) NOT NULL,
  `openedAt` timestamp,
  `submittedAt` timestamp,
  CONSTRAINT `feedback_campaign_recipients_id` PRIMARY KEY(`id`),
  CONSTRAINT `feedback_campaign_recipients_token_unique` UNIQUE(`token`)
);

-- Seed default feedback form
INSERT INTO `feedback_forms` (`title`, `description`, `targetType`, `isAnonymousAllowed`, `active`)
VALUES ('Formulaire général Bab Rayan', 'Donnez-nous votre avis sur les actions de l\'association', 'global', true, true);

-- Seed default questions for the form (formId = 1)
INSERT INTO `feedback_questions` (`formId`, `question`, `type`, `orderIndex`, `required`)
VALUES
  (1, 'Quelle est votre satisfaction globale ?', 'rating', 1, true),
  (1, 'Comment avez-vous connu l\'association ?', 'multiple_choice', 2, false),
  (1, 'Qu\'avez-vous apprécié ?', 'text', 3, false),
  (1, 'Que pouvons-nous améliorer ?', 'text', 4, false),
  (1, 'Recommanderiez-vous l\'association ?', 'yes_no', 5, false);

UPDATE `feedback_questions`
SET `options` = JSON_ARRAY('Réseaux sociaux', 'Bouche à oreille', 'Mosquée', 'Presse', 'Autre')
WHERE `formId` = 1 AND `type` = 'multiple_choice';
