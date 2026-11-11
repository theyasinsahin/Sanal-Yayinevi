import mongoose from 'mongoose';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Notification from '../src/models/notification.js';
import { FundingCampaign, PrintApplication } from '../src/models/printFunding.js';
import { getNotifications } from '../src/services/scoreService.js';

beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);

test('legacy print notices resolve their book for both application decisions and campaign updates', async () => {
  const [userId, otherId, bookId, campaignId, applicationId] = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
  await FundingCampaign.collection.insertOne({ _id: campaignId, bookId, authorId: userId });
  await PrintApplication.collection.insertOne({ _id: applicationId, bookId, authorId: userId });
  const notices = await Notification.create([
    { userId, type: 'PRINT_UPDATE', title: 'Başvuru', message: 'Karar', dedupKey: `print:review:${applicationId}:2:${userId}` },
    { userId, type: 'PRINT_UPDATE', title: 'Kampanya', message: 'Basım', meta: { campaignId } },
    { userId, type: 'POINTS_EARNED', title: 'Puan', message: '+5', meta: { bookId } },
    { userId: otherId, type: 'PRINT_UPDATE', title: 'Diğer hesap', message: 'Karar' },
  ]);
  const result = await getNotifications(userId);
  expect(result).toHaveLength(3);
  for (const notice of result.filter(item => item.type === 'PRINT_UPDATE')) {
    expect(notice.meta).toMatchObject({ bookId: String(bookId), authorId: String(userId) });
  }
  expect(result.find(item => item.type === 'POINTS_EARNED').meta).toEqual({ bookId });
  expect((await Notification.findById(notices[0].id)).meta).toEqual({});
});
