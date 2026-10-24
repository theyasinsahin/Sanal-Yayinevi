import { gql } from '@apollo/client';

export const SEND_CONTACT_MESSAGE = gql`
  mutation SendContactMessage($input: ContactMessageInput!) {
    sendContactMessage(input: $input) { code message }
  }
`;
export const SUBSCRIBE_NEWSLETTER = gql`
  mutation SubscribeNewsletter($input: NewsletterSubscriptionInput!) {
    subscribeNewsletter(input: $input) { code message }
  }
`;
export const MANAGE_NEWSLETTER = gql`
  mutation ManageNewsletter($token: String!, $action: NewsletterAction!) {
    manageNewsletter(token: $token, action: $action) { code message }
  }
`;
