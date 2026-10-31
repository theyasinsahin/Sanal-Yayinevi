import mongoose from 'mongoose';

const { Schema } = mongoose;
const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const integer = (defaultValue = 0) => ({ type: Number, default: defaultValue, min: 0, max: 100000000000, validate: Number.isSafeInteger });
const options = { timestamps: true, strict: 'throw' };
function appendOnly(schema) {
  schema.pre('save', function () { if (!this.isNew) throw new Error('Değişmez kayıt güncellenemez.'); });
  for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
    schema.pre(operation, function () { throw new Error('Değişmez kayıt güncellenemez veya silinemez.'); });
  }
}
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

const asset = new Schema({ ownerId: ref('User'), sha256: { type: String, required: true }, bytes: integer(), filename: { type: String, maxlength: 120 }, mime: { type: String, enum: ['application/pdf'], required: true }, data: { type: Buffer, required: true, select: false } }, options);
asset.index({ ownerId: 1, sha256: 1 }, { unique: true }); appendOnly(asset);
export const PrintAsset = model('PrintAsset', asset);

const version = new Schema({ classificationReview: { type: Schema.Types.Mixed }, bookId: ref('Book'), authorId: ref('User'), title: { type: String, required: true }, authorName: { type: String, required: true }, chapters: { type: [new Schema({ sourceId: ref('Chapter'), title: String, content: String }, { _id: false })], required: true }, wordCount: integer(), estimatedPages: integer(), contentHash: { type: String, required: true }, specification: { type: Schema.Types.Mixed, required: true }, declarations: { type: Schema.Types.Mixed, required: true } }, options);
version.index({ bookId: 1, createdAt: -1 }); appendOnly(version);
export const BookPrintVersion = model('BookPrintVersion', version);

const tariff = new Schema({ version: { type: String, required: true, unique: true, maxlength: 80 }, label: { type: String, required: true, maxlength: 200 }, environment: { type: String, enum: ['SANDBOX'], default: 'SANDBOX' }, pageRates: { type: Schema.Types.Mixed, required: true }, coverRates: { type: Schema.Types.Mixed, required: true }, dimensionBps: { type: Schema.Types.Mixed, required: true }, colorBps: integer(10000), setupMinor: integer(), packagingPerUnitMinor: integer(), shippingPerUnitMinor: integer(), serviceMinor: integer(), taxBps: integer(), feeBps: integer(), policy: { donationMinMinor: integer(5000), donationMaxMinor: integer(10000000), quickAmountsMinor: { type: [Number], default: [5000, 10000, 25000, 50000] }, campaignDays: integer(30), reservationMinutes: integer(15), maxOrderQuantity: integer(10) }, createdBy: ref('User') }, options);
appendOnly(tariff);
export const PrintTariff = model('PrintTariff', tariff);

const application = new Schema({ bookId: ref('Book'), authorId: ref('User'), versionId: ref('BookPrintVersion'), previousVersionIds: [ref('BookPrintVersion')], revision: integer(), state: { type: String, enum: ['PREPARING', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PREPARING' }, open: { type: Boolean, default: true }, tariffId: ref('PrintTariff'), estimate: Schema.Types.Mixed, verifiedQuote: Schema.Types.Mixed, approvedTargetMinor: integer(), approvedUnitPriceMinor: integer(), reviewNote: { type: String, default: '', maxlength: 2000 }, reviewedBy: ref('User', false), submittedAt: Date, reviewedAt: Date }, options);
application.index({ bookId: 1 }, { unique: true, partialFilterExpression: { open: true } });
application.index({ authorId: 1, createdAt: -1 }); application.index({ state: 1, createdAt: -1 });
export const PrintApplication = model('PrintApplication', application);

const campaign = new Schema({ bookId: ref('Book'), authorId: ref('User'), applicationId: { ...ref('PrintApplication'), unique: true }, versionId: { ...ref('BookPrintVersion'), unique: true }, tariffId: ref('PrintTariff'), environment: { type: String, enum: ['SANDBOX'], default: 'SANDBOX' }, title: String, state: { type: String, enum: ['ACTIVE', 'CLOSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDING', 'REFUNDED'], default: 'ACTIVE' }, activeLock: { type: Boolean, default: true }, outcome: { type: String, enum: ['TARGET', 'DEADLINE', 'CANCELLED'] }, targetMinor: integer(), unitPriceMinor: integer(), acceptedMinor: integer(), reservedMinor: integer(), printRun: integer(), soldQuantity: integer(), reservedQuantity: integer(), supporterCount: integer(), startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true }, reconciledAt: Date, financeIssue: { type: String, default: '' }, productionState: { type: String, enum: ['NOT_STARTED', 'PREPARATION', 'PRINTER_APPROVED', 'STARTED', 'PRINTING', 'PRINTED', 'PACKAGING', 'SHIPPING', 'DELIVERED', 'COMPLETED', 'ISSUE', 'CANCELLED'], default: 'NOT_STARTED' }, previousProductionState: String, productionRevision: integer() }, options);
campaign.index({ authorId: 1 }, { unique: true, partialFilterExpression: { activeLock: true } });
campaign.index({ bookId: 1 }, { unique: true, partialFilterExpression: { activeLock: true } });
campaign.index({ state: 1, endsAt: 1 });
export const FundingCampaign = model('FundingCampaign', campaign);

const payment = new Schema({ userId: ref('User'), campaignId: ref('FundingCampaign'), bookId: ref('Book'), idempotencyKey: { type: String, required: true, maxlength: 100 }, requestHash: { type: String, required: true }, provider: { type: String, enum: ['SANDBOX', 'IYZICO_SANDBOX'], default: 'SANDBOX' }, providerId: String, currency: { type: String, enum: ['TRY'], default: 'TRY' }, amountMinor: integer(), donationMinor: integer(), orderMinor: integer(), quantity: integer(), state: { type: String, enum: ['CREATED', 'PENDING', 'FAILED', 'CANCELLED', 'CAPTURED', 'REFUND_PENDING', 'REFUNDED'], default: 'CREATED' }, allocated: { type: Boolean, default: false }, captured: { type: Boolean, default: false }, capturedAt: Date, reconciledAt: Date, issue: { type: String, default: '' } }, options);
payment.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
payment.index({ providerId: 1 }, { unique: true, partialFilterExpression: { providerId: { $type: 'string' } } });
payment.index({ campaignId: 1, state: 1 }); payment.index({ state: 1, reconciledAt: 1, _id: 1 }); payment.index({ userId: 1, createdAt: -1 });
export const FundingPayment = model('FundingPayment', payment);

const reservation = new Schema({ paymentId: { ...ref('FundingPayment'), unique: true }, campaignId: ref('FundingCampaign'), amountMinor: integer(), quantity: integer(), state: { type: String, enum: ['HELD', 'CONSUMED', 'RELEASED', 'EXPIRED'], default: 'HELD' }, expiresAt: { type: Date, required: true } }, options);
reservation.index({ state: 1, expiresAt: 1 });
export const PaymentReservation = model('PaymentReservation', reservation);

const event = new Schema({ provider: { type: String, enum: ['SANDBOX', 'IYZICO_SANDBOX'], default: 'SANDBOX' }, eventId: { type: String, required: true, unique: true }, paymentId: ref('FundingPayment'), payloadHash: { type: String, required: true }, providerState: String }, options);
appendOnly(event); export const FundingPaymentEvent = model('FundingPaymentEvent', event);

const ledger = new Schema({ key: { type: String, unique: true, required: true }, campaignId: ref('FundingCampaign'), paymentId: ref('FundingPayment'), userId: ref('User'), kind: { type: String, enum: ['CAPTURE', 'ALLOCATION', 'REFUND', 'DEALLOCATION'], required: true }, amountMinor: integer(), environment: { type: String, enum: ['SANDBOX'], default: 'SANDBOX' } }, options);
ledger.index({ campaignId: 1, kind: 1 }); appendOnly(ledger);
export const FundingLedger = model('FundingLedger', ledger);

const refund = new Schema({ paymentId: { ...ref('FundingPayment'), unique: true }, campaignId: ref('FundingCampaign'), userId: ref('User'), amountMinor: integer(), reason: { type: String, required: true }, state: { type: String, enum: ['PENDING', 'PROCESSING', 'FAILED', 'SUCCEEDED'], default: 'PENDING' }, attempts: integer(), leaseUntil: Date, retryAt: Date, providerRefundId: String, lastError: String }, options);
refund.index({ state: 1, retryAt: 1, leaseUntil: 1 }); export const FundingRefund = model('FundingRefund', refund);

const order = new Schema({ paymentId: { ...ref('FundingPayment'), unique: true }, campaignId: ref('FundingCampaign'), userId: ref('User'), quantity: integer(), unitPriceMinor: integer(), totalMinor: integer(), state: { type: String, enum: ['AWAITING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PACKAGING', 'SHIPPED', 'DELIVERED', 'ISSUE'], default: 'AWAITING_PAYMENT' }, previousState: String, shippingAddress: { type: Schema.Types.Mixed, required: true, select: false }, consent: { type: Schema.Types.Mixed, required: true }, carrier: String, trackingNumber: String, revision: integer() }, options);
order.index({ userId: 1, createdAt: -1 }); order.index({ campaignId: 1, state: 1 }); export const PrintPreOrder = model('PrintPreOrder', order);

const supporter = new Schema({ campaignId: ref('FundingCampaign'), userId: ref('User'), activePayments: integer() }, options);
supporter.index({ campaignId: 1, userId: 1 }, { unique: true }); export const CampaignSupporter = model('CampaignSupporter', supporter);

const interest = new Schema({ bookId: ref('Book'), userId: ref('User') }, options);
interest.index({ bookId: 1, userId: 1 }, { unique: true }); export const PrintInterest = model('PrintInterest', interest);

const audit = new Schema({ actorId: ref('User', false), entityId: { type: Schema.Types.ObjectId, required: true }, action: { type: String, required: true }, from: String, to: String, reason: { type: String, maxlength: 2000 }, metadata: Schema.Types.Mixed }, options);
audit.index({ entityId: 1, createdAt: 1 }); appendOnly(audit); export const PrintAudit = model('PrintAudit', audit);

const update = new Schema({ campaignId: ref('FundingCampaign'), state: String, message: { type: String, required: true, maxlength: 2000 }, createdBy: ref('User', false) }, options);
update.index({ campaignId: 1, createdAt: -1 }); appendOnly(update); export const CampaignUpdate = model('CampaignUpdate', update);

const outbox = new Schema({ key: { type: String, required: true, unique: true }, userId: ref('User', false), campaignId: ref('FundingCampaign', false), broadcast: { type: Boolean, default: false }, cursor: Schema.Types.ObjectId, title: String, message: String, state: { type: String, enum: ['PENDING', 'DONE'], default: 'PENDING' }, attempts: integer(), lastError: String }, options);
outbox.index({ state: 1, _id: 1 }); export const PrintOutbox = model('PrintOutbox', outbox);

// The mock provider is a separate durable boundary; never participates in app transactions.
const charge = new Schema({ merchantReference: { type: String, required: true, unique: true }, amountMinor: integer(), currency: { type: String, enum: ['TRY'], default: 'TRY' }, state: { type: String, enum: ['PENDING', 'FAILED', 'CANCELLED', 'CAPTURED', 'REFUNDED'], default: 'PENDING' }, revision: integer(), capturedAt: Date, refundReference: String, refundId: String, refundFailure: { type: Boolean, default: false } }, options);
export const SandboxCharge = model('SandboxCharge', charge);

export const printModels = [PrintAsset, BookPrintVersion, PrintTariff, PrintApplication, FundingCampaign, FundingPayment, PaymentReservation, FundingPaymentEvent, FundingLedger, FundingRefund, PrintPreOrder, CampaignSupporter, PrintInterest, PrintAudit, CampaignUpdate, PrintOutbox, SandboxCharge];
