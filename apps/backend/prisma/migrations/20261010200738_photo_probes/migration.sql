-- CreateTable
CREATE TABLE "photo_probes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exif" JSONB,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_probes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_probes_user_idx" ON "photo_probes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "photo_probes_expiry_idx" ON "photo_probes"("createdAt");

-- AddForeignKey
ALTER TABLE "photo_probes" ADD CONSTRAINT "photo_probes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
