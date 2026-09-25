-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Line Up" (
    "id" BIGSERIAL NOT NULL,
    "team_name" TEXT NOT NULL,
    "day" TEXT,
    "image_src" TEXT,
    "performanceOrder" SMALLINT,

    CONSTRAINT "setlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setlist" (
    "id" BIGSERIAL NOT NULL,
    "teamId" BIGINT,
    "title" TEXT NOT NULL,
    "singer" TEXT,
    "album" TEXT,
    "youtube_url" TEXT,

    CONSTRAINT "Setlist_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Setlist" ADD CONSTRAINT "fk_setlist_team" FOREIGN KEY ("teamId") REFERENCES "Line Up"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

