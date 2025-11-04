-- Create Tag table and implicit many-to-many join table with Company

-- CreateTable Tag
CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- Uniques on Tag
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_slug_key" ON "Tag"("slug") WHERE "slug" IS NOT NULL;

-- Create implicit join table (Prisma default naming convention)
CREATE TABLE IF NOT EXISTS "_CompanyToTag" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

-- Unique and index for join table
CREATE UNIQUE INDEX IF NOT EXISTS "_CompanyToTag_AB_unique" ON "_CompanyToTag"("A", "B");
CREATE INDEX IF NOT EXISTS "_CompanyToTag_B_index" ON "_CompanyToTag"("B");

-- FKs
ALTER TABLE "_CompanyToTag"
  ADD CONSTRAINT "_CompanyToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CompanyToTag"
  ADD CONSTRAINT "_CompanyToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


