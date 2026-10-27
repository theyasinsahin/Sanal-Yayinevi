import { GraphQLScalarType, Kind } from 'graphql';
import { BookPrintVersion, PrintTariff, PrintApplication, FundingPayment, PaymentReservation, FundingRefund, PrintPreOrder, FundingCampaign, CampaignUpdate, PrintAudit } from '../../models/printFunding.js';
import { actor, id, int, fail, page, assertPrintSystem } from '../../services/print/common.js';
import * as applications from '../../services/print/applicationService.js';
import * as campaigns from '../../services/print/campaignService.js';
import * as payments from '../../services/print/paymentService.js';
import { sandboxEnabled } from '../../services/print/paymentProvider.js';
import { runPrintMaintenance } from '../../services/print/worker.js';
import { decryptAddress } from '../../services/print/addressCrypto.js';

async function privateList(context, model, args, admin = false) {
  const user = await actor(context, null, admin);
  return model.find({ ...(admin ? {} : { userId: user._id }), ...(args.campaignId ? { campaignId: id(args.campaignId) } : {}) }).sort({ createdAt: -1, _id: -1 }).skip((page(args.page) - 1) * 20).limit(20).exec();
}
const resolvers = {
  MinorAmount: new GraphQLScalarType({ name: 'MinorAmount', serialize: value => int(value, 'Kuruş'), parseValue: value => int(value, 'Kuruş'), parseLiteral: node => { if (node.kind !== Kind.INT) throw fail('Kuruş tam sayı olmalı.'); return int(Number(node.value), 'Kuruş'); } }),
  Query: {
    printPaymentMode: () => sandboxEnabled() ? 'SANDBOX' : 'DISABLED',
    printOverview: (_, { bookId }, context) => campaigns.printOverview(context, bookId),
    printTariffs: () => PrintTariff.find().sort({ createdAt: -1, _id: -1 }).limit(50).exec(),
    myPrintApplications: (_, args, context) => applications.applications(context, args),
    myPrintApplicationForBook: async (_, { bookId }, context) => { const user = await actor(context); return PrintApplication.findOne({ bookId: id(bookId), authorId: user._id }).sort({ createdAt: -1, _id: -1 }).exec(); },
    adminPrintApplications: (_, args, context) => applications.applications(context, { ...args, admin: true }),
    printApplication: (_, { id: applicationId }, context) => applications.privateApplication(context, applicationId),
    printApplicationHistory: (_, { id: applicationId }, context) => applications.applicationHistory(context, applicationId),
    printApplicationVersions: (_, { id: applicationId }, context) => applications.applicationVersions(context, applicationId),
    myFundingCampaigns: (_, args, context) => campaigns.campaigns(context, { ...args, mine: true }),
    adminFundingCampaigns: (_, args, context) => campaigns.campaigns(context, { ...args, admin: true }),
    myFundingPayments: (_, args, context) => privateList(context, FundingPayment, args),
    myFundingPayment: async (_, { id: paymentId }, context) => { const user = await actor(context); return FundingPayment.findOne({ _id: id(paymentId), userId: user._id }).exec(); },
    myPrintOrders: (_, args, context) => privateList(context, PrintPreOrder, args),
    adminFundingPayments: (_, args, context) => privateList(context, FundingPayment, args, true),
    adminPrintOrders: (_, args, context) => privateList(context, PrintPreOrder, args, true),
    adminFundingRefunds: (_, args, context) => privateList(context, FundingRefund, args, true),
    printCampaignAudit: async (_, { campaignId }, context) => {
      const user = await actor(context), campaign = await FundingCampaign.findById(id(campaignId)).exec();
      if (!campaign || (user.role !== 'ADMIN' && String(campaign.authorId) !== user.id)) throw fail('Yetkiniz yok.', 'FORBIDDEN');
      return PrintAudit.find({ entityId: campaignId }).sort({ createdAt: -1, _id: -1 }).limit(200).exec();
    },
  },
  Mutation: {
    createPrintTariff: (_, { input }, context) => applications.createTariff(context, input),
    savePrintApplication: (_, { input }, context) => applications.saveApplication(context, input),
    submitPrintApplication: (_, args, context) => applications.submitApplication(context, args),
    cancelPrintApplication: (_, args, context) => applications.cancelApplication(context, args),
    reviewPrintApplication: (_, { input }, context) => applications.reviewApplication(context, input),
    openFundingCampaign: (_, { input }, context) => campaigns.openCampaign(context, input),
    closeFundingCampaign: (_, args, context) => campaigns.closeCampaign(context, args),
    setPrintInterest: (_, args, context) => applications.setInterest(context, args),
    startPrintCheckout: (_, { input }, context) => payments.checkout(context, input),
    simulatePrintPayment: (_, args, context) => payments.simulatePayment(context, args),
    cancelPrintPayment: (_, { paymentId }, context) => payments.cancelPayment(context, paymentId),
    requestPrintRefund: (_, args, context) => payments.requestRefund(context, args),
    retryPrintRefund: (_, { refundId }, context) => payments.retryRefund(context, refundId),
    updatePrintProduction: (_, { input }, context) => campaigns.updateProduction(context, input),
    updatePrintOrder: (_, { input }, context) => campaigns.updateOrder(context, input),
    runPrintMaintenance: async (_, __, context) => { await actor(context, null, true); return runPrintMaintenance(); },
  },
  Book: { digitalStatus: applications.digitalState, writingStatus: applications.writingState },
  PrintTariff: { configuration: parent => { const { _id, __v, createdBy, createdAt, updatedAt, ...config } = parent.toObject(); return config; } },
  PrintApplication: { version: parent => BookPrintVersion.findById(parent.versionId).exec() },
  FundingCampaign: {
    availableMinor: parent => Math.max(0, parent.targetMinor - parent.acceptedMinor - parent.reservedMinor),
    progressPercent: parent => Math.min(100, parent.targetMinor ? parent.acceptedMinor * 100 / parent.targetMinor : 0),
    policy: async parent => (await PrintTariff.findById(parent.tariffId).exec()).policy,
    updates: parent => CampaignUpdate.find({ campaignId: parent._id }).sort({ createdAt: -1, _id: -1 }).limit(50).exec(),
  },
  FundingPayment: {
    reservation: parent => PaymentReservation.findOne({ paymentId: parent._id }).exec(),
    order: parent => PrintPreOrder.findOne({ paymentId: parent._id }).exec(),
    refund: parent => FundingRefund.findOne({ paymentId: parent._id }).exec(),
  },
  PrintPreOrder: { shippingAddress: async (parent, _, context) => {
    const user = await actor(context);
    if (user.role !== 'ADMIN' && String(parent.userId) !== user.id) throw fail('Teslimat bilgilerine erişiminiz yok.', 'FORBIDDEN');
    const order = await PrintPreOrder.findById(parent._id).select('+shippingAddress').exec();
    return order ? decryptAddress(order.shippingAddress, String(order.paymentId)) : null;
  } },
};
for (const [name, resolve] of Object.entries(resolvers.Mutation)) {
  // Preparing an admin tariff must not require enabling applications or payments.
  if (name === 'createPrintTariff') continue;
  resolvers.Mutation[name] = (...args) => { assertPrintSystem(); return resolve(...args); };
}
export default resolvers;
