// src/graphql/mutations/user.js
// ─────────────────────────────────────────────────────────────────
// Mevcut mutation'lar aynen korundu.
// Yeni mutation'lar en alta eklendi.
// ─────────────────────────────────────────────────────────────────
import { gql } from '@apollo/client';

// ── Mevcut mutation'lar (değişmedi) ───────────────────────────────

export const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email) { code message }
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($token: String!, $newPassword: String!) {
    resetPassword(token: $token, newPassword: $newPassword) { code message }
  }
`;

export const GOOGLE_AUTH = gql`
  mutation GoogleAuth($token: String!) {
    googleAuth(token: $token) {
      token
      user { id username fullName email role isPremium }
    }
  }
`;

export const SEND_REGISTRATION_CODE = gql`
  mutation SendRegistrationCode($email: String!, $username: String!) {
    sendRegistrationCode(email: $email, username: $username) { code message }
  }
`;

export const REGISTER = gql`
  mutation Register(
    $username: String!, $fullName: String!,
    $email: String!,   $password: String!, $code: String!
  ) {
    register(username: $username, fullName: $fullName,
             email: $email, password: $password, code: $code) {
      code message
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id username fullName email role isPremium }
    }
  }
`;

export const TOGGLE_SAVED_BOOK_MUTATION = gql`
  mutation ToggleSaveBook($bookId: ID!) {
    toggleSaveBook(bookId: $bookId) { id savedBooks { id } }
  }
`;

export const TOGGLE_FOLLOW_MUTATION = gql`
  mutation ToggleFollowUser($followId: ID!) {
    toggleFollowUser(followId: $followId) { code message }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  mutation UpdateProfile(
    $username: String!, $fullName: String!,
    $bio: String!, $profilePicture: String
  ) {
    updateProfile(username: $username, fullName: $fullName,
                  bio: $bio, profilePicture: $profilePicture) {
      id username fullName bio profilePicture
    }
  }
`;

// ── Yeni: Hesap ───────────────────────────────────────────────────

export const CHANGE_EMAIL_MUTATION = gql`
  mutation ChangeEmail($newEmail: String!, $currentPassword: String!) {
    changeEmail(newEmail: $newEmail, currentPassword: $currentPassword) {
      code message
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      code message
    }
  }
`;

// ── Yeni: Ayarlar ─────────────────────────────────────────────────

export const UPDATE_PRIVACY_SETTINGS_MUTATION = gql`
  mutation UpdatePrivacySettings($privacySettings: PrivacySettingsInput!) {
    updatePrivacySettings(privacySettings: $privacySettings) {
      id
      privacySettings {
        isProfilePublic
        isLibraryPublic
        isFollowListPublic
        allowMessages
        showInSearchEngines
      }
    }
  }
`;

export const UPDATE_NOTIFICATION_SETTINGS_MUTATION = gql`
  mutation UpdateNotificationSettings($notificationSettings: NotificationSettingsInput!) {
    updateNotificationSettings(notificationSettings: $notificationSettings) {
      id
      notificationSettings {
        newFollower
        mentionInSession
        bookComment
        bookLike
        quoteLike
        sessionReply
        publishingOffer
        offerUpdate
        emailDigest
        emailOffers
        emailMarketing
      }
    }
  }
`;

export const UPDATE_AUTHOR_SETTINGS_MUTATION = gql`
  mutation UpdateAuthorSettings($authorSettings: AuthorSettingsInput!) {
    updateAuthorSettings(authorSettings: $authorSettings) {
      id
      authorSettings {
        defaultLanguage
        publishingVisible
        copyrightNote
        weeklyWordGoal
        preferredGenres
      }
    }
  }
`;

// ── Yeni: Hesap Yönetimi ──────────────────────────────────────────

export const DEACTIVATE_ACCOUNT_MUTATION = gql`
  mutation DeactivateAccount {
    deactivateAccount { code message }
  }
`;

export const DELETE_ACCOUNT_MUTATION = gql`
  mutation DeleteAccount {
    deleteAccount { code message }
  }
`;