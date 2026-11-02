CREATE TABLE `query_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queryId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `query_favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `query_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`question` text NOT NULL,
	`sql` text NOT NULL,
	`explanation` text,
	`chartType` enum('bar','line','table') NOT NULL DEFAULT 'table',
	`rowCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `query_history_id` PRIMARY KEY(`id`)
);
