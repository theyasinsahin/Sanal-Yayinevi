import * as admin from '../../services/adminService.js';

export default {
  Query: {
    getAdminResources: (_, __, context) => admin.getAdminResources(context),
    getAdminOverview: (_, __, context) => admin.getAdminOverview(context),
    getAdminRecords: (_, args, context) => admin.getAdminRecords(context, args),
    getAdminRecord: (_, args, context) => admin.getAdminRecord(context, args),
  },
  Mutation: { saveAdminRecord: (_, args, context) => admin.saveAdminRecord(context, args) },
};
