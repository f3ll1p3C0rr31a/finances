CREATE TABLE "SubscriptionTag" (
  "subscriptionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,

  CONSTRAINT "SubscriptionTag_pkey" PRIMARY KEY ("subscriptionId", "tagId")
);

ALTER TABLE "SubscriptionTag"
ADD CONSTRAINT "SubscriptionTag_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionTag"
ADD CONSTRAINT "SubscriptionTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
