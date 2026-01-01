-- Add 'message' type to notifications enum
ALTER TABLE notifications MODIFY COLUMN type ENUM('like', 'comment', 'organization_project', 'message') NOT NULL;