-- AlterTable
ALTER TABLE "User"
ADD COLUMN "roles" "Role"[] NOT NULL,
ADD CONSTRAINT "User_roles_non_empty_check" CHECK (cardinality("roles") >= 1);
