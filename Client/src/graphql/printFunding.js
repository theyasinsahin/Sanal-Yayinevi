import { gql } from '@apollo/client';

export const PRINT_CAMPAIGN_FIELDS = gql`
  fragment PrintCampaignFields on FundingCampaign {
    id bookId authorId applicationId versionId title environment state outcome
    targetMinor acceptedMinor reservedMinor availableMinor unitPriceMinor
    printRun soldQuantity reservedQuantity supporterCount progressPercent startsAt endsAt
    productionState previousProductionState productionRevision financeIssue policy
    updates { id state message createdAt }
  }
`;
export const PRINT_APPLICATION_FIELDS = gql`
  fragment PrintApplicationFields on PrintApplication {
    id bookId authorId revision state tariffId estimate verifiedQuote approvedTargetMinor approvedUnitPriceMinor reviewNote createdAt updatedAt
    version { classificationReview id title authorName wordCount estimatedPages contentHash specification declarations }
  }
`;
export const PRINT_ORDER_FIELDS = gql`
  fragment PrintOrderFields on PrintPreOrder { id paymentId campaignId quantity unitPriceMinor totalMinor state previousState revision carrier trackingNumber createdAt }
`;
export const PRINT_PAYMENT_FIELDS = gql`
  ${PRINT_ORDER_FIELDS}
  fragment PrintPaymentFields on FundingPayment {
    id campaignId bookId provider checkoutUrl amountMinor donationMinor orderMinor quantity currency state allocated captured issue createdAt
    reservation { state expiresAt }
    order { ...PrintOrderFields }
    refund { id paymentId amountMinor reason state attempts lastError retryAt providerRefundId }
  }
`;
export const PRINT_OVERVIEW = gql`
  ${PRINT_CAMPAIGN_FIELDS}
  query PrintOverview($bookId: ID!) { printPaymentMode printOverview(bookId: $bookId) { bookId digitalStatus writingStatus interestCount interested campaign { ...PrintCampaignFields } } }
`;
export const PRINT_TARIFFS = gql`query PrintTariffs { printTariffs { id version label environment configuration policy } }`;
export const AUTHOR_PRINT_WORKSPACE = gql`${PRINT_APPLICATION_FIELDS} ${PRINT_CAMPAIGN_FIELDS}
  query AuthorPrintWorkspace($bookId: ID!) {
    printPaymentMode printTariffs { id version label environment configuration policy }
    myPrintApplicationForBook(bookId: $bookId) { ...PrintApplicationFields }
    printOverview(bookId: $bookId) { bookId digitalStatus writingStatus interestCount interested campaign { ...PrintCampaignFields } }
  }
`;
export const MY_PRINT_APPLICATIONS = gql`${PRINT_APPLICATION_FIELDS} query MyPrintApplications($page: Int) { myPrintApplications(page: $page) { ...PrintApplicationFields } }`;
export const ADMIN_PRINT_APPLICATIONS = gql`${PRINT_APPLICATION_FIELDS} query AdminPrintApplications($page: Int) { adminPrintApplications(page: $page) { ...PrintApplicationFields } }`;
export const PRINT_APPLICATION_DETAIL = gql`
  ${PRINT_APPLICATION_FIELDS}
  query PrintApplicationDetail($id: ID!) {
    printApplication(id: $id) { ...PrintApplicationFields }
    printApplicationHistory(id: $id) { id actorId action from to reason metadata createdAt }
    printApplicationVersions(id: $id) { id bookId title authorName wordCount estimatedPages contentHash specification declarations createdAt chapters { sourceId title content } }
  }
`;
export const MY_FUNDING_CAMPAIGNS = gql`${PRINT_CAMPAIGN_FIELDS} query MyFundingCampaigns($page: Int) { myFundingCampaigns(page: $page) { ...PrintCampaignFields } }`;
export const ADMIN_FUNDING_CAMPAIGNS = gql`${PRINT_CAMPAIGN_FIELDS} query AdminFundingCampaigns($page: Int) { adminFundingCampaigns(page: $page) { ...PrintCampaignFields } }`;
export const MY_FUNDING_HISTORY = gql`${PRINT_PAYMENT_FIELDS} query MyFundingHistory($page: Int) { printPaymentMode myFundingPayments(page: $page) { ...PrintPaymentFields } }`;
export const MY_FUNDING_PAYMENT = gql`${PRINT_PAYMENT_FIELDS} query MyFundingPayment($id: ID!) { myFundingPayment(id: $id) { ...PrintPaymentFields } }`;
export const ADMIN_FUNDING_OPERATIONS = gql`
  ${PRINT_PAYMENT_FIELDS}
  query AdminFundingOperations($page: Int) {
    adminFundingPayments(page: $page) { ...PrintPaymentFields }
    adminPrintOrders(page: $page) { ...PrintOrderFields shippingAddress }
    adminFundingRefunds(page: $page) { id paymentId amountMinor reason state attempts lastError retryAt providerRefundId }
  }
`;
export const PRINT_CAMPAIGN_AUDIT = gql`query PrintCampaignAudit($campaignId: ID!) { printCampaignAudit(campaignId: $campaignId) { id actorId action from to reason metadata createdAt } }`;
export const CREATE_PRINT_TARIFF = gql`mutation CreatePrintTariff($input: JSON!) { createPrintTariff(input: $input) { id version label environment configuration policy } }`;
export const SAVE_PRINT_APPLICATION = gql`${PRINT_APPLICATION_FIELDS} mutation SavePrintApplication($input: SavePrintApplicationInput!) { savePrintApplication(input: $input) { ...PrintApplicationFields } }`;
export const SUBMIT_PRINT_APPLICATION = gql`${PRINT_APPLICATION_FIELDS} mutation SubmitPrintApplication($applicationId: ID!, $revision: Int!) { submitPrintApplication(applicationId: $applicationId, revision: $revision) { ...PrintApplicationFields } }`;
export const CANCEL_PRINT_APPLICATION = gql`${PRINT_APPLICATION_FIELDS} mutation CancelPrintApplication($applicationId: ID!, $revision: Int!, $reason: String!) { cancelPrintApplication(applicationId: $applicationId, revision: $revision, reason: $reason) { ...PrintApplicationFields } }`;
export const REVIEW_PRINT_APPLICATION = gql`${PRINT_APPLICATION_FIELDS} mutation ReviewPrintApplication($input: ReviewPrintApplicationInput!) { reviewPrintApplication(input: $input) { ...PrintApplicationFields } }`;
export const OPEN_FUNDING_CAMPAIGN = gql`${PRINT_CAMPAIGN_FIELDS} mutation OpenFundingCampaign($input: OpenPrintCampaignInput!) { openFundingCampaign(input: $input) { ...PrintCampaignFields } }`;
export const CLOSE_FUNDING_CAMPAIGN = gql`${PRINT_CAMPAIGN_FIELDS} mutation CloseFundingCampaign($campaignId: ID!, $reason: String!) { closeFundingCampaign(campaignId: $campaignId, reason: $reason) { ...PrintCampaignFields } }`;
export const SET_PRINT_INTEREST = gql`mutation SetPrintInterest($bookId: ID!, $interested: Boolean!) { setPrintInterest(bookId: $bookId, interested: $interested) }`;
export const START_PRINT_CHECKOUT = gql`${PRINT_PAYMENT_FIELDS} mutation StartPrintCheckout($input: PrintCheckoutInput!) { startPrintCheckout(input: $input) { ...PrintPaymentFields } }`;
export const SIMULATE_PRINT_PAYMENT = gql`${PRINT_PAYMENT_FIELDS} mutation SimulatePrintPayment($paymentId: ID!, $outcome: String!) { simulatePrintPayment(paymentId: $paymentId, outcome: $outcome) { ...PrintPaymentFields } }`;
export const CANCEL_PRINT_PAYMENT = gql`${PRINT_PAYMENT_FIELDS} mutation CancelPrintPayment($paymentId: ID!) { cancelPrintPayment(paymentId: $paymentId) { ...PrintPaymentFields } }`;
export const REQUEST_PRINT_REFUND = gql`${PRINT_PAYMENT_FIELDS} mutation RequestPrintRefund($paymentId: ID!, $reason: String!) { requestPrintRefund(paymentId: $paymentId, reason: $reason) { ...PrintPaymentFields } }`;
export const RETRY_PRINT_REFUND = gql`mutation RetryPrintRefund($refundId: ID!) { retryPrintRefund(refundId: $refundId) { id state attempts lastError } }`;
export const UPDATE_PRINT_PRODUCTION = gql`${PRINT_CAMPAIGN_FIELDS} mutation UpdatePrintProduction($input: PrintProductionInput!) { updatePrintProduction(input: $input) { ...PrintCampaignFields } }`;
export const UPDATE_PRINT_ORDER = gql`${PRINT_ORDER_FIELDS} mutation UpdatePrintOrder($input: PrintOrderUpdateInput!) { updatePrintOrder(input: $input) { ...PrintOrderFields } }`;
export const RUN_PRINT_MAINTENANCE = gql`mutation RunPrintMaintenance { runPrintMaintenance }`;
