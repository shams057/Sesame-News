-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Base de données : `sesame_news`

-- --------------------------------------------------------
-- 1. Table `categories`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `categories`;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `libelle` varchar(20) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `libelle` (`libelle`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Table `superadmins`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `superadmins`;
CREATE TABLE IF NOT EXISTS `superadmins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `login` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Table `users`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `login` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `firstname` varchar(15) NOT NULL,
  `lastname` varchar(15) NOT NULL,
  `GC` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `categorieId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `categorieId` (`categorieId`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Table `news`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `news`;
CREATE TABLE IF NOT EXISTS `news` (
  `id` int NOT NULL AUTO_INCREMENT,
  `titre` varchar(50) NOT NULL,
  `description` text,
  `path` text,
  `all` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `categorieId` int DEFAULT NULL,
  `superAdminId` int DEFAULT NULL,
  `userId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `categorieId` (`categorieId`),
  KEY `superAdminId` (`superAdminId`),
  KEY `userId` (`userId`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Table `tokensuperadmins`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tokensuperadmins`;
CREATE TABLE IF NOT EXISTS `tokensuperadmins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `superAdminId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `superAdminId` (`superAdminId`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Table `tokenusers`
-- --------------------------------------------------------
DROP TABLE IF EXISTS `tokenusers`;
CREATE TABLE IF NOT EXISTS `tokenusers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Déchargement des données (INSERTS)
-- --------------------------------------------------------

--
-- Déchargement des données de la table `categories`
--
INSERT INTO `categories` (`id`, `libelle`, `createdAt`, `updatedAt`) VALUES
(1, 'Nouveau libelle', '2026-09-29 01:13:12', '2026-09-29 01:15:05'),
(3, 'Informatique', '2026-09-29 01:14:53', '2026-09-29 01:14:53');

--
-- Déchargement des données de la table `superadmins`
--
INSERT INTO `superadmins` (`id`, `login`, `password`, `createdAt`, `updatedAt`) VALUES
(1, 'nouveau', '$2b$10$3nIraGSbKi63iT4GxBTw5uIJDDurlpTyo1S/7XTN.EN9gTN6.kkS6', '2026-09-29 01:10:38', '2026-09-29 01:11:24'), (2, 'admin', '$2b$10$L8kt8RMzdn7Nj190YyogK.8g1g.xQfzalI/5XbbaL6uiEd2N/uj8O', '2026-09-29 03:37:22', '2026-09-29 03:55:18');

--
-- Déchargement des données de la table `users`
--
INSERT INTO `users` (`id`, `login`, `password`, `firstname`, `lastname`, `GC`, `createdAt`, `updatedAt`, `categorieId`) VALUES
(2, 'jean', '$2b$10$Ik/Mlc9ymy89iBj.QMtZnOWKqStDKKsTe8OZ5GoeQ4AoYkRIDgqgi', 'Jean', 'Dupont', 1, '2026-09-29 01:21:31', '2026-09-29 01:21:31', 1), (3, 'jean2', '$2b$10$jZpVZCdZ28vTc2VdUJERcuqUhkDJCN9.h.yUy20ivqVN6MnhgK7I.', 'Jean2', 'Dupont', 0, '2026-09-29 01:21:58', '2026-09-29 01:21:58', 3),
(4, 'user', '$2b$10$5vWu9.Yv.b.t5ZKXkcCOquPaD/VS.iwGakYmfe7SeK6mGx5VEsLPa', 'Jean2', 'Dupont', 0, '2026-09-29 07:25:58', '2026-09-29 07:25:58', 1);

--
-- Déchargement des données de la table `news`
--
INSERT INTO `news` (`id`, `titre`, `description`, `path`, `all`, `createdAt`, `updatedAt`, `categorieId`, `superAdminId`, `userId`) VALUES
(1, 'Titre', 'DescCat1', '/img.jpg', 0, '2026-09-29 01:16:20', '2026-09-29 01:16:20', 1, 1, NULL),
(3, 'Titre', 'DescCAt3', '/uploads/1790669493836-logo3.jpeg', 0, '2026-09-29 01:19:09', '2026-09-29 08:11:33', 3, 2, NULL),
(4, 'Mon titre', 'Ma description', '/uploads/1790645616034-test4+.pdf', 1, '2026-09-29 01:33:36', '2026-09-29 01:33:36', NULL, NULL, NULL),
(6, 'dsd', 'qsdqsd', '/uploads/1790669470218-LOGO_FINAL.jpeg', 1, '2026-09-29 08:11:10', '2026-09-29 08:11:10', NULL, 2, NULL),
(7, 'kqffaqze', 'azdzad', '/uploads/1790671350921-logo1.jpeg', 1, '2026-09-29 08:42:30', '2026-09-29 08:42:30', NULL, 2, NULL),
(8, 'mkj14', 'juh44', '/uploads/1790671699732-logo4.png', 1, '2026-09-29 08:48:19', '2026-09-29 08:48:19', NULL, 2, NULL),
(9, 'test', 'test\r\n\r\nhttps://sesame.konosys.com/konosys/K8_Accueil.aspx', '/uploads/1790682525327-logo4.png', 1, '2026-09-29 11:48:45', '2026-09-29 11:51:18', NULL, 2, NULL),
(10, 'test2', 'This article is about the president of the United States. For other uses, see Gerald Ford (disambiguation).\r\n\"Gerald Rudolph Ford\" redirects here. Not to be confused with his stepfather, Gerald Rudolff Ford.\r\nGerald Ford\r\n\r\nOfficial portrait, 1974\r\n38th President of the United States\r\nIn office\r\nAugust 9, 1974 – January 20, 1977\r\nVice President	\r\nVacant (Aug–Dec 1974)\r\nNelson Rockefeller (1974–1977)\r\nPreceded by	Richard Nixon\r\nSucceeded by	Jimmy Carter\r\n40th Vice President of the United States\r\nIn office\r\nDecember 6, 1973 – August 9, 1974\r\nPresident	Richard Nixon\r\nPreceded by	Spiro Agnew\r\nSucceeded by	Nelson Rockefeller\r\nMember of the U.S. House of Representatives\r\nfrom Michigan\'s 5th district\r\nIn office\r\nJanuary 3, 1949 – December 6, 1973\r\nPreceded by	Bartel J. Jonkman\r\nSucceeded by	Richard Vander Veen\r\nHouse positions\r\nPersonal details\r\nBorn	Leslie Lynch King Jr.\r\nJuly 14, 1913\r\nOmaha, Nebraska, U.S.\r\nDied	December 26, 2006 (aged 93)\r\nRancho Mirage, California, U.S.\r\nResting place	Gerald R. Ford Presidential Museum\r\nParty	Republican\r\nSpouse	Betty Bloomer ​(m. 1948)​\r\nChildren	4, including Steven and Susan\r\nParents	\r\nLeslie Lynch King Sr.\r\nDorothy Ayer Gardner Ford\r\nEducation	\r\nUniversity of Michigan (BA)\r\nYale University (LLB)\r\nSignature	Cursive signature in ink\r\nMilitary service\r\nBranch/service	United States Navy\r\nYears of service	1942–1946\r\nRank	Lieutenant Commander\r\nBattles/wars	\r\nWorld War II\r\nBattle of the Philippine Sea\r\nAwards	\r\nAmerican Campaign Medal\r\nAsiatic–Pacific Campaign Medal (with 9 campaign stars)\r\nPhilippine Liberation Ribbon (with 2 campaign stars)\r\nWorld War II Victory Medal\r\nFootball career\r\nNo. 48\r\nPosition	Center\r\nCareer information\r\nHigh school	Grand Rapids South High School\r\nCollege	Michigan (1932–1934)\r\nAwards and highlights\r\n2× National champion (1932, 1933)\r\nMeyer Morton Award (1932)\r\nMichigan Wolverines No. 48 retired\r\nOther information\r\nFord\'s voice\r\nDuration: 7 minutes and 54 seconds.7:54\r\nFord\'s inaugural address as president of the United States\r\nRecorded August 9, 1974\r\nGerald Rudolph Ford Jr. (born Leslie Lynch King Jr.; July 14, 1913 – December 26, 2006) was the 38th president of the United States, serving from 1974 to 1977. He assumed the presidency after the resignation of Richard Nixon, under whom he served as the 40th vice president from 1973 to 1974 after the resignation of Spiro Agnew. A member of the Republican Party, Ford previously served in the United States House of Representatives from 1949 to 1973.\r\n\r\nFord was born in Omaha, Nebraska, and raised in Grand Rapids, Michigan. He attended the University of Michigan, where he also played for the university football team, winning two national championships, before eventually graduating from Yale Law School with a Bachelor of Laws. Afterward, he served in the U.S. Naval', '/uploads/1790682827034-7b94392a-e187-4e15-afe1-41f987d9115d.jpeg', 1, '2026-09-29 11:53:47', '2026-09-29 11:53:47', NULL, 2, NULL),
(11, 'video', 'video', '/uploads/1790725800215-certix_video.mp4', 1, '2026-09-29 23:50:00', '2026-09-29 23:50:00', NULL, 2, NULL),
(12, 'shams', 'shams', '/uploads/1791017506806-SQL SERVER-part1.mp4', 1, '2026-10-03 08:51:47', '2026-10-03 08:51:47', NULL, 2, NULL);

--
-- Déchargement des données de la table `tokensuperadmins`
--
INSERT INTO `tokensuperadmins` (`id`, `token`, `createdAt`, `updatedAt`, `superAdminId`) VALUES
(1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJTLUEiLCJpYXQiOjE3OTA2NDQyNTJ9.c__TRUsCLiyhXhtwwOhTECvxzG7c1B6jXnO0zG-INFY', '2026-09-29 01:10:52', '2026-09-29 01:10:52', 1),
(3, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJTLUEiLCJpYXQiOjE3OTA2NTMwNDV9.ff1QWBztqrgadlpFV8bnnc50isgxoUj8VEVwBw7wTt0', '2026-09-29 03:37:25', '2026-09-29 03:37:25', 2),
(7, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJTLUEiLCJpYXQiOjE3OTA2ODI0Njh9.VNL3lkjrlOCK1v65up92dnYpaxLiE9qiujI9lCUKE6A', '2026-09-29 11:47:48', '2026-09-29 11:47:48', 2),
(8, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJTLUEiLCJpYXQiOjE3OTEwMTczODN9.gjUmGGwAjI5lYdMdBMK_q0x-7JChHw1fqdrlKFVeo5s', '2026-10-03 08:49:43', '2026-10-03 08:49:43', 2);

--
-- Déchargement des données de la table `tokenusers`
--
INSERT INTO `tokenusers` (`id`, `token`, `createdAt`, `updatedAt`, `userId`) VALUES
(9, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkwNjY4MDg5fQ.JC0J39lp_If6X9eIxHqssEJKxShbpluiMUFE_Akj9MM', '2026-09-29 07:48:09', '2026-09-29 07:48:09', 2),
(10, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkwNjY4MTM4fQ.sKRAVWT3YImD4w8wh2lMddJHqHOo9v0dZaUA0akv08Q', '2026-09-29 07:48:58', '2026-09-29 07:48:58', 2),
(11, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkwNjY4MjA1fQ.bwclinaZSRre1ocGuIlsqTuwrKCu8ZbQGCpLhACLvU0', '2026-09-29 07:50:05', '2026-09-29 07:50:05', 3),
(12, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkwNjY4MzI3fQ.TnsL7VEmSTHfquxyt4m_qT0pp8ETqz_JS0Msq7ORpYk', '2026-09-29 07:52:07', '2026-09-29 07:52:07', 3),
(24, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkwNjgyNTUzfQ.MpWjdX6nxNCcKIICD8NS1tMFI7NuiV92-xztV-KN6ds', '2026-09-29 11:49:13', '2026-09-29 11:49:13', 4),
(33, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQsInJvbGUiOiJVc0VyIiwiaWF0IjoxNzkxMDE5NTczfQ.CjBy16U2PC7t_vEqZdCp0BSgFXwzD6wB88GxNHzZZAA', '2026-10-03 09:26:13', '2026-10-03 09:26:13', 4);

-- --------------------------------------------------------
-- Contraintes de Clés Étrangères
-- --------------------------------------------------------

ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`categorieId`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `news`
  ADD CONSTRAINT `news_ibfk_1` FOREIGN KEY (`categorieId`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `news_ibfk_2` FOREIGN KEY (`superAdminId`) REFERENCES `superadmins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `news_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tokensuperadmins`
  ADD CONSTRAINT `tokensuperadmins_ibfk_1` FOREIGN KEY (`superAdminId`) REFERENCES `superadmins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tokenusers`
  ADD CONSTRAINT `tokenusers_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;