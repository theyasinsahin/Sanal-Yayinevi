import assert from 'node:assert/strict';
import { samplePdf } from './printSandboxSupport.js';

// Actual HTTP/JWT/file-upload smoke test against the launcher's local API only.
export async function verifySandboxFlow(data) {
  const endpoint = 'http://127.0.0.1:5125';
  async function gql(query, variables = {}, token) {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (!response.ok || result.errors) throw new Error(`Sandbox HTTP kontrolü: ${result.errors?.[0]?.message || response.status}`);
    return result.data;
  }
  async function upload(token, name) {
    const response = await fetch(`${endpoint}/api/print/assets`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf', 'X-Filename': `${name}.pdf` }, body: samplePdf(`Sandbox ${name}`) });
    assert.equal(response.status, 201); return (await response.json()).id;
  }
  const tokens = {};
  for (const [name, user] of Object.entries(data.users)) tokens[name] = (await gql('mutation($email:String!,$password:String!){login(email:$email,password:$password){token}}', { email: user.email, password: data.password })).login.token;
  assert.equal((await gql('{printPaymentMode}')).printPaymentMode, 'SANDBOX');
  const coverAssetId = await upload(tokens.author, 'cover'), layoutAssetId = await upload(tokens.admin, 'layout'), quoteAssetId = await upload(tokens.admin, 'quote');
  async function open(bookId) {
    let app = (await gql('mutation($input:SavePrintApplicationInput!){savePrintApplication(input:$input){id revision state}}', { input: {
      bookId, tariffId: data.tariffId, specification: { dimension: '13.5x21', paperType: 'enzo', coverType: 'paperback', color: 'BW', printRun: 10, coverAssetId, coverDpi: 300, bleedMm: 3, notes: 'Sandbox' }, declarations: { copyright: true, permissions: true, terms: true },
    } }, tokens.author)).savePrintApplication;
    app = (await gql('mutation($id:ID!,$revision:Int!){submitPrintApplication(applicationId:$id,revision:$revision){id revision state}}', { id: app.id, revision: app.revision }, tokens.author)).submitPrintApplication;
    assert.equal(app.state, 'SUBMITTED');
    app = (await gql('mutation($input:ReviewPrintApplicationInput!){reviewPrintApplication(input:$input){id revision state approvedTargetMinor approvedUnitPriceMinor}}', { input: {
      applicationId: app.id, revision: app.revision, decision: 'APPROVED', reason: 'Sandbox teknik dosya kontrolü.', quote: {
        source: 'SANDBOX ÖRNEK TEKLİF', confirmedPages: 1, layoutAssetId, quoteAssetId, preflightConfirmed: true,
        components: { printingMinor: 50000, shippingMinor: 10000, packagingMinor: 10000, taxMinor: 10000, providerFeeMinor: 10000, serviceMinor: 10000, otherMinor: 0 },
        sale: { unitProductionMinor: 5000, unitShippingMinor: 1000, unitPackagingMinor: 1000, unitTaxMinor: 1000, unitFeeMinor: 1000, unitServiceMinor: 1000, unitMarginMinor: 10000 },
      },
    } }, tokens.admin)).reviewPrintApplication;
    assert.equal(app.approvedTargetMinor, 100000); assert.equal(app.approvedUnitPriceMinor, 20000);
    return (await gql('mutation($input:OpenPrintCampaignInput!){openFundingCampaign(input:$input){id state productionRevision}}', { input: { applicationId: app.id, revision: app.revision, days: 30 } }, tokens.admin)).openFundingCampaign;
  }
  async function pay(campaign, quantity, donationMinor) {
    const payment = (await gql('mutation($input:PrintCheckoutInput!){startPrintCheckout(input:$input){id state order{id revision state}}}', { input: {
      campaignId: campaign.id, idempotencyKey: `sandbox-http-${campaign.id}`, quantity, donationMinor,
      ...(quantity ? { shippingAddress: { fullName: 'Sandbox Alıcı', phone: '05555555555', city: 'İstanbul', district: 'Kadıköy', postalCode: '34700', line: 'Yalnızca sandbox için uydurma örnek adres', consent: true } } : {}),
    } }, tokens.reader)).startPrintCheckout;
    return (await gql('mutation($id:ID!){simulatePrintPayment(paymentId:$id,outcome:"CAPTURED"){id state order{id revision state}}}', { id: payment.id }, tokens.reader)).simulatePrintPayment;
  }
  const maintain = () => gql('mutation{runPrintMaintenance}', {}, tokens.admin);
  let campaign = await open(data.books[0].id);
  const payment = await pay(campaign, 1, 80000);
  assert.equal(payment.state, 'CAPTURED'); await maintain();
  const overview = (await gql('query($id:ID!){printOverview(bookId:$id){campaign{id state acceptedMinor productionState productionRevision}}}', { id: data.books[0].id })).printOverview.campaign;
  assert.equal(overview.state, 'SUCCEEDED'); assert.equal(overview.acceptedMinor, 100000);
  campaign = overview;
  async function production(state) {
    campaign = (await gql('mutation($input:PrintProductionInput!){updatePrintProduction(input:$input){id state productionState productionRevision}}', { input: { campaignId: campaign.id, revision: campaign.productionRevision, state, message: `Sandbox ${state} kontrolü.` } }, tokens.admin)).updatePrintProduction;
  }
  for (const state of ['PRINTER_APPROVED', 'STARTED', 'PRINTING', 'PRINTED', 'PACKAGING', 'SHIPPING']) await production(state);
  let order = payment.order;
  for (const state of ['PACKAGING', 'SHIPPED', 'DELIVERED']) {
    order = (await gql('mutation($input:PrintOrderUpdateInput!){updatePrintOrder(input:$input){id state revision trackingNumber}}', { input: { orderId: order.id, revision: order.revision, state, carrier: 'Sandbox Kargo', trackingNumber: 'TEST-12345', reason: `Sandbox ${state} kontrolü.` } }, tokens.admin)).updatePrintOrder;
  }
  assert.equal(order.state, 'DELIVERED');
  await production('DELIVERED'); await production('COMPLETED'); assert.equal(campaign.productionState, 'COMPLETED');
  campaign = await open(data.books[1].id); const refundPayment = await pay(campaign, 0, 5000);
  await gql('mutation($id:ID!){closeFundingCampaign(campaignId:$id,reason:"Sandbox tam iade kontrolü"){id state}}', { id: campaign.id }, tokens.admin);
  await maintain(); await maintain();
  const refunded = (await gql('query($id:ID!){myFundingPayment(id:$id){id state refund{state amountMinor}}}', { id: refundPayment.id }, tokens.reader)).myFundingPayment;
  assert.equal(refunded.state, 'REFUNDED'); assert.equal(refunded.refund.state, 'SUCCEEDED'); assert.equal(refunded.refund.amountMinor, 5000);
}
